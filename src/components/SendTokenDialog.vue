<template>
  <q-dialog
    v-model="showSendTokens"
    :position="$q.screen.lt.sm ? 'standard' : 'top'"
    backdrop-filter="blur(2px) brightness(60%)"
    no-backdrop-dismiss
    :maximized="sendData.tokens.length > 0 || $q.screen.lt.sm"
  >
    <!-- ////////////////// FILL THE TREAT BAG ////////////////// -->
    <q-card
      v-if="!sendData.tokens.length"
      class="qcard treat-form column no-wrap"
    >
      <q-card-section class="col treat-form__body">
        <div class="row items-center no-wrap q-mb-md">
          <div class="col-12">
            <span class="text-h6 spooky-title">Fill your treat bag</span>
            <div class="text-caption text-grey-5">
              Each treat becomes a printable card with a bitcoin QR code.
            </div>
          </div>
        </div>

        <q-input
          v-model.number="treatSettings.count"
          type="number"
          inputmode="numeric"
          label="How many treats?"
          :min="1"
          :max="maxTreats"
          outlined
          class="q-mb-md"
        />

        <q-btn-toggle
          v-model="treatSettings.mode"
          spread
          no-caps
          rounded
          unelevated
          toggle-color="primary"
          class="q-mb-md treat-mode-toggle"
          :options="[
            { label: 'Same for all', value: 'same' },
            { label: 'Mystery 🎲', value: 'mystery' },
            { label: 'Custom', value: 'custom' },
          ]"
        />

        <div v-if="treatSettings.mode === 'same'">
          <q-input
            v-model.number="treatSettings.amount"
            type="number"
            inputmode="numeric"
            :label="'Amount per treat (' + tickerShort + ')'"
            outlined
            class="q-mb-sm"
          />
          <div class="q-mb-sm">
            <q-chip
              v-for="preset in presets"
              :key="preset"
              clickable
              outline
              color="primary"
              @click="treatSettings.amount = preset"
              >{{ preset }}</q-chip
            >
          </div>
        </div>

        <div v-else-if="treatSettings.mode === 'mystery'" class="row q-mb-sm">
          <div class="col-6 q-pr-xs">
            <q-input
              v-model.number="treatSettings.minAmount"
              type="number"
              :label="'Min (' + tickerShort + ')'"
              outlined
            />
          </div>
          <div class="col-6 q-pl-xs">
            <q-input
              v-model.number="treatSettings.maxAmount"
              type="number"
              :label="'Max (' + tickerShort + ')'"
              outlined
            />
          </div>
          <div class="col-12 text-caption text-grey-5 q-mt-xs">
            Every treat gets a random amount. Some kids hit the jackpot!
          </div>
        </div>

        <div v-else class="row q-mb-sm">
          <div
            v-for="i in customSlots"
            :key="i"
            class="col-6 q-pb-sm"
            :class="i % 2 ? 'q-pr-xs' : 'q-pl-xs'"
          >
            <q-input
              v-model.number="treatSettings.customAmounts[i - 1]"
              type="number"
              dense
              outlined
              :label="'Treat ' + i + ' (' + tickerShort + ')'"
            />
          </div>
        </div>

        <div
          v-if="scanTip"
          class="text-caption text-grey-5 q-mb-md"
          data-test="scan-tip"
        >
          {{ scanTip }}
        </div>

        <q-input
          v-model="treatSettings.message"
          label="Message on the cards"
          maxlength="40"
          outlined
          class="q-mb-md"
        />

        <div class="text-caption q-mb-xs">QR code on the cards</div>
        <q-btn-toggle
          v-model="treatSettings.qrStyle"
          spread
          no-caps
          rounded
          unelevated
          toggle-color="primary"
          class="q-mb-xs"
          :options="[
            { label: 'Claim link', value: 'link' },
            { label: 'Raw ecash token', value: 'token' },
          ]"
        />
        <div class="text-caption text-grey-5 q-mb-md">
          <span v-if="treatSettings.qrStyle === 'link'"
            >Works with any phone camera: it opens {{ claimHost }} and claims
            the treat. No app needed.</span
          >
          <span v-else
            >Needs a Cashu wallet app to scan. Smaller QR codes.</span
          >
        </div>
        <q-expansion-item
          v-if="treatSettings.qrStyle === 'link'"
          dense
          dense-toggle
          label="Claim link settings"
          class="q-mb-md text-caption"
        >
          <q-input
            v-model.trim="treatSettings.claimBaseUrl"
            :placeholder="defaultClaimBaseUrl"
            label="Wallet that opens the link"
            type="url"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
            :hint="`Leave empty to use ${defaultClaimBaseUrl}. The ecash is added as ?token=…, or put {token} where it goes.`"
            outlined
            dense
            class="q-mt-sm"
          />
        </q-expansion-item>
        <div
          v-if="claimLinkWarning"
          class="text-warning text-body2 q-mb-md"
          data-test="claim-link-warning"
        >
          ⚠️ {{ claimLinkWarning }}
        </div>

        <ChooseMint :ticker-short="tickerShort" />
        <div
          v-if="feeNote"
          class="text-caption text-grey-5 q-mt-sm"
          data-test="fee-note"
        >
          {{ feeNote }}
        </div>
      </q-card-section>

      <!-- always in reach of a thumb, also with the keyboard up -->
      <q-card-section class="treat-form__footer">
        <div class="row items-center">
          <div class="col-12 text-body2">
            <span v-if="planError" class="text-warning">{{ planError }}</span>
            <span v-else>
              {{ treatSettings.count }} treat{{
                treatSettings.count == 1 ? "" : "s"
              }}
              ·
              <span v-if="treatSettings.mode === 'mystery'">up to </span>
              <b>{{ formatCurrency(bagTotal, activeUnit, true) }}</b>
              <span class="text-grey-5">
                · balance
                {{ formatCurrency(mintBalance, activeUnit, true) }}</span
              >
            </span>
          </div>
          <div
            v-if="insufficientBalance"
            class="col-12 text-body2 text-warning q-mt-xs"
            data-test="bag-too-big"
          >
            That's {{ formatCurrency(shortfall, activeUnit, true) }} more than
            this wallet has<span v-if="makingFeeEstimate">, with the fees</span
            >.
          </div>
        </div>

        <div class="row no-wrap items-center q-mt-sm">
          <q-btn
            v-if="!insufficientBalance"
            color="primary"
            rounded
            unelevated
            class="treat-form__fill"
            :disable="!!planError || !!claimLinkWarning || filling"
            :loading="filling"
            @click="fillBag"
            data-test="fill-bag"
            >Fill the bag
            <template v-slot:loading>
              <q-spinner-hourglass class="q-mr-sm" />
              Wrapping {{ fillProgress.done + 1 }}/{{ fillProgress.total }}
            </template>
          </q-btn>
          <!-- one tap to make what the balance pays for -->
          <q-btn
            v-else-if="fitCount >= 1"
            color="primary"
            rounded
            unelevated
            no-caps
            class="treat-form__fill"
            data-test="bag-fit"
            @click="treatSettings.count = fitCount"
            >Make {{ fitCount }} treat{{
              fitCount == 1 ? "" : "s"
            }}
            instead</q-btn
          >
          <q-btn
            v-else
            unelevated
            rounded
            disabled
            color="yellow"
            text-color="black"
            class="treat-form__fill"
            >Mint balance too low</q-btn
          >
          <q-btn v-close-popup rounded flat color="grey" class="q-ml-sm"
            >Close</q-btn
          >
        </div>
      </q-card-section>
    </q-card>

    <!-- ////////////////// TREAT SHEET ////////////////// -->
    <q-card v-else class="treat-sheet-card">
      <div class="treat-toolbar no-print">
        <div class="treat-toolbar__summary">
          <span class="spooky-title text-h6">{{
            isSingle ? "Treat" : "Treat bag"
          }}</span>
          <span class="q-ml-sm">
            {{ sendData.tokens.length }} ·
            {{ formatCurrency(sheetTotal, sheetUnit, true) }}
          </span>
          <q-chip
            v-if="claimedCount !== null"
            dense
            color="deep-purple-4"
            text-color="white"
            class="q-ml-sm"
            data-test="claimed-count"
            >👻 {{ claimedCount }}/{{ sendData.tokens.length }} claimed</q-chip
          >
        </div>
        <div
          class="treat-toolbar__actions"
          :class="{ 'treat-toolbar__actions--compact': compactToolbar }"
        >
          <q-btn
            v-if="!isSingle"
            unelevated
            dense
            no-caps
            :rounded="!compactToolbar"
            :flat="compactToolbar"
            :stack="compactToolbar"
            :color="compactToolbar ? undefined : 'deep-orange'"
            :text-color="compactToolbar ? 'deep-orange-4' : undefined"
            :class="compactToolbar ? '' : 'q-px-sm q-mr-xs'"
            icon="door_front"
            :label="compactToolbar ? 'Porch' : 'Porch mode'"
            data-test="porch-btn"
            @click="showPorch = true"
            ><q-tooltip
              >Show one big QR code at a time on this screen, perfect for a
              tablet at the door</q-tooltip
            ></q-btn
          >
          <q-btn
            flat
            dense
            no-caps
            :stack="compactToolbar"
            icon="print"
            @click="printPage"
            label="Print"
          />
          <q-btn
            v-if="!isSingle"
            flat
            dense
            no-caps
            :stack="compactToolbar"
            icon="campaign"
            label="Sign"
            :class="{ 'treat-toolbar__on': treatSettings.trunkSign }"
            data-test="trunk-sign-toggle"
            @click="treatSettings.trunkSign = !treatSettings.trunkSign"
            ><q-tooltip>{{
              treatSettings.trunkSign
                ? "Don't print the trunk sign"
                : 'Also print a big "Free Bitcoin Treats" sign for your trunk'
            }}</q-tooltip></q-btn
          >
          <q-btn
            flat
            dense
            no-caps
            :stack="compactToolbar"
            :icon="
              treatSettings.inkSaver ? 'invert_colors_off' : 'invert_colors'
            "
            :label="compactToolbar ? 'Ink' : undefined"
            @click="treatSettings.inkSaver = !treatSettings.inkSaver"
            ><q-tooltip>{{
              treatSettings.inkSaver ? "Spooky dark cards" : "Ink saver"
            }}</q-tooltip></q-btn
          >
          <q-btn
            flat
            dense
            no-caps
            :stack="compactToolbar"
            icon="refresh"
            :label="compactToolbar ? 'Check' : undefined"
            :loading="checkingClaims"
            @click="checkClaims(true)"
            ><q-tooltip>Check which treats were claimed</q-tooltip></q-btn
          >
          <q-btn
            v-if="isSingle"
            flat
            dense
            no-caps
            :stack="compactToolbar"
            icon="content_copy"
            :label="compactToolbar ? 'Copy' : undefined"
            @click="copyText(sendData.tokens[0])"
            ><q-tooltip>Copy token</q-tooltip></q-btn
          >
          <q-btn
            v-if="unclaimedPendingTokens.length"
            flat
            dense
            no-caps
            :stack="compactToolbar"
            icon="undo"
            :label="compactToolbar ? 'Take back' : undefined"
            :loading="reclaiming"
            @click="showReclaimDialog = true"
            ><q-tooltip>Take back unclaimed treats</q-tooltip></q-btn
          >
          <q-btn
            v-if="isSingle"
            flat
            dense
            no-caps
            :stack="compactToolbar"
            icon="delete"
            :label="compactToolbar ? 'Delete' : undefined"
            @click="showDeleteDialog = true"
            ><q-tooltip>Delete from history</q-tooltip></q-btn
          >
          <q-btn
            flat
            dense
            no-caps
            :stack="compactToolbar"
            :icon="compactToolbar ? 'close' : undefined"
            @click="showSendTokens = false"
            label="Close"
          />
        </div>
      </div>
      <TrunkSign
        v-if="treatSettings.trunkSign && !isSingle"
        :ink-saver="treatSettings.inkSaver"
      />
      <div
        class="treat-sheet"
        :class="{
          'treat-sheet--ink-saver': treatSettings.inkSaver,
          'treat-sheet--single': isSingle,
        }"
      >
        <TreatCard
          v-for="(t, index) in sendData.tokens"
          :key="t"
          :token="t"
          :number="isSingle ? null : index + 1"
          :mascot-index="index"
          :message="treatSettings.message"
          :qr-style="treatSettings.qrStyle"
          :claim-base-url="claimBaseUrl"
          :claimed="!!claimed[index]"
          :ink-saver="treatSettings.inkSaver"
          @copy="copyText"
        />
      </div>
    </q-card>
  </q-dialog>

  <PorchMode
    v-model="showPorch"
    :tokens="sendData.tokens"
    :claimed="claimed"
    :message="treatSettings.message"
    :qr-style="treatSettings.qrStyle"
    :claim-base-url="claimBaseUrl"
    :sound="treatSettings.sound"
    :refilling="filling"
    @toggle-sound="treatSettings.sound = !treatSettings.sound"
    @refill="fillBag"
  />

  <!-- confirm taking back unclaimed treats -->
  <q-dialog v-model="showReclaimDialog">
    <q-card class="q-pa-lg q-pt-md qcard">
      <div class="text-h6 q-mb-sm">Take back unclaimed treats?</div>
      <p>
        {{ unclaimedPendingTokens.length }} unclaimed treat{{
          unclaimedPendingTokens.length == 1 ? "" : "s"
        }}
        will go back into your wallet. The printed QR codes stop working.
      </p>
      <div class="row q-mt-lg">
        <q-btn color="primary" rounded v-close-popup @click="reclaimUnclaimed"
          >Take back</q-btn
        >
        <q-btn v-close-popup rounded flat color="grey" class="q-ml-auto"
          >Cancel</q-btn
        >
      </div>
    </q-card>
  </q-dialog>

  <!-- popup dialog to confirm deletion activated by showDeleteDialog -->
  <q-dialog v-model="showDeleteDialog">
    <q-card class="q-pa-lg q-pt-md qcard">
      <q-card-section class="q-pa-none">
        <div class="row items-center no-wrap q-mb-sm">
          <div class="col-12">
            <span class="text-h6">Delete Ecash</span>
          </div>
        </div>
        <div class="row items-center no-wrap q-my-sm q-py-none">
          <div class="col-12">
            <q-item-label>
              Are you sure you want to delete this transaction from your
              history?
            </q-item-label>
            <q-item-label class="q-pt-md text-weight-bold">
              Warning: This action cannot be undone and there is no way to
              recover the token.
            </q-item-label>
          </div>
        </div>
        <div class="row q-mt-lg">
          <q-btn
            @click="deleteThisToken"
            color="negative"
            rounded
            class="q-mr-sm"
            >Delete</q-btn
          >
          <q-btn v-close-popup rounded flat color="grey" class="q-ml-auto"
            >Cancel</q-btn
          >
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
<script>
import { defineComponent } from "vue";
import { mapActions, mapState, mapWritableState } from "pinia";
import { useSendTokensStore } from "src/stores/sendTokensStore";
import { useWalletStore } from "src/stores/wallet";
import { useUiStore } from "src/stores/ui";
import { useProofsStore } from "src/stores/proofs";
import { useMintsStore } from "src/stores/mints";
import { useTokensStore } from "src/stores/tokens";
import { notifyError, notifySuccess, notifyWarning } from "src/js/notify";
import token from "src/js/token";
import { feeForCount } from "src/js/fees";
import {
  MAX_TREATS,
  claimLinkProblem,
  defaultClaimBase,
  maxBagTotal,
  noteCount,
  planTreatAmounts,
} from "src/js/treats";
import ChooseMint from "components/ChooseMint.vue";
import TreatCard from "components/TreatCard.vue";
import PorchMode from "components/PorchMode.vue";
import TrunkSign from "components/TrunkSign.vue";

