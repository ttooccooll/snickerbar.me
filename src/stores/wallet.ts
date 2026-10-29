import { defineStore } from "pinia";
import { currentDateStr } from "src/js/utils";
import { useMintsStore, WalletProof } from "./mints";
import { useLocalStorage } from "@vueuse/core";
import { useProofsStore } from "./proofs";
import { useTokensStore } from "./tokens";
import { useReceiveTokensStore } from "./receiveTokensStore";
import { useUiStore } from "src/stores/ui";
import { useP2PKStore } from "src/stores/p2pk"

import * as _ from "underscore";
import token from "src/js/token";
import { notifyApiError, notifyError, notifySuccess, notifyWarning, notify } from "src/js/notify";
import { CashuMint, CashuWallet, Proof, MintQuotePayload, CheckStatePayload, MeltQuotePayload, MeltQuoteResponse, generateNewMnemonic, deriveSeedFromMnemonic, AmountPreference, CheckStateEnum, getDecodedToken, Token, MeltQuoteState, MintQuoteState, MintKeyset } from "@cashu/cashu-ts";
import { hashToCurve } from '@cashu/crypto/modules/common';
import * as bolt11Decoder from "light-bolt11-decoder";
import { bech32 } from "bech32";
import axios from "axios";
import { date } from "quasar";
import { splitAmount } from "@cashu/cashu-ts/dist/lib/es5/utils";
import { isHexKeysetId, noteCount } from "src/js/treats";
import { affordableAmount, amountPlusInputFee, feeForCount, inputFeeForProofs } from "src/js/fees";
import { parseLightningRequest } from "src/js/lightning";

// HACK: this is a workaround so that the catch block in the melt function does not throw an error when the user exits the app
// before the payment is completed. This is necessary because the catch block in the melt function would otherwise remove all
// quotes from the invoiceHistory and the user would not be able to pay the invoice again after reopening the app.
let isUnloading = false;
window.addEventListener('beforeunload', () => {
  isUnloading = true;
});

type Invoice = {
  amount: number;
  bolt11: string;
  quote: string;
  memo: string;
};

type InvoiceHistory = Invoice & {
  date: string;
  status: "pending" | "paid";
  mint: string;
  unit?: string;
  token?: string;
};

// a LUD-06 payRequest, plus what the person typed or scanned to get it
type LnurlPayRequest = {
  domain: string;
  callback: string;
  minSendable: number;
  maxSendable: number;
  metadata: any;
  successAction: any;
  routes: any[];
  tag: string;
  commentAllowed?: number;
  // the Lightning address, "" for an LNURL
  address?: string;
  // the address or LNURL itself
  source?: string;
  [key: string]: any;
};

// cashu-ts 1.x does not type the NUT-02 input fee yet
type FeeKeyset = MintKeyset & { input_fee_ppk?: number };

type KeysetCounter = {
  id: string;
  counter: number;
};

// cuts a token out of a pasted string or a claim link like https://host/?token=cashuB…&x=y
function extractToken(req: string, prefix: string) {
  return req.slice(req.indexOf(prefix)).split(/[^A-Za-z0-9_\-+/=]/)[0];
}

const receiveStore = useReceiveTokensStore();
const tokenStore = useTokensStore();

