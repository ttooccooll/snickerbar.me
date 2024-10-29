<template>
  <q-dialog
    v-model="showSendTokens"
    position="top"
    backdrop-filter="blur(2px) brightness(60%)"
    no-backdrop-dismiss
    maximized
  >
    <q-card class="q-pa-none q-pt-none qcard">
      <!--  enter send data -->
      <div v-if="!sendData.tokens">
        <q-card-section class="q-pa-md q-pt-md">
          <div class="row items-center no-wrap q-my-sm q-py-none">
            <div class="col-12">
              <q-input
                type="number"
                v-model.number="sendData.amount1"
                :label="'Amount 1 (' + tickerShort + ') *'"
                mask="#"
                fill-mask="0"
                reverse-fill-mask
                round
                outlined
                autofocus
                class="q-mb-md"
              />
            </div>
          </div>
          <div class="row items-center no-wrap q-my-sm q-py-none">
            <div class="col-12">
              <q-input
                type="number"
                v-model.number="sendData.amount2"
                :label="'Amount 2 (' + tickerShort + ') *'"
                mask="#"
                fill-mask="0"
                reverse-fill-mask
                round
                outlined
                autofocus
                class="q-mb-md"
              />
            </div>
          </div>
          <div class="row items-center no-wrap q-my-sm q-py-none">
            <div class="col-12">
              <q-input
                type="number"
                v-model.number="sendData.amount3"
                :label="'Amount 3 (' + tickerShort + ') *'"
                mask="#"
                fill-mask="0"
                reverse-fill-mask
                round
                outlined
                autofocus
                class="q-mb-md"
              />
            </div>
          </div>
          <div class="row items-center no-wrap q-my-sm q-py-none">
            <div class="col-12">
              <q-input
                type="number"
                v-model.number="sendData.amount4"
                :label="'Amount 4 (' + tickerShort + ') *'"
                mask="#"
                fill-mask="0"
                reverse-fill-mask
                round
                outlined
                autofocus
                class="q-mb-md"
              />
            </div>
          </div>
          <div class="row items-center no-wrap q-my-sm q-py-none">
            <div class="col-12">
              <q-input
                type="number"
                v-model.number="sendData.amount5"
                :label="'Amount 5 (' + tickerShort + ') *'"
                mask="#"
                fill-mask="0"
                reverse-fill-mask
                round
                outlined
                autofocus
                class="q-mb-md"
              />
            </div>
          </div>
          <div class="row items-center no-wrap q-my-sm q-py-none">
            <div class="col-12">
              <ChooseMint :ticker-short="tickerShort" />
            </div>
          </div>
          <!-- <q-input
                filled
                dense
                v-model.trim="sendData.memo"
                label="Memo"
                ></q-input> -->
          <transition
            appear
            enter-active-class="animated fadeIn"
            leave-active-class="animated fadeOut"
          >
            <div v-if="showLockInput" class="row items-center no-wrap">
              <div :class="!sendData.p2pkPubkey ? 'col-8' : 'col-12'">
                <q-input
                  v-model="sendData.p2pkPubkey"
                  :label="
                    sendData.p2pkPubkey && !isValidPubkey(sendData.p2pkPubkey)
                      ? 'Invalid public key'
                      : 'Receiver public key'
                  "
                  outlined
                  clearable
                  :color="
                    sendData.p2pkPubkey && !isValidPubkey(sendData.p2pkPubkey)
                      ? 'red'
                      : ''
                  "
                  @keyup.enter="lockTokens"
                ></q-input>
              </div>
              <div class="col-4 q-mx-md">
                <q-btn
                  unelevated
                  v-if="canPasteFromClipboard && !sendData.p2pkPubkey"
                  icon="content_paste"
                  @click="pasteToP2PKField"
                  ><q-tooltip>Paste</q-tooltip></q-btn
                >
                <q-btn
                  align="center"
                  v-if="!sendData.p2pkPubkey"
                  icon="qr_code_scanner"
                  flat
                  outline
                  color="primary"
                  round
                  @click="showCamera"
                />
              </div>
            </div>
          </transition>
          <div
            v-if="activeMintBalance() >= sendData.amount"
            class="row q-mt-lg"
          >
            <q-btn
              v-if="!sendData.tokens"
              :disable="
                sendData.amount1 == null ||
                sendData.amount1 <= 0 ||
                sendData.amount2 == null ||
                sendData.amount2 <= 0 ||
                sendData.amount3 == null ||
                sendData.amount3 <= 0 ||
                sendData.amount4 == null ||
                sendData.amount4 <= 0 ||
                sendData.amount5 == null ||
                sendData.amount5 <= 0
              "
              @click="sendTokens"
              color="primary"
              rounded
              type="submit"
              :loading="globalMutexLock"
              >Send
              <template v-slot:loading>
                <q-spinner-hourglass />
              </template>
            </q-btn>
            <div
              v-if="sendData.p2pkPubkey && isValidPubkey(sendData.p2pkPubkey)"
              class="row"
            >
              <transition
                appear
                enter-active-class="animated fadeIn"
                leave-active-class="animated fadeOut"
              >
                <q-chip
                  outline
                  color="primary"
                  icon="lock"
                  class="q-ml-md q-pa-md"
                >
                  Locked
                </q-chip>
                <!-- <q-btn rounded flat color="primary" icon="lock">Locked</q-btn> -->
              </transition>
            </div>
            <transition
              appear
              enter-active-class="animated fadeIn"
              leave-active-class="animated fadeOut"
            >
              <q-btn
                v-if="
                  sendData.amount > 0 &&
                  !showLockInput &&
                  activeMintBalance() >= sendData.amount
                "
                :disable="sendData.p2pkPubkey == null || sendData.amount <= 0"
                color="primary"
                class="q-ml-sm"
                rounded
                flat
                @click="showLockInput = true"
              >
                <!-- <q-icon size="xs" class="q-mr-xs" name="lock" />  -->
                Lock</q-btn
              >
            </transition>
            <q-btn v-close-popup rounded flat color="grey" class="q-ml-auto"
              >Close</q-btn
            >
          </div>
          <div v-else class="row q-mt-lg">
            <q-btn unelevated rounded disabled color="yellow" text-color="black"
              >Mint balance too low</q-btn
            >
            <q-btn v-close-popup rounded flat color="grey" class="q-ml-auto"
              >Close</q-btn
            >
          </div>
        </q-card-section>
      </div>

      <!-- show ecash details -->
      <div v-else class="text-center q-mb-xs black-background">
        <q-card-section class="q-pa-none q-pt-md">
          <div class="row justify-center">
            <div
              v-for="(token, index) in sendData.tokens"
              :key="index"
              class="col-5"
              style="margin: 5px; width: 200px"
            >
              <div class="text-center q-mb-md">
                <q-responsive :ratio="1" class="q-mx-none" style="width: 200px">
                  <vue-qrcode
                    :value="token"
                    :options="{
                      width: 200,
                      color: {
                        dark: '#000000',
                        light: '#6c5ce7',
                      },
                    }"
                    class="rounded-borders"
                    style="margin: 0; padding: 0"
                    @click="copyText(token)"
                  >
                  </vue-qrcode>
                </q-responsive>
              </div>
              <q-card-section class="q-pa-sm">
                <div class="row justify-center">
                  <q-item-label
                    overline
                    class="q-mb-sm"
                    style="
                      color: orange;
                      font-size: 25px;
                      margin: 0;
                      padding: 0;
                    "
                    >Happy Halloween!</q-item-label
                  >
                </div>
                <div class="row justify-center q-py-md">
                  <q-item-label
                    style="color: darkorange; font-size: 12px"
                    class="text-weight-bold"
                  >
                    <strong
                      >This one's for the parents. The slime green QR code below
                      is a link to cashu.me, which is a bitcoin ecash wallet.
                      With that wallet, scan the vampire purple QR code above
                      for {{ tokenAmounts[index] }} sats of real bitcoin. Any
                      other cashu wallet will work as well. Just make sure the
                      QR code is perfectly flat and your camera lens is clean.
                    </strong></q-item-label
                  >
                </div>
                <div class="row justify-center">
                  <q-item-label
                    overline
                    class="q-mb-sm"
                    style="
                      color: orange;
                      font-size: 12px;
                      margin: 5px;
                      padding: 0;
                    "
                    >Free cashu.me wallet:</q-item-label
                  >
                </div>
                <vue-qrcode
                  :value="'https://cashu.me'"
                  :options="{
                    width: 100,
                    color: {
                      light: '#33CC33',
                      dark: '#000',
                    },
                  }"
                  class="rounded-borders"
                  style="margin: 0; padding: 0"
                >
                </vue-qrcode>
                <div class="row justify-center">
                  <q-item-label
                    overline
                    class="q-mb-sm"
                    style="
                      color: orange;
                      font-size: 12px;
                      margin: 5px;
                      padding: 0;
                    "
                    >Find out why bitcoin is such a big deal:</q-item-label
                  >
                </div>
                <vue-qrcode
                  :value="'https://youtu.be/24waV3Fwvow?si=yNBx0t5TXD6GhwwC'"
                  :options="{
                    width: 100,
                    color: {
                      light: '#6c5ce7',
                      dark: '#000',
                    },
                  }"
                  class="rounded-borders"
                  style="margin: 0; padding: 0"
                >
                </vue-qrcode>
              </q-card-section>
            </div>
          </div>
          <div class="row q-mt-lg">
            <q-btn
              class="q-mx-none"
              style="color: darkorange"
              icon="delete"
              size="md"
              @click="showDeleteDialog = true"
              flat
            >
              <q-tooltip>Delete from history</q-tooltip>
            </q-btn>
            <q-btn
              class="q-mx-none"
              style="color: darkorange"
              size="md"
              icon="print"
              flat
              @click="printPage"
            ></q-btn>
            <q-btn
              @click="showSendTokens = false"
              flat
              style="color: orange"
              class="q-ml-auto"
              >Close</q-btn
            >
          </div>
        </q-card-section>
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
import { useSendTokensStore } from "src/stores/sendTokensStore";
import { useWalletStore } from "src/stores/wallet";
import { useUiStore } from "src/stores/ui";
import { useProofsStore } from "src/stores/proofs";
import { useMintsStore } from "src/stores/mints";
import { useTokensStore } from "src/stores/tokens";
import { getShortUrl } from "src/js/wallet-helpers";
import { useSettingsStore } from "src/stores/settings";
import { useWorkersStore } from "src/stores/workers";
import token from "src/js/token";
import { Buffer } from "buffer";
import { useCameraStore } from "src/stores/camera";
import { useP2PKStore } from "src/stores/p2pk";
import TokenInformation from "components/TokenInformation.vue";
import {
  getDecodedToken,
  getEncodedTokenV4,
  getEncodedToken,
} from "@cashu/cashu-ts";