// how often the open treat sheet asks the mint which treats were claimed
const CLAIM_POLL_MS = 20000;
// porch mode moves on to the next treat as soon as one is claimed
const PORCH_POLL_MS = 4000;

export default defineComponent({
  name: "SendTokenDialog",
  mixins: [windowMixin],
  components: {
    ChooseMint,
    TreatCard,
    PorchMode,
    TrunkSign,
  },
  data: function () {
    return {
      maxTreats: MAX_TREATS,
      presets: [8, 16, 21, 32, 64, 100],
      filling: false,
      fillProgress: { done: 0, total: 0 },
      claimed: [],
      checkingClaims: false,
      claimPoll: null,
      showPorch: false,
      reclaiming: false,
      showReclaimDialog: false,
      showDeleteDialog: false,
      // never "localhost": phones have to be able to open the printed links
      defaultClaimBaseUrl: defaultClaimBase(window.location),
    };
  },
  computed: {
    ...mapWritableState(useSendTokensStore, [
      "showSendTokens",
      "sendData",
      "treatSettings",
    ]),
    ...mapState(useUiStore, ["tickerShort"]),
    ...mapState(useMintsStore, [
      "activeProofs",
      "activeUnit",
      "activeMintUrl",
      "activeMintBalance",
      "activeMint",
    ]),
    ...mapState(useTokensStore, ["historyTokens"]),
    compactToolbar: function () {
      return this.$q.screen.lt.sm;
    },
    isSingle: function () {
      return this.sendData.tokens.length === 1 && !!this.sendData.tokensBase64;
    },
    customSlots: function () {
      const count = Number(this.treatSettings.count) || 0;
      return Math.max(0, Math.min(count, MAX_TREATS));
    },
    planError: function () {
      try {
        // a fixed random source keeps this computed pure
        planTreatAmounts(this.treatSettings, () => 0);
        return "";
      } catch (e) {
        return e.message;
      }
    },
    bagTotal: function () {
      return this.toBaseUnit(maxBagTotal(this.treatSettings));
    },
    mintBalance: function () {
      try {
        return this.activeMintBalance();
      } catch (e) {
        // no mint joined yet
        return 0;
      }
    },
    insufficientBalance: function () {
      return (
        !this.planError &&
        this.bagTotal + this.makingFeeEstimate > this.mintBalance
      );
    },
    shortfall: function () {
      return Math.max(
        0,
        this.bagTotal + this.makingFeeEstimate - this.mintBalance
      );
    },
    fitCount: function () {
      // as many treats of this size as the balance pays for, fees included
      if (this.treatSettings.mode !== "same") {
        return 0;
      }
      const each =
        this.toBaseUnit(Number(this.treatSettings.amount) || 0) +
        feeForCount(4, this.mintFeePpk);
      if (!(each > 0)) {
        return 0;
      }
      return Math.min(MAX_TREATS, Math.floor(this.mintBalance / each));
    },
    mintFeePpk: function () {
      // the NUT-02 fee (parts per thousand sats per note) of this mint's
      // keysets we'd be spending from
      let keysets = [];
      try {
        keysets = this.activeMint().mint.keysets.filter(
          (k) => k.unit === this.activeUnit
        );
      } catch (e) {
        return 0;
      }
      const heldIds = new Set(this.activeProofs.map((p) => p.id));
      return keysets
        .filter((k) => k.active || heldIds.has(k.id))
        .reduce((max, k) => Math.max(max, Number(k.input_fee_ppk) || 0), 0);
    },
    makingFeeEstimate: function () {
      // making a treat usually spends a few notes
      const count = Number(this.treatSettings.count) || 0;
      return count * feeForCount(4, this.mintFeePpk);
    },
    feeNote: function () {
      if (!this.mintFeePpk) {
        return "";
      }
      const s = this.treatSettings;
      const biggest =
        s.mode === "mystery"
          ? Number(s.maxAmount) || 0
          : s.mode === "custom"
          ? Math.max(0, ...(s.customAmounts || []).map((a) => Number(a) || 0))
          : Number(s.amount) || 0;
      const claimFee = feeForCount(
        Math.max(1, noteCount(this.toBaseUnit(biggest))),
        this.mintFeePpk
      );
      const makeFee = feeForCount(4, this.mintFeePpk);
      return `This mint charges a small fee on every transaction. Making each treat costs you about ${makeFee} sat, and parents get about ${claimFee} sat less than the card says when they claim it.`;
    },
    scanTip: function () {
      if (this.treatSettings.mode !== "same") {
        return "";
      }
      const amount = Number(this.treatSettings.amount);
      if (!(amount > 0)) {
        return "";
      }
      const notes = noteCount(this.toBaseUnit(amount));
      if (notes <= 1) {
        return `${amount} fits in a single ecash note, so the QR codes stay small and scan easily.`;
      }
      return `Tip: ${amount} takes ${notes} ecash notes. Powers of two (8, 16, 32, 64, 128…) fit in one note, which makes QR codes smaller and easier to scan.`;
    },
    claimBaseUrl: function () {
      return this.treatSettings.claimBaseUrl || this.defaultClaimBaseUrl;
    },
    claimLinkWarning: function () {
      return this.treatSettings.qrStyle === "link"
        ? claimLinkProblem(this.claimBaseUrl)
        : "";
    },
    claimHost: function () {
      try {
        return new URL(this.claimBaseUrl).host;
      } catch (e) {
        return this.claimBaseUrl;
      }
    },
    sheetTotal: function () {
      return this.sendData.tokens.reduce(
        (sum, t) => sum + this.tokenAmount(t),
        0
      );
    },
    sheetUnit: function () {
      try {
        return token.getUnit(token.decode(this.sendData.tokens[0]));
      } catch (e) {
        return this.activeUnit;
      }
    },
    claimedCount: function () {
      if (this.claimed.length !== this.sendData.tokens.length) {
        return null;
      }
      return this.claimed.filter((c) => c).length;
    },
    unclaimedPendingTokens: function () {
      // only tokens we sent that are still waiting in the history can be taken back
      return this.sendData.tokens.filter((t, i) => {
        if (this.claimed[i]) {
          return false;
        }
        const h = this.historyTokens.find((ht) => ht.token === t);
        return h && h.status === "pending" && h.amount < 0;
      });
    },
  },
  watch: {
    showSendTokens: function (val) {
      if (val) {
        this.onSheetChanged();
      } else {
        this.showPorch = false;
        this.stopClaimPoll();
        this.claimed = [];
        this.sendData.tokens = [];
        this.sendData.tokensBase64 = "";
      }
    },
    "sendData.tokens": function () {
      this.onSheetChanged();
    },
    showPorch: function () {
      // poll faster while the porch display is up
      this.restartClaimPoll();
    },
  },
  beforeUnmount: function () {
    this.stopClaimPoll();
  },
  methods: {
    ...mapActions(useWalletStore, [
      "splitToSend",
      "checkTokensClaimed",
      "reclaimToken",
    ]),
    ...mapActions(useProofsStore, ["serializeProofs"]),
    ...mapActions(useUiStore, ["celebrate"]),
    ...mapActions(useTokensStore, ["addPendingToken", "deleteToken"]),
    toBaseUnit: function (amount) {
      // fiat units are stored in cents
      if (this.activeUnit === "usd" || this.activeUnit === "eur") {
        return Math.round(amount * 100);
      }
      return amount;
    },
    tokenAmount: function (t) {
      try {
        return token
          .getProofs(token.decode(t))
          .reduce((sum, p) => sum + p.amount, 0);
      } catch (e) {
        return 0;
      }
    },
    printPage: function () {
      window.print();
    },
    fillBag: async function () {
      let amounts;
      try {
        amounts = planTreatAmounts(this.treatSettings).map(this.toBaseUnit);
      } catch (e) {
        notifyWarning(e.message);
        return;
      }
      const total = amounts.reduce((sum, a) => sum + a, 0);
      if (total > this.mintBalance) {
        notifyWarning("Not enough balance for this bag of treats.");
        return;
      }

      this.filling = true;
      this.fillProgress = { done: 0, total: amounts.length };
      const tokens = [];
      try {
        for (const amount of amounts) {
          const { sendProofs } = await this.splitToSend(
            this.activeProofs,
            amount,
            true
          );
          const encoded = this.serializeProofs(sendProofs);
          if (!encoded) {
            throw new Error("Could not encode the ecash.");
          }
          tokens.push(encoded);
          this.addPendingToken({
            amount: -amount,
            serializedProofs: encoded,
            unit: this.activeUnit,
            mint: this.activeMintUrl,
          });
          this.fillProgress.done += 1;
        }
      } catch (error) {
        console.error(error);
        notifyError(
          `Only ${tokens.length} of ${amounts.length} treats could be made.`,
          "The rest of your balance is still in your wallet."
        );
      } finally {
        this.filling = false;
      }
      // nothing made (e.g. a refill from the porch failed): keep what's shown
      if (tokens.length) {
        this.sendData.tokensBase64 = "";
        this.sendData.tokens = tokens;
      }
    },
    onSheetChanged: function () {
      this.stopClaimPoll();
      this.claimed = [];
      if (!this.showSendTokens || !this.sendData.tokens.length) {
        return;
      }
      this.checkClaims(false);
      this.restartClaimPoll();
    },
    restartClaimPoll: function () {
      this.stopClaimPoll();
      if (!this.showSendTokens || !this.sendData.tokens.length) {
        return;
      }
      this.claimPoll = setInterval(
        () => this.checkClaims(false),
        this.showPorch ? PORCH_POLL_MS : CLAIM_POLL_MS
      );
    },
    stopClaimPoll: function () {
      if (this.claimPoll) {
        clearInterval(this.claimPoll);
        this.claimPoll = null;
      }
    },
    checkClaims: async function (verbose) {
      if (this.checkingClaims || !this.sendData.tokens.length) {
        return;
      }
      const tokens = this.sendData.tokens.slice();
      this.checkingClaims = true;
      try {
        const claimed = await this.checkTokensClaimed(tokens);
        // ignore the answer if the sheet changed in the meantime
        if (tokens.join() === this.sendData.tokens.join()) {
          this.announceNewClaims(this.claimed, claimed);
          this.claimed = claimed;
        }
      } catch (error) {
        console.error(error);
        if (verbose) {
          notifyError("Could not reach the mint to check treats.");
        }
      } finally {
        this.checkingClaims = false;
      }
    },
    announceNewClaims: function (before, after) {
      // the first check only tells us where we are, nothing new happened
      if (before.length !== after.length) {
        return;
      }
      const fresh = after
        .map((c, i) => (c && !before[i] ? i + 1 : null))
        .filter((n) => n !== null);
      if (!fresh.length) {
        return;
      }
      // porch mode throws its own party
      if (!this.showPorch) {
        this.celebrate();
        notifySuccess(
          fresh.length === 1 && !this.isSingle
            ? `👻 Treat #${fresh[0]} was just claimed!`
            : `👻 ${fresh.length} treat${
                fresh.length == 1 ? " was" : "s were"
              } just claimed!`
        );
      }
    },
    reclaimUnclaimed: async function () {
      this.reclaiming = true;
      // make sure nothing was claimed since the last check
      await this.checkClaims(false);
      const toReclaim = this.unclaimedPendingTokens.slice();
      let reclaimed = 0;
      for (const t of toReclaim) {
        try {
          await this.reclaimToken(t);
          reclaimed += 1;
        } catch (error) {
          console.error(error);
        }
      }
      this.reclaiming = false;
      if (reclaimed) {
        notifySuccess(
          `Took back ${reclaimed} treat${reclaimed == 1 ? "" : "s"}.`
        );
      }
      if (reclaimed < toReclaim.length) {
        notifyWarning(
          `${toReclaim.length - reclaimed} treat(s) could not be taken back.`
        );
      }
      if (reclaimed) {
        this.showSendTokens = false;
      }
    },
    deleteThisToken: function () {
      this.deleteToken(this.sendData.tokensBase64);
      this.showDeleteDialog = false;
      this.showSendTokens = false;
    },
  },
});
</script>
<style lang="scss">
body .q-dialog .treat-sheet-card {
  background: #07040b !important;
}