export const useWalletStore = defineStore("wallet", {
  state: () => {
    return {
      mnemonic: useLocalStorage("cashu.mnemonic", ""),
      invoiceHistory: useLocalStorage(
        "cashu.invoiceHistory",
        [] as InvoiceHistory[]
      ),
      keysetCounters: useLocalStorage("cashu.keysetCounters", [] as KeysetCounter[]),
      oldMnemonicCounters: useLocalStorage("cashu.oldMnemonicCounters", [] as { mnemonic: string, keysetCounters: KeysetCounter[] }[]),
      invoiceData: {} as InvoiceHistory,
      // where "Move to my wallet" sent the sats last time
      moveAddress: useLocalStorage("snickerbar.moveAddress", ""),
      payInvoiceData: {
        blocking: false,
        bolt11: "",
        show: false,
        // moving everything to the person's own wallet, not paying someone
        sweep: false,
        meltQuote: {
          payload: {
            unit: "",
            request: "",
          } as MeltQuotePayload,
          response: {
            quote: "",
            amount: 0,
            fee_reserve: 0,
          } as MeltQuoteResponse,
          error: "",
        },
        invoice: {
          sat: 0,
          memo: "",
          bolt11: "",
        } as { sat: number, memo: string, bolt11: string } | null,
        lnurlpay: {
          domain: "",
          callback: "",
          minSendable: 0,
          maxSendable: 0,
          metadata: {},
          successAction: {},
          routes: [],
          tag: "",
        } as LnurlPayRequest | null,
        lnurlauth: {},
        input: {
          request: "",
          amount: null,
          comment: "",
          quote: "",
        } as { request: string, amount: number | null, comment: string, quote: string },
      },
    };
  },
  getters: {
    wallet() {
      const mints = useMintsStore();
      const mint = new CashuMint(mints.activeMintUrl);
      if (this.mnemonic == "") {
        this.mnemonic = generateNewMnemonic();
      }
      const mnemonic: string = this.mnemonic;
      const wallet = new CashuWallet(mint, { mnemonicOrSeed: mnemonic, unit: mints.activeUnit });
      return wallet;
    },
    seed(): Uint8Array {
      return deriveSeedFromMnemonic(this.mnemonic);
    }
  },
  actions: {
    newMnemonic: function () {
      // store old mnemonic and keysetCounters
      const oldMnemonicCounters = this.oldMnemonicCounters;
      const keysetCounters = this.keysetCounters;
      oldMnemonicCounters.push({ mnemonic: this.mnemonic, keysetCounters });
      this.keysetCounters = [];
      this.mnemonic = generateNewMnemonic();
    },
    keysetCounter: function (id: string) {
      const keysetCounter = this.keysetCounters.find((c) => c.id === id);
      if (keysetCounter) {
        return keysetCounter.counter;
      } else {
        this.keysetCounters.push({ id, counter: 1 });
        return 1;
      }
    },
    increaseKeysetCounter: function (id: string, by: number) {
      const keysetCounter = this.keysetCounters.find((c) => c.id === id);
      if (keysetCounter) {
        keysetCounter.counter += by;
        console.log("### increaseKeysetCounter", keysetCounter);
      } else {
        const newCounter = { id, counter: by } as KeysetCounter;
        this.keysetCounters.push(newCounter);
        console.log("### new keyset counter", keysetCounter);
      }
    },
    getKeyset(): string {
      const mintStore = useMintsStore();
      const keysets = mintStore.activeMint().keysets;
      if (keysets == null || keysets.length == 0) {
        throw new Error("no keysets found.");
      }
      const unitKeysets = mintStore.activeMint().unitKeysets(mintStore.activeUnit)
      if (unitKeysets == null || unitKeysets.length == 0) {
        console.error("no keysets found for unit", mintStore.activeUnit);
        throw new Error("no keysets found for unit");
      }
      // select the keyset id
      // const keyset_id = unitKeysets[0].id;
      // rules for selection:
      // - filter all keysets that are active=true
      // - order by id (whether it is hex or base64)
      // - order by input_fee_ppk (ascending)
      // - select the first one
      const sortedKeysets = this.keysetsByPreference(unitKeysets)
      if (sortedKeysets.length == 0) {
        console.error("no active keysets found for unit", mintStore.activeUnit);
        throw new Error("no active keysets found for unit");
      }
      const keyset_id = sortedKeysets[0].id;
      const keys = mintStore.activeMint().mint.keys.find((k) => k.id === keyset_id);
      if (keys) {
        this.wallet.keys = keys;
      }
      return keyset_id;
    },
    /**
     * Active keysets in the order we make new notes in: hex ids first, then
     * the cheapest first.
     */
    keysetsByPreference: function (keysets: FeeKeyset[]): FeeKeyset[] {
      const activeKeysets = keysets.filter(k => k.active)
      const byFee = (a: FeeKeyset, b: FeeKeyset) => (a.input_fee_ppk ?? 0) - (b.input_fee_ppk ?? 0)
      const hexKeysets = activeKeysets.filter(k => isHexKeysetId(k.id)).sort(byFee)
      const base64Keysets = activeKeysets.filter(k => !isHexKeysetId(k.id)).sort(byFee)
      return hexKeysets.concat(base64Keysets)
    },
    /**
     * The input fee (NUT-02) of the keyset new notes are made in, 0 on
     * fee-free mints.
     */
    newNoteFeePpk: function (): number {
      try {
        const mintStore = useMintsStore();
        const keysets = mintStore.activeMint().unitKeysets(mintStore.activeUnit) as FeeKeyset[];
        return this.keysetsByPreference(keysets)[0]?.input_fee_ppk ?? 0;
      } catch (e) {
        return 0;
      }
    },
    /**
     * Sets an invoice status to paid
     */
    setInvoicePaid(quoteId: string) {
      const invoice = this.invoiceHistory.find((i) => i.quote === quoteId);
      if (!invoice) return;
      invoice.status = "paid";
    },
    splitAmount: function (value: number) {
      // returns optimal 2^n split
      const chunks: Array<number> = [];
      for (let i = 0; i < 32; i++) {
        const mask: number = 1 << i;
        if ((value & mask) !== 0) {
          chunks.push(Math.pow(2, i));
        }
      }
      return chunks;
    },
    outputAmountSelect: function (amount: number, target = 3) {
      // This function produces an amount split for outputs based on the current coins we have.
      // Its objective is to fill up the wallet so that it reaches `target` coins of each amount.
      // The coins we currently have are are this.activeProofs
      const mintStore = useMintsStore();
      const amountsWeHave = mintStore.activeProofs.map((p) => p.amount);
      /*
      # NOTE: Do not assume 2^n here. This is not a general case.
      */
      // calculate until 2^64
      const allPossibleAmounts = Array.from({ length: 64 }, (_, i) => 2 ** i);
      const amountsWeWantLL = allPossibleAmounts.map((a) => {
        const count = Math.max(0, target - amountsWeHave.filter((x) => x === a).length);
        return Array(count).fill(a);
      });
      const amountsWeWant = amountsWeWantLL.flat().sort((a, b) => a - b);

      let amounts: number[] = [];
      while (amounts.reduce((s, t) => (s += t), 0) < amount && amountsWeWant.length) {
        if (amounts.reduce((s, t) => (s += t), 0) + amountsWeWant[0] > amount) {
          break;
        }
        amounts.push(amountsWeWant.shift() as number);
      }
      const remainingAmount = amount - amounts.reduce((s, t) => (s += t), 0);
      if (remainingAmount > 0) {
        console.log("remaining amount", remainingAmount)
        // amount_split is the optimal 2^n split: splitAmount
        amounts = amounts.concat(this.splitAmount(remainingAmount));
      }
      if (amounts.reduce((s, t) => (s += t), 0) != amount) {
        throw new Error(`Amounts do not sum to ${amount}.`);
      }

      // make array of AmountPreference types which have a unique `amount` and its `count`
      const amountsWithCount: AmountPreference[] = [];
      amounts.forEach((a) => {
        const existing = amountsWithCount.find((ac) => ac.amount === a);
        if (existing) {
          existing.count += 1;
        } else {
          amountsWithCount.push({ amount: a, count: 1 });
        }
      });

      return amountsWithCount;
    },
    coinSelectSpendBase64: function (proofs: WalletProof[], amount: number): WalletProof[] {
      // legacy base64 keysets; hex ids are "00…" (v1) and "01…" (v2) keysets
      const base64Proofs = proofs.filter(p => !isHexKeysetId(p.id))
      if (base64Proofs.length > 0) {
        base64Proofs.sort((a, b) => b.amount - a.amount);
        let sum = 0;
        let selectedProofs: WalletProof[] = [];
        for (let i = 0; i < base64Proofs.length; i++) {
          const proof = base64Proofs[i];
          sum += proof.amount;
          selectedProofs.push(proof);
          if (sum >= amount) {
            return selectedProofs;
          }
        }
        return [];
      }
      return [];
    },
    coinSelect: function (proofs: WalletProof[], amount: number) {
      if (proofs.reduce((s, t) => (s += t.amount), 0) < amount) {
        // there are not enough proofs to pay the amount
        return [];
      }

      // override: if there are proofs with a base64 id, use them
      const base64Proofs = this.coinSelectSpendBase64(proofs, amount);
      if (base64Proofs.length > 0 && base64Proofs.reduce((s, t) => (s += t.amount), 0) >= amount) {
        return base64Proofs;
      }

      // sort proofs by amount ascending
      proofs = proofs.slice().sort((a, b) => a.amount - b.amount);
      // remember next bigger proof as a fallback
      const nextBigger = proofs.find((p) => p.amount > amount);

      // go through smaller proofs until sum is bigger than amount
      const smallerProofs = proofs.filter((p) => p.amount <= amount);
      // sort by amount descending
      smallerProofs.sort((a, b) => b.amount - a.amount);

      let selectedProofs: WalletProof[] = [];

      if (smallerProofs.length == 0 && nextBigger) {
        // if there are no smaller proofs, take the next bigger proof as a fallback
        return [nextBigger];
      } else if (smallerProofs.length == 0 && !nextBigger) {
        // no proofs available
        return [];
      }

      // recursively select the largest proof of smallerProofs, subtract the amount from the remainder
      // and call coinSelect again with the remainder and the rest of the smallerProofs (without the largest proof)
      let remainder = amount;
      selectedProofs = [smallerProofs[0]];
      remainder -= smallerProofs[0].amount;
      if (remainder > 0) {
        selectedProofs = selectedProofs.concat(this.coinSelect(smallerProofs.slice(1), remainder));
      }
      let sum = selectedProofs.reduce((s, t) => (s += t.amount), 0);

      // if sum of selectedProofs is smaller than amount, take next bigger proof instead as a fallback
      if (sum < amount && nextBigger) {
        selectedProofs = [nextBigger];
      }

      // console.log("### selected amounts", "sum", selectedProofs.reduce((s, t) => (s += t.amount), 0), selectedProofs.map(p => p.amount));
      return selectedProofs
    },
    spendableProofs: function (proofs: WalletProof[], amount: number) {
      const uIStore = useUiStore();
      const proofsStore = useProofsStore();
      const mintStore = useMintsStore();
      const spendableProofs = proofsStore.getUnreservedProofs(proofs);
      if (proofsStore.sumProofs(spendableProofs) < amount) {
        const balance = mintStore.activeMintBalance();
        const unit = mintStore.activeUnit
        notifyWarning(
          "Balance is too low",
          `${uIStore.formatCurrency(balance, unit)} is not enough to pay ${uIStore.formatCurrency(amount, unit)}.`
        );
        throw Error("Balance too low");
      }
      return spendableProofs;
    },
    sendToLock: async function (proofs: WalletProof[], amount: number, receiverPubkey: string) {
      const spendableProofs = this.spendableProofs(proofs, amount);
      const proofsToSplit = this.coinSelect(spendableProofs, amount);
      const { returnChange: keepProofs, send: sendProofs } = await this.wallet.send(amount, proofsToSplit, { pubkey: receiverPubkey })
      const mintStore = useMintsStore();
      // note: we do not store sendProofs in the proofs store but
      // expect from the caller to store it in the history
      mintStore.addProofs(keepProofs);
      mintStore.removeProofs(proofsToSplit);
      return { keepProofs, sendProofs };
    },
    /**
     * The fee the mint charges for spending these proofs (NUT-02), 0 on
     * fee-free mints.
     */
    inputFee: function (proofs: Proof[]): number {
      const mintStore = useMintsStore();
      const ppkByKeysetId = new Map<string, number>();
      mintStore.mints.forEach((m) =>
        m.keysets.forEach((k: FeeKeyset) => ppkByKeysetId.set(k.id, k.input_fee_ppk ?? 0))
      );
      return inputFeeForProofs(proofs, ppkByKeysetId);
    },
    /**
     * Swaps `inputs` at the active mint into `sendAmount` plus change, after
     * the mint took its input fee. cashu-ts 1.x can't do this itself (it
     * always asks for outputs worth all of the inputs), so we build the swap
     * from its building blocks.
     */
    swapWithFees: async function (inputs: Proof[], sendAmount: number, keysetId: string, counter: number): Promise<{ keepProofs: Proof[], sendProofs: Proof[] }> {
      const wallet = this.wallet;
      const total = inputs.reduce((s, p) => s + p.amount, 0);
      const fee = this.inputFee(inputs);
      const keepAmount = total - fee - sendAmount;
      if (sendAmount <= 0 || keepAmount < 0) {
        throw new Error("Not enough ecash to cover the mint's fee.");
      }
      const keepAmounts = keepAmount > 0 ? splitAmount(keepAmount) : [];
      const sendAmounts = splitAmount(sendAmount);
      const keys = await wallet.getKeys(keysetId);
      const outputs = wallet.createBlindedMessages([...keepAmounts, ...sendAmounts], keysetId, counter);
      const { signatures } = await wallet.mint.split({
        inputs: inputs.map((p: any) => ({ id: p.id, amount: p.amount, secret: p.secret, C: p.C, ...(p.witness ? { witness: p.witness } : {}) })),
        outputs: outputs.blindedMessages,
      });
      const newProofs = wallet.constructProofs(signatures, outputs.rs, outputs.secrets, keys);
      return {
        keepProofs: newProofs.slice(0, keepAmounts.length),
        sendProofs: newProofs.slice(keepAmounts.length),
      };
    },
    /**
     * Picks notes worth `amount` plus the input fee the mint charges for
     * spending them. Notes that add up to exactly `amount` need no swap, so
     * no fee either.
     */
    selectProofsWithFee: function (spendableProofs: WalletProof[], amount: number) {
      const sum = (ps: WalletProof[]) => ps.reduce((s, t) => (s += t.amount), 0);
      let proofs = this.coinSelect(spendableProofs, amount);
      let total = sum(proofs);
      // splitting costs a fee on some mints: pick enough for the amount plus
      // the fee (which grows with every extra note we pick)
      let fee = total != amount ? this.inputFee(proofs) : 0;
      for (let i = 0; fee > 0 && total < amount + fee && i < 5; i++) {
        proofs = this.coinSelect(spendableProofs, amount + fee);
        total = sum(proofs);
        fee = this.inputFee(proofs);
      }
      return { proofs, total, fee, ok: proofs.length > 0 && total >= amount + fee };
    },
    splitToSend: async function (proofs: WalletProof[], amount: number, invalidate: boolean = false): Promise<{ keepProofs: Proof[], sendProofs: Proof[] }> {
      /*
      splits proofs so the user can keep firstProofs, send scndProofs.
      then sets scndProofs as reserved.

      if invalidate, scndProofs (the one to send) are invalidated
      */
      const mintStore = useMintsStore();
      const proofsStore = useProofsStore()
      const uIStore = useUiStore();
      let proofsToSplit: WalletProof[] = [];
      const keysetId = this.getKeyset()
      await uIStore.lockMutex();
      try {
        const spendableProofs = this.spendableProofs(proofs, amount);
        const selection = this.selectProofsWithFee(spendableProofs, amount);
        proofsToSplit = selection.proofs;
        const totalAmount = selection.total;
        const fee = selection.fee;
        if (!selection.ok) {
          proofsToSplit = [];
          notifyWarning("Balance is too low", "There isn't enough left to also pay the mint's fee.");
          throw new Error("Balance too low to cover the mint's fee.");
        }
        proofsStore.setReserved(proofsToSplit, true);
        let keepProofs: Proof[] = [];
        let sendProofs: Proof[] = [];
        if (totalAmount != amount) {
          const counter = this.keysetCounter(keysetId);
          if (fee > 0) {
            ({ keepProofs, sendProofs } = await this.swapWithFees(proofsToSplit, amount, keysetId, counter));
          } else {
            ({ returnChange: keepProofs, send: sendProofs } = await this.wallet.send(amount, proofsToSplit, { counter }));
          }
          this.increaseKeysetCounter(keysetId, keepProofs.length + sendProofs.length);

          mintStore.removeProofs(proofsToSplit);


          mintStore.addProofs(keepProofs);
          mintStore.addProofs(sendProofs);
        } else if (totalAmount == amount) {
          keepProofs = [];
          sendProofs = proofsToSplit.map((p) => {
            return {
              amount: p.amount,
              secret: p.secret,
              C: p.C,
              id: p.id,
            };
          });
        } else {
          throw new Error("could not split proofs.");
        }

        if (invalidate) {
          mintStore.removeProofs(sendProofs);
        }

        return { keepProofs, sendProofs };
      } catch (error: any) {
        proofsStore.setReserved(proofsToSplit, false);
        console.error(error);
        notifyApiError(error);
        this.handleOutputsHaveAlreadyBeenSignedError(keysetId, error);
        throw error;
      } finally {
        uIStore.unlockMutex();
      }
    },
    /**
     *
     *
     * @param {array} proofs
     */
    redeem: async function () {
      /*
      uses split to receive new tokens.
      */
      const uIStore = useUiStore();
      const mintStore = useMintsStore();
      const p2pkStore = useP2PKStore();

      const fromClaimLink = receiveStore.fromClaimLink;
      receiveStore.fromClaimLink = false;
      receiveStore.showReceiveTokens = false;
      console.log("### receive tokens", receiveStore.receiveData.tokensBase64);

      if (receiveStore.receiveData.tokensBase64.length == 0) {
        throw new Error("no tokens provided.");
      }
      const tokenJson = token.decode(receiveStore.receiveData.tokensBase64);
      if (tokenJson == undefined) {
        throw new Error("no tokens provided.");
      }
      let proofs = token.getProofs(tokenJson);

      // activate the mint and the unit
      await mintStore.activateMintUrl(token.getMint(tokenJson), false, false, tokenJson.unit);

      const amount = proofs.reduce((s, t) => (s += t.amount), 0);
      const tokenProofs = proofs;
      await uIStore.lockMutex();
      try {
        // redeem
        const keysetId = this.getKeyset()
        const counter = this.keysetCounter(keysetId)
        const preference = this.outputAmountSelect(amount);
        const privkey = receiveStore.receiveData.p2pkPrivateKey;
        const decodedToken = getDecodedToken(receiveStore.receiveData.tokensBase64);
        let tokenCts: Token
        let proofs: Proof[]
        try {
          const fee = privkey ? 0 : this.inputFee(tokenProofs);
          if (fee > 0) {
            // the mint keeps its fee, we get the rest
            ({ sendProofs: proofs } = await this.swapWithFees(tokenProofs, amount - fee, keysetId, counter));
          } else {
            proofs = await this.wallet.receive(receiveStore.receiveData.tokensBase64, { counter, preference, privkey })
          }
          this.increaseKeysetCounter(keysetId, proofs.length);
        } catch (error: any) {
          console.error(error);
          this.handleOutputsHaveAlreadyBeenSignedError(keysetId, error);
          if (/already spent|11001/i.test(String(error?.message || error))) {
            throw new Error("Already claimed: this ecash was spent before.");
          }
          throw new Error("Error receiving tokens: " + error);
        }
        // const proofs: Proof[] = tokenCts.token.map(t => t.proofs).flat();

        p2pkStore.setPrivateKeyUsed(privkey);

        mintStore.removeProofs(proofs);
        // gather all token.token[i].proofs
        mintStore.addProofs(proofs);

        // what actually arrived (less than the token on mints with fees)
        const received = proofs.reduce((s, p) => s + p.amount, 0);

        // if token is already in history, set to paid, else add to history
        if (tokenStore.historyTokens.find((t) => t.token === receiveStore.receiveData.tokensBase64)) {
          tokenStore.setTokenPaid(receiveStore.receiveData.tokensBase64);
        } else {
          tokenStore.addPaidToken({
            amount: received,
            serializedProofs: receiveStore.receiveData.tokensBase64,
            unit: mintStore.activeUnit,
            mint: mintStore.activeMintUrl,
          });
        }


        if (fromClaimLink) {
          // a parent claimed a printed treat: candy rain, then show them how
          // to keep and spend their new wallet
          uIStore.celebrate();
          uIStore.treatClaimed = { amount: received, unit: mintStore.activeUnit };
        } else {
          if (!!window.navigator.vibrate) navigator.vibrate(200);
          notifySuccess("Received " + uIStore.formatCurrency(received, mintStore.activeUnit));
        }
      } catch (error: any) {
        console.error(error);
        notifyApiError(error);
        throw error;
      } finally {
        uIStore.unlockMutex();
      }
      // }
    },


    // /mint
    /**
     * Ask the mint to generate an invoice for the given amount
     * Upon paying the request, the mint will credit the wallet with
     * cashu tokens
     */
    requestMint: async function (amount?: number) {
      const mintStore = useMintsStore();
      const uIStore = useUiStore();

      if (amount) {
        this.invoiceData.amount = amount;
      }
      await uIStore.lockMutex();
      try {
        // create MintQuotePayload(this.invoiceData.amount) payload
        const payload: MintQuotePayload = {
          amount: this.invoiceData.amount, unit: mintStore.activeUnit
        };
        const data = await mintStore.activeMint().api.createMintQuote(
          payload
        );
        this.invoiceData.bolt11 = data.request;
        this.invoiceData.quote = data.quote;
        this.invoiceData.date = currentDateStr();
        this.invoiceData.status = "pending";
        this.invoiceData.mint = mintStore.activeMintUrl;
        this.invoiceData.unit = mintStore.activeUnit;
        this.invoiceHistory.push({
          ...this.invoiceData,
        });
        return data;
      } catch (error: any) {
        console.error(error);
        notifyApiError(error, "Could not request mint");
      } finally {
        uIStore.unlockMutex();
      }
    },
    mint: async function (amount: number, hash: string, verbose: boolean = true) {
      const proofsStore = useProofsStore();
      const mintStore = useMintsStore();
      const tokenStore = useTokensStore();
      const uIStore = useUiStore();
      const keysetId = this.getKeyset()
      await uIStore.lockMutex();
      try {
        // first we check if the mint quote is paid
        const mintQuote = await mintStore.activeMint().api.checkMintQuote(hash);
        console.log("### mintQuote", mintQuote);
        if (mintQuote.state != MintQuoteState.PAID) {
          console.log("### mintQuote not paid yet");
          if (verbose) {
            notify("Invoice still pending");
          }
          throw new Error("invoice not paid yet.");
        }
        const counter = this.keysetCounter(keysetId)
        const preference = this.outputAmountSelect(amount);
        console.log("### preference", preference);
        const { proofs } = await this.wallet.mintTokens(amount, hash, { keysetId, counter, preference: preference })
        this.increaseKeysetCounter(keysetId, proofs.length);

        // const proofs = await this.mintApi(split, hash, verbose);
        if (!proofs.length) {
          throw "could not mint";
        }
        mintStore.addProofs(proofs);

        // update UI
        await this.setInvoicePaid(hash);
        const serializedProofs = proofsStore.serializeProofs(proofs);
        if (serializedProofs == null) {
          throw new Error("could not serialize proofs.");
        }
        tokenStore.addPaidToken({
          amount,
          serializedProofs: serializedProofs,
          unit: mintStore.activeUnit,
          mint: mintStore.activeMintUrl,
        });

        return proofs;
      } catch (error: any) {
        console.error(error);
        if (verbose) {
          notifyApiError(error);
        }
        this.handleOutputsHaveAlreadyBeenSignedError(keysetId, error);
        throw error;
      } finally {
        uIStore.unlockMutex();
      }
    },
    // get a melt quote
    meltQuote: async function () {
      const uIStore = useUiStore();
      // throw an error if this.payInvoiceData.blocking is true
      if (this.payInvoiceData.blocking) {
        throw new Error("already processing an melt quote.");
      }
      this.payInvoiceData.blocking = true;
      this.payInvoiceData.meltQuote.error = "";
      await uIStore.lockMutex();
      try {
        const mintStore = useMintsStore();
        if (this.payInvoiceData.input.request == "") {
          throw new Error("no invoice provided.");
        }
        const payload: MeltQuotePayload = {
          unit: mintStore.activeUnit,
          request: this.payInvoiceData.input.request,
        };
        this.payInvoiceData.meltQuote.payload = payload;
        const data = await mintStore.activeMint().api.createMeltQuote(payload);
        mintStore.assertMintError(data);
        this.payInvoiceData.meltQuote.response = data;
        console.log("#### meltQuote", payload, " response:", data);
        this.payInvoiceData.blocking = false;
        return data;
      } catch (error: any) {
        this.payInvoiceData.blocking = false;
        this.payInvoiceData.meltQuote.error = error;
        console.error(error);
        notifyApiError(error);
        throw error;
      } finally {
        uIStore.unlockMutex();
      }
    },
    /**
     * What paying the current melt quote takes out of the wallet, worked out
     * the way melt() picks its notes: the amount, the Lightning fee reserve
     * (the unused part comes back) and, on mints with fees, the input fees
     * for splitting off the notes and spending them. `smallerAmount` is an
     * amount that would fit, for invoices whose amount we can change.
     */
    meltCost: function () {
      const mintStore = useMintsStore();
      const proofsStore = useProofsStore();
      const quote = this.payInvoiceData.meltQuote.response;
      const amount = quote?.amount || 0;
      const feeReserve = quote?.fee_reserve || 0;
      let proofs: WalletProof[] = [];
      try {
        proofs = proofsStore.getUnreservedProofs(mintStore.activeMint().unitProofs(mintStore.activeUnit));
      } catch (e) {
        // no mint yet
      }
      const balance = proofsStore.sumProofs(proofs);
      const ppk = this.newNoteFeePpk();
      // the same steps as melt(): split off amount + reserve + the input fee
      // of the notes we hand over. Notes that happen to add up exactly are
      // handed over as they are, and if their own fee is higher melt() picks
      // again for that.
      let target = amountPlusInputFee(amount + feeReserve, ppk);
      let swapFee = 0;
      let enough = false;
      for (let i = 0; amount > 0 && i < 4; i++) {
        const selection = this.selectProofsWithFee(proofs, target);
        if (!selection.ok) {
          break;
        }
        const swapped = selection.total != target;
        const noteFee = swapped
          ? feeForCount(noteCount(target), ppk)
          : this.inputFee(selection.proofs);
        const needed = amount + feeReserve + noteFee;
        if (target >= needed) {
          swapFee = selection.fee;
          enough = true;
          break;
        }
        target = needed;
      }
      if (!enough) {
        // can't pay: swapping everything we have is the most it could cost
        target = amountPlusInputFee(amount + feeReserve, ppk);
        swapFee = this.inputFee(proofs);
      }
      const total = target + swapFee;
      const mintFee = total - amount - feeReserve;
      return {
        amount,
        feeReserve,
        mintFee,
        total,
        balance,
        enough,
        smallerAmount: enough ? amount : affordableAmount(amount, total, balance),
      };
    },
    melt: async function () {
      const uIStore = useUiStore();
      const proofsStore = useProofsStore();
      const mintStore = useMintsStore();
      const tokenStore = useTokensStore();

      // throw an error if this.payInvoiceData.blocking is true
      if (this.payInvoiceData.blocking) {
        throw new Error("already processing an invoice.");
      }
      console.log("#### pay lightning");
      if (this.payInvoiceData.invoice == null) {
        throw new Error("no invoice provided.");
      }
      const invoice = this.payInvoiceData.invoice.bolt11;
      // throw an error if the invoice is already in invoiceHistory
      if (this.invoiceHistory.find((i) => i.bolt11 === invoice && i.amount < 0 && i.status === "paid")) {
        notifyError("Invoice already paid.");
        throw new Error("invoice already paid.");
      }

      const amount_invoice = this.payInvoiceData.invoice.sat;
      const quote = this.payInvoiceData.meltQuote.response;
      if (quote == null || !quote.quote) {
        throw new Error("no quote found.");
      }
      const amount = quote.amount + quote.fee_reserve;

      console.log(
        "#### amount invoice",
        amount_invoice,
        "amount with fees",
        amount
      );
      let countChangeOutputs = 0;
      const keysetId = this.getKeyset();
      let keysetCounterIncrease = 0;

      // get right amount of proofs to send. On mints with fees the notes we
      // hand over cost an input fee too: split that off right away instead
      // of swapping a second time
      let { keepProofs, sendProofs } = await this.splitToSend(
        mintStore.activeMint().unitProofs(mintStore.activeUnit),
        amountPlusInputFee(amount, this.newNoteFeePpk())
      );
      // mints with fees also take an input fee on top of amount + fee_reserve
      for (let i = 0; i < 3; i++) {
        const needed = amount + this.inputFee(sendProofs);
        if (proofsStore.sumProofs(sendProofs) >= needed) {
          break;
        }
        // not enough for the fee yet: put these back and pick again
        proofsStore.setReserved(sendProofs, false);
        ({ keepProofs, sendProofs } = await this.splitToSend(
          mintStore.activeMint().unitProofs(mintStore.activeUnit),
          needed
        ));
      }
      if (sendProofs.length == 0) {
        throw new Error("could not split proofs.");
      }
      // start melt
      await uIStore.lockMutex();
      try {
        // proof management
        const serializedSendProofs = proofsStore.serializeProofs(sendProofs);
        if (serializedSendProofs == null) {
          throw new Error("could not serialize proofs.");
        }
        proofsStore.setReserved(sendProofs, true);
        await this.addOutgoingPendingInvoiceToHistory(quote, serializedSendProofs);

        // NUT-08 blank outputs for change
        const counter = this.keysetCounter(keysetId);

        // QUIRK: we increase the keyset counter by sendProofs and the maximum number of possible change outputs
        // this way, in case the user exits the app before payLnInvoice is completed, the returned change outputs won't cause a "outputs already signed" error
        // if the payment fails, we decrease the counter again
        this.increaseKeysetCounter(keysetId, sendProofs.length);
        if (quote.fee_reserve > 0) {
          countChangeOutputs = Math.ceil(Math.log2(quote.fee_reserve)) || 1;
          this.increaseKeysetCounter(keysetId, countChangeOutputs);
          keysetCounterIncrease += countChangeOutputs;
        }

        // NOTE: if the user exits the app while we're in the API call, JS will emit an error that we would catch below!
        // We have to handle that case in the catch block below
        const data = await this.wallet.payLnInvoice(invoice, sendProofs, quote, { keysetId, counter })

        if (data.isPaid != true) {
          throw new Error("Invoice not paid.");
        }
        // everything we handed over minus the change (includes any mint fee)
        let amount_paid = proofsStore.sumProofs(sendProofs) - proofsStore.sumProofs(data.change)
        if (!!window.navigator.vibrate) navigator.vibrate(200);

        notifySuccess(
          this.payInvoiceData.sweep
            ? "Moved " + uIStore.formatCurrency(quote.amount, mintStore.activeUnit) + " to your wallet"
            : "Paid " + uIStore.formatCurrency(amount_paid, mintStore.activeUnit) + " via Lightning"
        );
        console.log("#### pay lightning: token paid");
        // delete spent tokens from db
        mintStore.removeProofs(sendProofs);

        // NUT-08 get change
        if (data.change != null) {
          const changeProofs = data.change;
          console.log(
            "## Received change: " + proofsStore.sumProofs(changeProofs)
          );
          mintStore.addProofs(changeProofs);
        }

        tokenStore.addPaidToken({
          amount: -amount_paid,
          serializedProofs: serializedSendProofs,
          unit: mintStore.activeUnit,
          mint: mintStore.activeMintUrl,
        });

        this.updateInvoiceInHistory(quote, { status: "paid", amount: -amount_paid })

        this.payInvoiceData.invoice = { sat: 0, memo: "", bolt11: "" };
        this.payInvoiceData.show = false;
        return data;
      } catch (error: any) {
        if (isUnloading) {
          // NOTE: An error is thrown when the user exits the app while the payment is in progress.
          // do not handle the error if the user exits the app
          throw error;
        }
        // get quote and check state
        const mintQuote = await mintStore.activeMint().api.checkMeltQuote(quote.quote);
        if (mintQuote.state == MeltQuoteState.PAID || mintQuote.state == MeltQuoteState.PENDING) {
          console.log("### melt: error, but quote is paid or pending. not rolling back.");
          // don't leave a Pay button up for a payment that's on its way
          notifyWarning(
            mintQuote.state == MeltQuoteState.PAID ? "The payment went through" : "The payment is still on its way",
            "The connection dropped before it finished. Check your history in a minute."
          );
          this.payInvoiceData.show = false;
          throw error;
        }
        // roll back proof management and keyset counter
        proofsStore.setReserved(sendProofs, false);
        this.increaseKeysetCounter(keysetId, -keysetCounterIncrease);
        this.removeOutgoingInvoiceFromHistory(quote.quote)

        console.error(error);
        this.handleOutputsHaveAlreadyBeenSignedError(keysetId, error);
        notifyApiError(error, "Payment failed");
        throw error;
      } finally {
        uIStore.unlockMutex();
      }
    },
    getProofState: async function (proofs: Proof[]) {
      const mintStore = useMintsStore();
      const enc = new TextEncoder();
      const Ys = proofs.map((p) => hashToCurve(enc.encode(p.secret)).toHex(true));
      const payload = { Ys: Ys };
      const { states } = await new CashuMint(mintStore.activeMintUrl).check(payload);
      return states;
    },
    // /check
    checkProofsSpendable: async function (proofs: Proof[], update_history = false) {
      /*
      checks with the mint whether an array of proofs is still
      spendable or already invalidated
      */
      const mintStore = useMintsStore();
      const proofsStore = useProofsStore();
      const tokenStore = useTokensStore();
      if (proofs.length == 0) {
        return;
      }
      const enc = new TextEncoder();
      const payload: CheckStatePayload = {
        // Ys is hashToCurve of the secret of proofs
        Ys: proofs.map((p) => hashToCurve(enc.encode(p.secret)).toHex(true)),
      };
      try {
        const spentProofs = await this.wallet.checkProofsSpent(proofs);
        // const data = await mintStore.activeMint().api.check(payload);
        // mintStore.assertMintError(data);
        if (spentProofs.length) {
          mintStore.removeProofs(spentProofs);

          // update UI
          const serializedProofs = proofsStore.serializeProofs(spentProofs);
          if (serializedProofs == null) {
            throw new Error("could not serialize proofs.");
          }
          if (update_history) {
            tokenStore.addPaidToken({
              amount: -proofsStore.sumProofs(spentProofs),
              serializedProofs: serializedProofs,
              unit: mintStore.activeUnit,
              mint: mintStore.activeMintUrl,
            });
          }
        }
        // return unspent proofs
        return spentProofs;
      } catch (error: any) {
        console.error(error);
        notifyApiError(error);
        throw error;
      }
    },
    /**
     * Quietly checks which of the given tokens have been claimed (all proofs
     * spent) with one request per mint. Claimed tokens are marked as paid in
     * the history. Returns one boolean per token.
     */
    checkTokensClaimed: async function (tokenStrs: string[]): Promise<boolean[]> {
      const enc = new TextEncoder();
      const decoded = tokenStrs.map((t) => {
        const tokenJson = token.decode(t);
        return { mint: token.getMint(tokenJson), proofs: token.getProofs(tokenJson) };
      });
      const spentYs = new Set<string>();
      const mintUrls = [...new Set(decoded.map((d) => d.mint))];
      for (const mintUrl of mintUrls) {
        const Ys = decoded
          .filter((d) => d.mint === mintUrl)
          .flatMap((d) => d.proofs)
          .map((p) => hashToCurve(enc.encode(p.secret)).toHex(true));
        const { states } = await new CashuMint(mintUrl).check({ Ys });
        states
          .filter((s) => s.state === CheckStateEnum.SPENT)
          .forEach((s) => spentYs.add(s.Y));
      }
      return decoded.map((d, i) => {
        const claimed = d.proofs.every((p) =>
          spentYs.has(hashToCurve(enc.encode(p.secret)).toHex(true))
        );
        if (claimed) {
          tokenStore.setTokenPaid(tokenStrs[i]);
        }
        return claimed;
      });
    },
    /**
     * Takes back ecash we sent that nobody claimed. The token's history entry
     * is removed since the ecash never left the wallet.
     */
    reclaimToken: async function (tokenStr: string) {
      receiveStore.receiveData.tokensBase64 = tokenStr;
      await this.redeem();
      tokenStore.deleteToken(tokenStr);
    },
    checkTokenSpendable: async function (tokenStr: string, verbose: boolean = true) {
      /*
      checks whether a base64-encoded token (from the history table) has been spent already.
      if it is spent, the appropraite entry in the history table is set to paid.
      */
      const uIStore = useUiStore();
      const mintStore = useMintsStore();
      const tokenStore = useTokensStore();
      const proofsStore = useProofsStore();

      const tokenJson = token.decode(tokenStr);
      if (tokenJson == undefined) {
        throw new Error("no tokens provided.");
      }
      const proofs = token.getProofs(tokenJson);

      // activate the mint
      const mintInToken = token.getMint(tokenJson);
      await mintStore.activateMintUrl(mintInToken);

      const spentProofs = await this.checkProofsSpendable(proofs);
      if (spentProofs != undefined && spentProofs.length == proofs.length) {
        // all proofs are spent, set token to paid
        tokenStore.setTokenPaid(tokenStr);
      } else if (spentProofs != undefined && spentProofs.length && spentProofs.length < proofs.length) {
        // not all proofs are spent, we remove the spent part of the token from the history
        const spentAmount = proofsStore.sumProofs(spentProofs);
        const serializedSpentProofs = proofsStore.serializeProofs(spentProofs);
        const unspentProofs = proofs.filter(p => !spentProofs.find(sp => sp.secret === p.secret))
        const unspentAmount = proofsStore.sumProofs(unspentProofs);
        const serializedUnspentProofs = proofsStore.serializeProofs(unspentProofs);

        if (serializedSpentProofs && serializedUnspentProofs) {
          const historyToken = tokenStore.editHistoryToken(tokenStr, { newAmount: spentAmount, newStatus: "paid", newToken: serializedSpentProofs })
          // add all unspent proofs back to the history
          // QUICK: we use the historyToken object here because we don't know if the transaction is incoming or outgoing (we don't know the sign of the amount)
          if (historyToken) {
            tokenStore.addPendingToken({
              amount: unspentAmount * Math.sign(historyToken.amount),
              serializedProofs: serializedUnspentProofs,
              unit: historyToken.unit,
              mint: historyToken.mint,
            });
          }
        }

      }
      if (spentProofs != undefined && spentProofs.length) {
        if (!!window.navigator.vibrate) navigator.vibrate(200);
        const proofStore = useProofsStore();
        notifySuccess("Sent " + uIStore.formatCurrency(proofStore.sumProofs(spentProofs), mintStore.activeUnit));
      } else {
        console.log("### token not paid yet");
        if (verbose) {
          notify("Token still pending");
        }
        return false;
      }
      return true;
    },
    checkInvoice: async function (quote: string, verbose = true) {
      const uIStore = useUiStore();
      const mintStore = useMintsStore();
      console.log("### checkInvoice.quote", quote);
      const invoice = this.invoiceHistory.find((i) => i.quote === quote);
      if (!invoice) {
        throw new Error("invoice not found");
      }
      try {
        // activate the mint
        await mintStore.activateMintUrl(invoice.mint, false, false, invoice.unit);

        const proofs = await this.mint(invoice.amount, invoice.quote, verbose);
        if (!!window.navigator.vibrate) navigator.vibrate(200);
        notifySuccess("Received " + uIStore.formatCurrency(invoice.amount, mintStore.activeUnit) + " via Lightning");
        return proofs;
      } catch (error) {
        if (verbose) {
          notify("Invoice still pending");
        }
        console.log("Invoice still pending", invoice.quote);
        throw error;
      }
    },
    checkOutgoingInvoice: async function (quote: string, verbose = true) {
      const uIStore = useUiStore();
      const mintStore = useMintsStore();
      const invoice = this.invoiceHistory.find((i) => i.quote === quote);
      if (!invoice) {
        throw new Error("invoice not found");
      }
      try {
        await mintStore.activateMintUrl(invoice.mint, false, false, invoice.unit);
        // this is an outgoing invoice, we first do a getMintQuote to check if the invoice is paid
        const mintQuote = await mintStore.activeMint().api.checkMeltQuote(quote);
        console.log("### mintQuote", mintQuote);
        if (mintQuote.state != MeltQuoteState.PAID) {
          console.log("### mintQuote not paid yet");
          if (invoice.token) {
            const tokenJson = token.decode(invoice.token);
            if (tokenJson == undefined) {
              throw new Error("no tokens provided.");
            }
            let proofs = token.getProofs(tokenJson);
            if (proofs.length == 0) {
              throw new Error("no proofs found.");
            }
            const states = await this.getProofState(proofs);
            // if all proofs are CheckStateEnum.PENDING, we notify that the invoice is still pending
            if (states.every((s) => s.state === CheckStateEnum.PENDING)) {
              if (verbose) {
                notify("Invoice still pending");
              }
              throw new Error("invoice not paid yet.");
            }
            // if all proofs are CheckStateEnum.UNSPENT, we assume that the payment failed and we unset the proofs as reserved
            // and remove the invoice from the history
            if (states.every((s) => s.state === CheckStateEnum.UNSPENT)) {
              useProofsStore().setReserved(proofs, false);
              this.removeOutgoingInvoiceFromHistory(quote);
              notifyWarning("Lightning payment failed");
            }
            //
          } else {
            throw new Error("no token in invoice.");
          }
        } else {
          // if the invoice is paid, we check if all proofs are spent and if so, we invalidate them and set the invoice state in the history to "paid"
          if (invoice.token) {
            const tokenJson = token.decode(invoice.token);
            if (tokenJson == undefined) {
              throw new Error("no tokens provided.");
            }
            let proofs = token.getProofs(tokenJson);
            if (proofs.length == 0) {
              throw new Error("no proofs found.");
            }
            const spentProofs = await this.checkProofsSpendable(proofs, true);
            if (spentProofs != undefined && spentProofs.length == proofs.length) {
              if (!!window.navigator.vibrate) navigator.vibrate(200);
              notifySuccess("Sent " + uIStore.formatCurrency(useProofsStore().sumProofs(spentProofs), mintStore.activeUnit));
            }
            // set invoice in history to paid
            this.setInvoicePaid(quote);
          }
        }
      } catch (error: any) {
        if (verbose) {
          notifyApiError(error);
        }
        console.log("Could not check quote", invoice.quote, error);
        throw error;
      }
    },
    ////////////// UI HELPERS //////////////
    addOutgoingPendingInvoiceToHistory: function (quote: MeltQuoteResponse, serlializedToken?: string) {
      const mintStore = useMintsStore();
      this.invoiceHistory.push({
        amount: -(quote.amount + quote.fee_reserve),
        bolt11: this.payInvoiceData.input.request,
        quote: quote.quote,
        memo: "Outgoing invoice",
        date: currentDateStr(),
        status: "pending",
        mint: mintStore.activeMintUrl,
        token: serlializedToken,
      });
    },
    removeOutgoingInvoiceFromHistory: function (quote: string) {
      const index = this.invoiceHistory.findIndex((i) => i.quote === quote);
      if (index >= 0) {
        this.invoiceHistory.splice(index, 1);
      }
    },
    updateInvoiceInHistory: function (quote: MeltQuoteResponse, options?: { status?: "pending" | "paid", amount?: number }) {
      this.invoiceHistory.filter((i) => i.quote === quote.quote).forEach((i) => {
        if (options) {
          if (options.status) {
            i.status = options.status;
          }
          if (options.amount) {
            i.amount = options.amount;
          }
        }
      }
      );
    },
    // checkPendingInvoices: async function (verbose: boolean = true) {
    //   const last_n = 10;
    //   let i = 0;
    //   for (const invoice of this.invoiceHistory.slice().reverse()) {
    //     if (i >= last_n) {
    //       break;
    //     }
    //     if (invoice.status === "pending" && invoice.amount > 0) {
    //       console.log("### checkPendingInvoices", invoice.quote)
    //       try {
    //         await this.checkInvoice(invoice.quote, verbose);
    //       } catch (error) {
    //         console.log(`${invoice.quote} still pending`);
    //         throw error;
    //       }
    //     }
    //     i += 1;
    //   }
    // },
    checkPendingTokens: async function (verbose: boolean = true) {
      const tokenStore = useTokensStore();
      const last_n = 5;
      let i = 0;
      // invert for loop
      for (const t of tokenStore.historyTokens.slice().reverse()) {
        if (i >= last_n) {
          break;
        }
        if (t.status === "pending" && t.amount < 0) {
          console.log("### checkPendingTokens", t.token)
          this.checkTokenSpendable(t.token, verbose);
          i += 1;
        }
      }
    },
    handleBolt11Invoice: async function () {
      this.payInvoiceData.show = true;
      // never show (or pay) the quote of the previous invoice
      this.payInvoiceData.meltQuote.error = "";
      this.payInvoiceData.meltQuote.response = { quote: "", amount: 0, fee_reserve: 0 } as MeltQuoteResponse;
      let invoice;
      try {
        invoice = bolt11Decoder.decode(this.payInvoiceData.input.request);
      } catch (error) {
        // stay on the pay screen with the text, so it can be fixed
        notifyWarning("That invoice can't be read", "Check that all of it was copied, or scan it again.");
        this.payInvoiceData.invoice = null;
        throw error;
      }
      let cleanInvoice = {
        bolt11: invoice.paymentRequest,
        memo: "",
        msat: 0,
        sat: 0,
        fsat: 0,
        hash: "",
        description: "",
        timestamp: 0,
        expireDate: "",
        expired: false,
      };
      _.each(invoice.sections, (tag) => {
        if (_.isObject(tag) && _.has(tag, "name")) {
          if (tag.name === "amount") {
            cleanInvoice.msat = tag.value;
            cleanInvoice.sat = tag.value / 1000;
            cleanInvoice.fsat = cleanInvoice.sat;
          } else if (tag.name === "payment_hash") {
            cleanInvoice.hash = tag.value;
          } else if (tag.name === "description") {
            cleanInvoice.description = tag.value;
          } else if (tag.name === "timestamp") {
            cleanInvoice.timestamp = tag.value;
          } else if (tag.name === "expiry") {
            var expireDate = new Date(
              (cleanInvoice.timestamp + tag.value) * 1000
            );
            cleanInvoice.expireDate = date.formatDate(
              expireDate,
              "YYYY-MM-DDTHH:mm:ss.SSSZ"
            );
            cleanInvoice.expired = false; // TODO
          }
        }
      });

      this.payInvoiceData.invoice = Object.freeze(cleanInvoice);
      // get quote for this request
      await this.meltQuote()
    },
    handleCashuToken: function (fromClaimLink = false) {
      this.payInvoiceData.show = false;
      if (fromClaimLink) {
        // a printed treat card, scanned from inside the wallet
        receiveStore.fromClaimLink = true;
        receiveStore.showClaimTreat = true;
      } else {
        receiveStore.showReceiveTokens = true;
      }
    },
    handleP2PK: function (req: string) {
      notifyWarning("Locking ecash to a public key isn't supported in this wallet.");
    },
    decodeRequest: async function (req: string) {
      const p2pkStore = useP2PKStore()
      req = (req || "").trim()
      // a new payment: forget the Lightning address of the last one
      this.payInvoiceData.lnurlpay = null
      this.payInvoiceData.input.request = req
      // invoices, LNURLs and Lightning addresses, in whatever form a store's
      // QR code puts them (upper case, lightning: links, bitcoin: QR codes)
      const ln = parseLightningRequest(req);
      if (ln?.type === "bolt11") {
        this.payInvoiceData.input.request = ln.value;
        await this.handleBolt11Invoice()
      } else if (ln) {
        this.payInvoiceData.input.request = ln.value;
        await this.lnurlPayFirst(ln.value);
      } else if (req.indexOf("cashuA") !== -1) {
        // very dirty way of parsing cashu tokens from either a pasted token or a URL like https://host.com?token=eyJwcm
        receiveStore.receiveData.tokensBase64 = extractToken(req, "cashuA");
        this.handleCashuToken(/[?&]token=cashu/.test(req))
      } else if (req.indexOf("cashuB") !== -1) {
        receiveStore.receiveData.tokensBase64 = extractToken(req, "cashuB");
        this.handleCashuToken(/[?&]token=cashu/.test(req))
      } else if (p2pkStore.isValidPubkey(req)) {
        this.handleP2PK(req)
      } else if (
        req.startsWith("http")
      ) {
        const mintStore = useMintsStore();
        mintStore.addMintData = { url: req, nickname: "" }
      } else if (/^bitcoin:|^(bc1|[13])[a-z0-9]{25,}$/i.test(req)) {
        notifyWarning("That's an on-chain bitcoin address", "This wallet pays over Lightning. Ask for a Lightning QR code.");
      } else if (req) {
        notifyWarning("Couldn't read that code", "Scan or paste a Lightning invoice or address.");
      }
    },
    /**
     * True when some of a token's ecash is spent already, i.e. somebody
     * claimed the treat before us. Only asks the mint, history stays as is.
     */
    isTokenSpent: async function (tokenStr: string): Promise<boolean> {
      const tokenJson = token.decode(tokenStr);
      if (!tokenJson) {
        throw new Error("no token");
      }
      const enc = new TextEncoder();
      const Ys = token
        .getProofs(tokenJson)
        .map((p) => hashToCurve(enc.encode(p.secret)).toHex(true));
      const { states } = await new CashuMint(token.getMint(tokenJson)).check({ Ys });
      return states.some((s) => s.state === CheckStateEnum.SPENT);
    },
    fetchBitcoinPriceUSD: async function () {
      var { data } = await axios.get(
        "https://api.coinbase.com/v2/exchange-rates?currency=BTC"
      );
      return data.data.rates.USD;
    },
    lnurlPayFirst: async function (address: string) {
      var host;
      var data
      try {
        if (address.split("@").length == 2) {
          let [user, lnaddresshost] = address.split("@");
          host = `https://${lnaddresshost}/.well-known/lnurlp/${user}`;
          const resp = await axios.get(host); // Moved it here: we don't want 2 potential calls
          data = resp.data;
        } else if (address.toLowerCase().slice(0, 6) === "lnurl1") {
          let decoded = bech32.decode(address, 20000);
          const words = bech32.fromWords(decoded.words);
          const uint8Array = new Uint8Array(words);
          host = new TextDecoder().decode(uint8Array);

          const resp = await axios.get(host);
          data = resp.data;
        }
      } catch (error) {
        console.error(error);
        // a typo, or the service is down: say so instead of doing nothing
        notifyWarning(
          address.includes("@") ? `Couldn't find ${address}` : "Couldn't open that LNURL",
          "Check the spelling and your internet connection, then try again."
        );
        return;
      }
      if (host == undefined) {
        notifyError("Invalid LNURL", "LNURL Error");
        return;
      }
      if (data?.tag == "payRequest") {
        // start from a clean slate, then fill in what the service tells us
        this.payInvoiceData.invoice = null;
        this.payInvoiceData.input = {
          request: "",
          amount: null,
          comment: "",
          quote: "",
        };
        let domain = String(host);
        try {
          domain = new URL(host).host;
        } catch (e) {
          // keep the raw address
        }
        const lnurlpay: LnurlPayRequest = {
          ...data,
          domain,
          // what the person typed or scanned, to show it and to go back to it
          address: address.includes("@") ? address : "",
          source: address,
        };
        this.payInvoiceData.lnurlpay = lnurlpay;
        if (lnurlpay.maxSendable == lnurlpay.minSendable) {
          this.payInvoiceData.input.amount = lnurlpay.maxSendable / 1000;
        }
        this.payInvoiceData.show = true;
      } else {
        notifyWarning("That isn't a Lightning payment request", data?.reason || "");
      }
    },
    /**
     * Gets an invoice for the entered amount from the Lightning address and
     * quotes it. The Lightning address stays, so the amount can be changed
     * and tried again. Returns true when there's an invoice to confirm.
     */
    lnurlPaySecond: async function (): Promise<boolean> {
      const mintStore = useMintsStore();
      const lnurlpay = this.payInvoiceData.lnurlpay;
      let amount = this.payInvoiceData.input.amount;
      if (lnurlpay == null || lnurlpay.tag != "payRequest") {
        notifyError("No LNURL data", "LNURL Error");
        return false;
      }
      if (amount == null || !(amount > 0)) {
        notifyWarning("Enter an amount");
        return false;
      }
      if (mintStore.activeUnit == "usd") {
        try {
          var priceUsd = await this.fetchBitcoinPriceUSD();
        } catch (e) {
          notifyError(
            "Couldn't get Bitcoin price",
            "fetchBitcoinPriceUSD Error"
          );
          return false;
        }

        const satPrice = 1 / (priceUsd / 1e8);
        const usdAmount = amount;
        amount = Math.floor(usdAmount * satPrice);
        console.log(`converted amount: ${amount}`);
      }
      const minSat = Math.ceil(lnurlpay.minSendable / 1000);
      const maxSat = Math.floor(lnurlpay.maxSendable / 1000);
      if (amount < minSat || amount > maxSat) {
        notifyWarning(
          minSat == maxSat
            ? `${lnurlpay.domain} only takes exactly ${minSat} sat`
            : `${lnurlpay.domain} takes ${minSat} to ${maxSat} sat`,
          "Change the amount and try again."
        );
        return false;
      }
      const params = new URLSearchParams({ amount: String(amount * 1000) });
      const comment = (this.payInvoiceData.input.comment || "").trim();
      const commentAllowed = lnurlpay.commentAllowed ?? 0;
      if (comment && commentAllowed > 0) {
        params.set("comment", comment.slice(0, commentAllowed));
      }
      // some services put their own query in the callback already
      const sep = lnurlpay.callback.includes("?") ? "&" : "?";
      let data;
      try {
        ({ data } = await axios.get(`${lnurlpay.callback}${sep}${params}`));
      } catch (error) {
        console.error(error);
        notifyWarning(
          `Couldn't get an invoice from ${lnurlpay.domain}`,
          "Check your internet connection and try again."
        );
        return false;
      }
      // check http error
      if (data.status == "ERROR") {
        notifyError(data.reason, "LNURL Error");
        return false;
      }
      console.log(`callback: ${lnurlpay.callback}`);
      const ln = parseLightningRequest(data.pr || "");
      if (ln?.type !== "bolt11") {
        notifyError(`${lnurlpay.domain} sent back something that isn't an invoice`);
        return false;
      }
      // the invoice has to be for the amount we asked for (LUD-06)
      try {
        const invoiceMsat = bolt11Decoder
          .decode(ln.value)
          .sections.find((sec: any) => sec.name === "amount")?.value;
        if (Number(invoiceMsat) !== amount * 1000) {
          notifyError(`${lnurlpay.domain} sent an invoice for a different amount`, "Not paying it, to be safe.");
          return false;
        }
      } catch (e) {
        notifyError(`${lnurlpay.domain} sent an invoice that can't be read`);
        return false;
      }
      // not through decodeRequest: that would forget the Lightning address
      this.payInvoiceData.input.request = ln.value;
      await this.handleBolt11Invoice();
      return true;
    },
    /**
     * Opens the pay screen to move all sats to the person's own wallet,
     * starting from the address they used last time.
     */
    openMoveSats: function () {
      this.payInvoiceData.invoice = null;
      this.payInvoiceData.lnurlpay = null;
      this.payInvoiceData.meltQuote.error = "";
      this.payInvoiceData.input = {
        request: this.moveAddress || "",
        amount: null,
        comment: "",
        quote: "",
      };
      this.payInvoiceData.sweep = true;
      this.payInvoiceData.show = true;
    },
    /**
     * Back from confirming a Lightning address payment to its amount, with
     * the address kept.
     */
    changeLnurlAmount: function () {
      this.payInvoiceData.invoice = null;
      this.payInvoiceData.input.request = "";
      this.payInvoiceData.meltQuote.error = "";
      this.payInvoiceData.meltQuote.response = { quote: "", amount: 0, fee_reserve: 0 } as MeltQuoteResponse;
    },
    /**
     * Back to the start of the pay screen, keeping what was typed so a typo
     * can be fixed.
     */
    restartPayment: function (keepText = true) {
      const source = this.payInvoiceData.lnurlpay?.source || "";
      this.changeLnurlAmount();
      this.payInvoiceData.lnurlpay = null;
      this.payInvoiceData.input.amount = null;
      this.payInvoiceData.input.comment = "";
      this.payInvoiceData.input.request = keepText ? source : "";
    },
    generateNewMnemonic: function () {
      if (this.mnemonic == "") {
        this.mnemonic = generateNewMnemonic();
      }
      return this.mnemonic
    },
    handleOutputsHaveAlreadyBeenSignedError: function (keysetId: string, error: any) {
      if (error.message.includes("outputs have already been signed")) {
        this.increaseKeysetCounter(keysetId, 10);
        notify("Please try again.");
        return true;
      }
      return false;
    },
  },
});