import { mapActions, mapState, mapWritableState } from "pinia";
import ChooseMint from "components/ChooseMint.vue";
import { UR, UREncoder } from "@gandlaf21/bc-ur";

export default defineComponent({
  name: "SendTokenDialog",
  mixins: [windowMixin],
  components: {
    ChooseMint,
  },
  props: {},
  data: function () {
    return {};
  },
  computed: {
    ...mapWritableState(useSendTokensStore, [
      "showSendTokens",
      "showLockInput",
    ]),
    ...mapWritableState(useSendTokensStore, ["sendData"]),
    ...mapWritableState(useCameraStore, ["camera", "hasCamera"]),
    ...mapState(useUiStore, [
      "tickerShort",
      "canPasteFromClipboard",
      "globalMutexLock",
    ]),
    ...mapState(useMintsStore, [
      "activeProofs",
      "activeUnit",
      "activeUnitLabel",
      "activeMintUrl",
      "activeMintBalance",
    ]),
    ...mapState(useSettingsStore, ["checkSentTokens"]),
    ...mapState(useWorkersStore, ["tokenWorkerRunning"]),
    // TOKEN METHODS
    sumProofs: function () {
      let sum = 0;
      for (let i = 0; i < this.sendData.tokens.length; i++) {
        let token = this.sendData.tokens[i];
        let decodedToken = this.decodeToken(token);
        let proofs = this.getProofs(decodedToken);
        sum += proofs.flat().reduce((sum, el) => (sum += el.amount), 0);
      }
      return sum;
    },
    displayUnit: function () {
      let unit = "";
      for (let i = 0; i < this.sendData.tokens.length; i++) {
        let token = this.sendData.tokens[i];
        let decodedToken = this.decodeToken(token);
        unit = this.getUnit(decodedToken);
      }
      return unit;
    },
    tokenAmounts: function () {
      return [
        this.sendData.amount1,
        this.sendData.amount2,
        this.sendData.amount3,
        this.sendData.amount4,
        this.sendData.amount5,
      ];
    },
    tokenUnit: function () {
      let unit = token.getUnit(token.decode(this.sendData.tokensBase64));
      return unit;
    },
    tokenMintUrl: function () {
      let mint = token.getMint(token.decode(this.sendData.tokensBase64));
      return mint;
    },
    displayMemo: function () {
      return token.getMemo(token.decode(this.sendData.tokensBase64));
    },
    shortUrl: function () {
      return getShortUrl(this.tokenMintUrl);
    },
    decodedToken: function () {
      return token.decode(this.sendData.tokensBase64);
    },
    runnerActive: function () {
      return this.tokenWorkerRunning;
    },
    canSpendOffline: function () {
      if (!this.sendData.amount) {
        return false;
      }
      // check if entered amount is the same as the result of coinSelect(spendableProofs(activeProofs), amount)
      let spendableProofs = this.spendableProofs(this.activeProofs);
      let selectedProofs = this.coinSelect(
        spendableProofs,
        this.sendData.amount
      );
      const sumSelectedProofs = selectedProofs
        .flat()
        .reduce((sum, el) => (sum += el.amount), 0);
      return sumSelectedProofs == this.sendData.amount;
    },
  },
  watch: {
    "sendData.tokensBase64": function (val) {
      this.showAnimatedQR = false;
      if (!val.length) {
        // it's emptied
        return;
      }
      // check if token has more than one proof
      const tokenObj = token.decode(val);
      const proofs = tokenObj.token[0].proofs;
      if (!proofs.length) {
        // no proofs
        return;
      } else if (proofs.length <= 2) {
        // we can display a single QR code
        this.qrCodeFragment = val;
      } else {
        // we need to split the token into multiple QR codes
        this.showAnimatedQR = true;
        this.qrCodeFragment = "";
        this.startQrCodeLoop();
      }
      // set isV4Token to true if token starts with 'cashuB'
      this.isV4Token = val.startsWith("cashuB");
    },
    showSendTokens: function (val) {
      if (val) {
        // this.startQrCodeLoop();
      } else {
        clearInterval(this.qrInterval);
        this.sendData.data = "";
        this.sendData.tokensBase64 = "";
      }
    },
  },
  methods: {
    ...mapActions(useWorkersStore, [
      "checkTokenSpendableWorker",
      "clearAllWorkers",
    ]),
    ...mapActions(useWalletStore, [
      "splitToSend",
      "sendToLock",
      "coinSelect",
      "spendableProofs",
    ]),
    ...mapActions(useProofsStore, ["serializeProofs"]),
    ...mapActions(useTokensStore, [
      "addPendingToken",
      "setTokenPaid",
      "deleteToken",
    ]),
    ...mapActions(useP2PKStore, ["isValidPubkey"]),
    ...mapActions(useCameraStore, ["closeCamera", "showCamera"]),
    ...mapActions(useMintsStore, ["toggleUnit"]),
    // decodeP2PKQR: function (res) {
    //   console.log("### SendToken qr", res);
    //   this.camera.data = res;
    //   this.camera.show = false;
    //   // this.decodeRequest(res);
    //   this.p2pkInput = res;
    //   return;
    //   if (isValidPubkey(res)) {
    //     this.sendData.p2pkPubkey = res;
    //   } else {
    //     this.notifyError("No valid key");
    //   }
    // },
    decodeToken: function (encoded_token) {
      return token.decode(encoded_token);
    },
    getProofs: function (decoded_token) {
      return token.getProofs(decoded_token);
    },
    getAmount: function (decoded_token) {
      return token.getAmount(decoded_token);
    },
    getUnit: function (decoded_token) {
      return token.getUnit(decoded_token);
    },
    getMint: function (decoded_token) {
      return token.getMint(decoded_token);
    },
    printPage: function () {
      window.print();
    },
    startQrCodeLoop: async function () {
      if (this.sendData.tokensBase64.length == 0) {
        return;
      }
      const messageBuffer = Buffer.from(this.sendData.tokensBase64);
      const ur = UR.fromBuffer(messageBuffer);
      const firstSeqNum = 0;
      this.encoder = new UREncoder(ur, this.currentFragmentLength, firstSeqNum);
      clearInterval(this.qrInterval);
      this.qrInterval = setInterval(() => {
        this.qrCodeFragment = this.encoder.nextPart();
      }, this.currentFragmentInterval);
    },
    updateQrCode: function () {
      this.qrCodeFragment = this.encoder.nextPart();
    },
    changeSpeed: function () {
      // cycle currentFragmentInterval between slow, medium and fast
      if (this.currentFragmentInterval == this.fragmentIntervalMedium) {
        this.currentFragmentInterval = this.framentInervalSlow;
        this.fragmentSpeedLabel = "S";
      } else if (this.currentFragmentInterval == this.framentInervalSlow) {
        this.currentFragmentInterval = this.fragmentIntervalFast;
        this.fragmentSpeedLabel = "F";
      } else {
        this.currentFragmentInterval = this.fragmentIntervalMedium;
        this.fragmentSpeedLabel = "M";
      }
      console.log(
        "### this.currentFragmentInterval",
        this.currentFragmentInterval
      );
      this.startQrCodeLoop();
    },
    changeSize: function () {
      // cycle currentFragmentLength between short, medium and long
      if (this.currentFragmentLength == this.fragmentLengthMedium) {
        this.currentFragmentLength = this.fragmentLengthShort;
        this.fragmentLengthLabel = "S";
      } else if (this.currentFragmentLength == this.fragmentLengthShort) {
        this.currentFragmentLength = this.fragmentLengthLong;
        this.fragmentLengthLabel = "L";
      } else {
        this.currentFragmentLength = this.fragmentLengthMedium;
        this.fragmentLengthLabel = "M";
      }
      console.log("### this.currentFragmentLength", this.currentFragmentLength);
      this.startQrCodeLoop();
    },
    toggleTokenEncoding: function () {
      const decodedToken = getDecodedToken(this.sendData.tokensBase64);
      // if the token starts with 'cashuA', it is a v3 token
      // if it starts with 'cashuB', it is a v4 token
      if (this.sendData.tokensBase64.startsWith("cashuA")) {
        try {
          this.sendData.tokensBase64 = getEncodedTokenV4(decodedToken);
        } catch {
          console.log("### Could not encode token to V4");
          this.sendData.tokensBase64 = getEncodedToken(decodedToken);
        }
      } else {
        this.sendData.tokensBase64 = getEncodedToken(decodedToken);
      }
    },
    deleteThisToken: function () {
      this.deleteToken(this.sendData.tokensBase64);
      this.showSendTokens = false;
      this.showDeleteDialog = false;
      this.clearAllWorkers();
    },
    lockTokens: async function () {
      let sendAmount = this.sendData.amount;
      // if unit is USD, multiply by 100
      if (this.activeUnit === "usd" || this.activeUnit == "eur") {
        sendAmount = sendAmount * 100;
      }
      try {
        // keep firstProofs, send scndProofs and delete them (invalidate=true)
        let { _, sendProofs } = await this.sendToLock(
          this.activeProofs,
          sendAmount,
          this.sendData.p2pkPubkey
        );
        // update UI
        this.sendData.tokens = sendProofs;
        console.log("### this.sendData.tokens", this.sendData.tokens);

        this.sendData.tokensBase64 = this.serializeProofs(sendProofs);
        this.addPendingToken({
          amount: -this.sendData.amount,
          serializedProofs: this.sendData.tokensBase64,
          unit: this.activeUnit,
          mint: this.activeMintUrl,
        });

        if (!this.g.offline) {
          this.checkTokenSpendableWorker(this.sendData.tokensBase64);
        }
      } catch (error) {
        console.error(error);
      }
    },
    sendTokens: async function () {
      let tokenAmounts = [
        this.sendData.amount1,
        this.sendData.amount2,
        this.sendData.amount3,
        this.sendData.amount4,
        this.sendData.amount5,
        this.sendData.amount6,
        this.sendData.amount7,
        this.sendData.amount8,
        this.sendData.amount9,
        this.sendData.amount10,
      ];

      let tokens = [];

      for (let i = 0; i < tokenAmounts.length; i++) {
        let sendAmount = tokenAmounts[i];

        try {
          let { _, sendProofs } = await this.splitToSend(
            this.activeProofs,
            sendAmount,
            true
          );

          if (sendProofs.length > 0) {
            let token = this.serializeProofs(sendProofs);
            tokens.push(token);

            this.addPendingToken({
              amount: -sendAmount,
              serializedProofs: token,
              unit: this.activeUnit,
              mint: this.activeMintUrl,
            });

            if (!this.g.offline) {
              this.checkTokenSpendableWorker(token);
            }
          } else {
            console.log(`No proofs generated for amount ${sendAmount}`);
          }
        } catch (error) {
          console.error(error);
        }
      }

      this.sendData.tokens = tokens;
    },
  },
});
</script>