.treat-toolbar {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  padding: 8px 12px;
  background: #1a1025;
  color: #ffb347;
}

.treat-toolbar__on {
  background: rgba(255, 117, 24, 0.25);
}

.treat-toolbar__actions {
  display: flex;
  flex-wrap: wrap;
  margin-left: auto;
}

// phones: one row of icons with little labels, like a tab bar
.treat-toolbar__actions--compact {
  flex-wrap: nowrap;
  justify-content: space-between;
  width: 100%;
  margin-left: 0;

  .q-btn {
    flex: 1 1 0;
    min-width: 0;
    padding: 2px 0;
    font-size: 0.7rem;
    line-height: 1.1;
  }
}

.treat-form {
  // the body scrolls, the footer with "Fill the bag" stays put
  max-height: calc(100vh - 48px);
}

.q-dialog__inner--maximized > .treat-form {
  max-height: none;
}

.treat-form__body {
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.treat-form__footer {
  padding-top: 10px;
  padding-bottom: calc(14px + env(safe-area-inset-bottom));
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  background: inherit;
}

.treat-form__fill {
  flex: 1 1 auto;
  min-height: 48px;
  font-size: 1.05rem;
}

.treat-sheet {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
  padding: 16px;
}

.treat-sheet--single {
  grid-template-columns: minmax(0, 340px);
  justify-content: center;
}

.treat-sheet--ink-saver {
  background: #fff;
}

@media print {
  body .q-dialog .q-card.treat-sheet-card {
    background: #fff !important;
  }
  // inline blocks never get split over two pages, grid items can
  .treat-sheet {
    display: block !important;
    padding: 0 !important;
    text-align: center;
  }
}

.treat-mode-toggle {
  border: 1px solid rgba(255, 255, 255, 0.2);
}
</style>
