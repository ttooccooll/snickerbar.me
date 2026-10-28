<template>
  <q-dialog
    v-model="payInvoiceData.show"
    @hide="closeParseDialog"
    :position="$q.screen.lt.sm ? 'standard' : 'top'"
    :maximized="$q.screen.lt.sm"
    v-if="!camera.show"
    backdrop-filter="blur(2px) brightness(60%)"
    no-backdrop-dismiss
  >
    <q-card class="qcard pay-card column no-wrap">
      <!-- ////////////////// CONFIRM AN INVOICE ////////////////// -->
      <template v-if="payInvoiceData.invoice">
        <q-card-section class="col pay-card__body">
          <div class="row items-start no-wrap">
            <div class="col">
              <div class="text-subtitle1 text-grey-5">Pay with Lightning</div>
              <div
                v-if="quoteReady"
                class="pay-card__amount"
                data-test="pay-amount"
              >
                {{ formatCurrency(cost.amount, activeUnit, true) }}
              </div>
              <div
                v-else-if="payInvoiceData.meltQuote.error != ''"
                class="pay-card__error"
                data-test="pay-error"
              >
                {{ quoteErrorText }}
              </div>
              <div v-else class="pay-card__amount pay-card__amount--wait">
                <q-spinner-hourglass size="0.8em" /> Getting the price…
              </div>
              <div v-if="lnurlpay" class="pay-card__to">
                to <b>{{ lnurlpay.address || lnurlpay.domain }}</b>
              </div>
            </div>
            <ToggleUnit v-if="activeUnits.length > 1" class="q-mt-sm" />
          </div>
          <p
            v-if="payInvoiceData.invoice.description && !lnurlpay"
            class="text-wrap q-mt-md q-mb-none pay-card__memo"
          >
            “{{ payInvoiceData.invoice.description }}”
          </p>
          <div v-if="quoteReady" class="pay-card__costs" data-test="pay-costs">
            <div class="row">
              <span class="col">Lightning fee</span>
              <span
                >up to
                {{ formatCurrency(cost.feeReserve, activeUnit, true) }}</span
              >
            </div>
            <div v-if="cost.mintFee > 0" class="row">
              <span class="col">Mint fee</span>
              <span>{{ formatCurrency(cost.mintFee, activeUnit, true) }}</span>
            </div>
            <div class="row pay-card__total">
              <span class="col">Total</span>
              <span
                >up to {{ formatCurrency(cost.total, activeUnit, true) }}</span
              >
            </div>
            <div class="row text-grey-5">
              <span class="col">In your wallet</span>
              <span>{{ formatCurrency(cost.balance, activeUnit, true) }}</span>
            </div>
            <div class="text-caption text-grey-6 q-mt-xs">
              Whatever part of the Lightning fee isn't needed comes back.
            </div>
          </div>
          <div class="q-mt-md">
            <ChooseMint v-if="mints.length > 1" :ticker-short="tickerShort" />
          </div>
        </q-card-section>
        <q-card-section class="pay-card__footer">
          <!-- the price couldn't be worked out -->
          <template v-if="payInvoiceData.meltQuote.error != ''">
            <q-btn
              unelevated
              rounded
              no-caps
              color="primary"
              class="full-width pay-card__go"
              label="Try again"
              :loading="working"
              @click="retryQuote"
            />
          </template>
          <!-- too expensive with the fees -->
          <template v-else-if="quoteReady && !cost.enough">
            <div class="pay-card__low q-mb-sm" data-test="pay-too-low">
              Not enough for this payment with the fees: you have
              {{ formatCurrency(cost.balance, activeUnit, true) }}.
              <span v-if="lnurlpay && smallerAmount">
                You can send up to
                {{ formatCurrency(smallerAmount, activeUnit, true) }}.
              </span>
              <span v-else-if="lnurlpay">
                That's too little to send anything to this address.
              </span>
            </div>
            <q-btn
              v-if="lnurlpay && smallerAmount"
              unelevated
              rounded
              no-caps
              color="primary"
              class="full-width pay-card__go"
              :label="`Send ${formatCurrency(
                smallerAmount,
                activeUnit,
                true
              )} instead`"
              :loading="working"
              data-test="pay-smaller"
              @click="sendSmaller"
            />
          </template>
          <q-btn
            v-else
            unelevated
            rounded
            no-caps
            color="primary"
            class="full-width pay-card__go"
            :disabled="!quoteReady || working"
            @click="pay"
            :label="payLabel"
            :loading="working || (globalMutexLock && !payInvoiceData.blocking)"
            data-test="pay-btn"
          >
            <template v-slot:loading>
              <q-spinner-hourglass />
            </template>
          </q-btn>
          <q-btn
            v-if="lnurlpay"
            outline
            rounded
            no-caps
            color="primary"
            class="full-width q-mt-sm"
            label="Change amount"
            :disable="working"
            data-test="pay-change-amount"
            @click="changeLnurlAmount"
          />
          <q-btn
            v-else
            outline
            rounded
            no-caps
            color="primary"
            class="full-width q-mt-sm"
            icon="qr_code_scanner"
            label="Pay something else"
            :disable="working"
            data-test="pay-start-over"
            @click="restartPayment(false)"
          />
          <q-btn
            v-close-popup
            flat
            rounded
            no-caps
            color="grey"
            class="full-width q-mt-xs"
            label="Cancel"
            :disable="working"
          />
        </q-card-section>
      </template>

      <!-- ////////////////// LNURL / LIGHTNING ADDRESS ////////////////// -->
      <template v-else-if="lnurlpay">
        <q-card-section class="col pay-card__body">
          <q-form id="lnurl-amount-form" novalidate @submit="submitAmount">
            <div class="text-subtitle1 text-grey-5">Send to</div>
            <div class="pay-card__recipient" data-test="pay-recipient">
              {{ lnurlpay.address || lnurlpay.domain }}
            </div>
            <div
              class="row items-center q-mt-sm"
              v-if="lnurlText || lnurlImage"
            >
              <p
                v-if="lnurlText"
                class="col text-italic q-mb-none pay-card__memo"
              >
                {{ lnurlText }}
              </p>
              <div class="col-3 q-pl-md" v-if="lnurlImage">
                <q-img :src="lnurlImage" />
              </div>
            </div>
            <q-input
              outlined
              class="q-mt-lg"
              :autofocus="!$q.screen.lt.sm"
              v-model.number="payInvoiceData.input.amount"
              type="number"
              inputmode="numeric"
              :label="'Amount (' + tickerShort + ')'"
              :min="lnurlMin"
              :max="lnurlMax"
              :readonly="lnurlMin == lnurlMax"
              :hint="amountHint"
              :error="!!amountError"
              :error-message="amountError"
              data-test="pay-lnurl-amount"
            />
            <q-input
              v-if="lnurlpay.commentAllowed > 0"
              outlined
              class="q-mt-md"
              v-model="payInvoiceData.input.comment"
              label="Message (optional)"
              :maxlength="lnurlpay.commentAllowed"
            />
          </q-form>
        </q-card-section>
        <q-card-section class="pay-card__footer">
          <q-btn
            unelevated
            rounded
            no-caps
            color="primary"
            type="submit"
            form="lnurl-amount-form"
            class="full-width pay-card__go"
            label="Next"
            :loading="working"
            :disable="!(payInvoiceData.input.amount > 0) || !!amountError"
            data-test="pay-lnurl-next"
          />
          <q-btn
            outline
            rounded
            no-caps
            color="primary"
            class="full-width q-mt-sm"
            label="Back"
            :disable="working"
            data-test="pay-back"
            @click="restartPayment(true)"
          />
          <q-btn
            v-close-popup
            flat
            rounded
            no-caps
            color="grey"
            class="full-width q-mt-xs"
            label="Cancel"
            :disable="working"
          />
        </q-card-section>
      </template>

      <!-- ////////////////// SCAN OR PASTE ////////////////// -->
      <template v-else>
        <q-card-section class="col pay-card__body">
          <div class="row items-center no-wrap q-mb-md">
            <div class="col text-h6">Pay with Lightning</div>
            <q-btn
              v-close-popup
              flat
              round
              dense
              icon="close"
              color="grey"
              aria-label="Close"
            />
          </div>
          <q-btn
            v-if="payInvoiceData.input.request == ''"
            unelevated
            no-caps
            stack
            color="primary"
            class="full-width pay-card__scan"
            icon="qr_code_scanner"
            label="Scan a QR code"
            data-test="pay-scan"
            @click="showCamera"
          />
          <div
            v-if="payInvoiceData.input.request == ''"
            class="text-caption text-grey-5 text-center q-mt-sm q-mb-lg"
          >
            At a store? Scan their Lightning QR code to pay with your sats.
          </div>
          <q-form
            v-if="!camera.show"
            @submit="decodeAndQuote(payInvoiceData.input.request)"
          >
            <q-input
              ref="parseDialogInput"
              outlined
              v-model.trim="payInvoiceData.input.request"
              type="textarea"
              rows="3"
              label="Lightning invoice or address"
              autocapitalize="off"
              autocomplete="off"
              autocorrect="off"
              spellcheck="false"
              :autofocus="!$q.screen.lt.sm"
              @keydown.enter.prevent="
                decodeAndQuote(payInvoiceData.input.request)
              "
            >
              <template v-if="payInvoiceData.input.request" v-slot:append>
                <q-icon
                  name="close"
                  class="cursor-pointer"
                  @click="payInvoiceData.input.request = ''"
                />
              </template>
            </q-input>
            <div class="row q-mt-sm">
              <q-btn
                flat
                rounded
                no-caps
                color="primary"
                icon="content_paste"
                label="Paste"
                v-if="
                  canPasteFromClipboard && payInvoiceData.input.request == ''
                "
                @click="pasteToParseDialog"
              />
            </div>
            <q-btn
              v-if="payInvoiceData.input.request != ''"
              unelevated
              rounded
              no-caps
              color="primary"
              class="full-width pay-card__go q-mt-md"
              type="submit"
              label="Next"
              :loading="working"
              data-test="pay-next"
            />
          </q-form>
        </q-card-section>
      </template>
    </q-card>
  </q-dialog>
</template>
<script>
import { defineComponent } from "vue";
import { useWalletStore } from "src/stores/wallet";
import { useUiStore } from "src/stores/ui";
import { useCameraStore } from "src/stores/camera";
import { useMintsStore } from "src/stores/mints";
import { mapActions, mapState, mapWritableState } from "pinia";
import ChooseMint from "components/ChooseMint.vue";
import ToggleUnit from "components/ToggleUnit.vue";

// import * as bolt11Decoder from "light-bolt11-decoder";
import * as _ from "underscore";

export default defineComponent({
  name: "PayInvoiceDialog",
  mixins: [windowMixin],
  components: {
    ChooseMint,
    ToggleUnit,
  },
  props: {},
  data: function () {
    return {
      // looking up an address, getting an invoice or paying
      working: false,
    };
  },
  watch: {
    activeMintUrl: function () {
      this.requote();
    },
    activeUnit: function () {
      this.requote();
    },
  },
  computed: {
    ...mapState(useUiStore, ["tickerShort", "globalMutexLock"]),
    ...mapWritableState(useCameraStore, ["camera", "hasCamera"]),
    ...mapState(useWalletStore, ["payInvoiceData"]),
    ...mapState(useMintsStore, [
      "activeMintUrl",
      "activeProofs",
      "mints",
      "proofs",
      "activeUnit",
      "activeBalance",
      "activeMintBalance",
      "activeMint",
    ]),
    canPasteFromClipboard: function () {
      return (
        window.isSecureContext &&
        navigator.clipboard &&
        navigator.clipboard.readText
      );
    },
    lnurlpay: function () {
      return this.payInvoiceData.lnurlpay;
    },
    // LUD-06 metadata: [["text/plain", "Pay alice"], ["image/png;base64", …]]
    lnurlMetadata: function () {
      try {
        const metadata = JSON.parse(this.lnurlpay.metadata);
        return Array.isArray(metadata) ? metadata : [];
      } catch (e) {
        return [];
      }
    },
    lnurlText: function () {
      const entry = this.lnurlMetadata.find((m) => m[0] === "text/plain");
      return entry ? String(entry[1]) : "";
    },
    lnurlImage: function () {
      const entry = this.lnurlMetadata.find((m) =>
        /^image\/(png|jpeg);base64$/.test(m[0])
      );
      return entry ? `data:${entry[0]},${entry[1]}` : "";
    },
    lnurlMin: function () {
      return this.lnurlpay ? Math.ceil(this.lnurlpay.minSendable / 1000) : 0;
    },
    lnurlMax: function () {
      return this.lnurlpay ? Math.floor(this.lnurlpay.maxSendable / 1000) : 0;
    },
    amountHint: function () {
      const parts = [
        "You have " +
          this.formatCurrency(
            this.activeMintBalanceSafe,
            this.activeUnit,
            true
          ),
      ];
      if (this.lnurlpay && this.activeUnit === "sat") {
        parts.push(this.lnurlRange + " allowed");
      }
      return parts.join(" · ");
    },
    lnurlRange: function () {
      return this.lnurlMin == this.lnurlMax
        ? `exactly ${this.formatNumber(this.lnurlMin)} sat`
        : `${this.formatNumber(this.lnurlMin)} to ${this.formatNumber(
            this.lnurlMax
          )} sat`;
    },
    amountError: function () {
      const amount = Number(this.payInvoiceData.input.amount);
      if (!this.lnurlpay || !amount || this.activeUnit !== "sat") {
        return "";
      }
      if (amount < this.lnurlMin || amount > this.lnurlMax) {
        return `This address takes ${this.lnurlRange}`;
      }
      return "";
    },
    activeMintBalanceSafe: function () {
      try {
        return this.activeMintBalance();
      } catch (e) {
        return 0;
      }
    },
    quoteReady: function () {
      const response = this.payInvoiceData.meltQuote.response;
      return (
        !!response &&
        !!response.quote &&
        response.amount > 0 &&
        this.payInvoiceData.meltQuote.error == "" &&
        !this.payInvoiceData.blocking
      );
    },
    cost: function () {
      return this.meltCost();
    },
    smallerAmount: function () {
      // the address may not take that little
      const smaller = this.cost.smallerAmount;
      return smaller && smaller >= this.lnurlMin ? smaller : null;
    },
    quoteErrorText: function () {
      const error = this.payInvoiceData.meltQuote.error;
      const message = String((error && error.message) || error).replace(
        /^Error:\s*/,
        ""
      );
      if (this.payInvoiceData.invoice && !this.payInvoiceData.invoice.sat) {
        return "This invoice has no amount in it. Ask for one with an amount, or pay to a Lightning address.";
      }
      if (/no active mint/i.test(message)) {
        return "This wallet has no sats yet. Add some first with Receive → Lightning.";
      }
      if (/expired/i.test(message)) {
        return "This invoice has expired. Ask for a new one.";
      }
      if (/already (been )?paid|already spent|state.*paid/i.test(message)) {
        return "This invoice was already paid.";
      }
      return "Couldn't get a price for this payment: " + message;
    },
    activeUnits: function () {
      try {
        return this.activeMint().units;
      } catch (e) {
        return [];
      }
    },
    payLabel: function () {
      return this.quoteReady
        ? "Pay " + this.formatCurrency(this.cost.amount, this.activeUnit, true)
        : "Pay";
    },
  },
  methods: {
    ...mapActions(useWalletStore, [
      "melt",
      "meltQuote",
      "meltCost",
      "decodeRequest",
      "lnurlPaySecond",
      "changeLnurlAmount",
      "restartPayment",
    ]),
    ...mapActions(useCameraStore, ["closeCamera", "showCamera"]),
    closeParseDialog: function () {
      setTimeout(() => {
        clearInterval(this.payInvoiceData.paymentChecker);
      }, 10000);
    },
    formatNumber: function (n) {
      return new Intl.NumberFormat().format(n);
    },
    // one thing at a time; the store already tells people what went wrong
    run: async function (job) {
      if (this.working) {
        return;
      }
      this.working = true;
      try {
        return await job();
      } catch (error) {
        console.error(error);
      } finally {
        this.working = false;
      }
    },
    decodeAndQuote: function (request) {
      if (request) {
        return this.run(() => this.decodeRequest(request));
      }
    },
    submitAmount: function () {
      return this.run(() => this.lnurlPaySecond());
    },
    sendSmaller: function () {
      this.payInvoiceData.input.amount = this.smallerAmount;
      return this.run(() => this.lnurlPaySecond());
    },
    retryQuote: function () {
      return this.run(() => this.meltQuote());
    },
    requote: function () {
      if (this.payInvoiceData.show && this.payInvoiceData.invoice) {
        this.run(() => this.meltQuote());
      }
    },
    pay: function () {
      return this.run(() => this.melt());
    },
    pasteToParseDialog: function () {
      console.log("pasteToParseDialog");
      navigator.clipboard.readText().then((text) => {
        this.payInvoiceData.input.request = text;
      });
    },
  },
  created: function () {},
});
</script>
<style lang="scss">
.pay-card__body {
  min-height: 0;
  overflow-y: auto;
}

.pay-card__amount {
  margin-top: 4px;
  font-size: 2.6rem;
  font-weight: 800;
  line-height: 1.1;
  color: #ffb74d;
  word-break: break-word;
}

.pay-card__amount--wait {
  font-size: 1.4rem;
  font-weight: normal;
  color: inherit;
}

.pay-card__error {
  margin-top: 8px;
  font-size: 1.15rem;
  color: #ffab91;
}

.pay-card__memo {
  font-style: italic;
  opacity: 0.85;
}

.pay-card__to {
  margin-top: 2px;
  font-size: 1rem;
  word-break: break-all;
}

.pay-card__recipient {
  margin-top: 2px;
  font-size: 1.5rem;
  font-weight: bold;
  line-height: 1.2;
  word-break: break-all;
}

.pay-card__costs {
  margin-top: 20px;
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.06);
  font-size: 0.95rem;
  line-height: 1.7;
}

.pay-card__total {
  font-weight: bold;
}

.pay-card__low {
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(255, 235, 59, 0.15);
  color: #fff59d;
  text-align: center;
}

.pay-card__footer {
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
}

.pay-card__go {
  min-height: 52px;
  font-size: 1.15rem;
  font-weight: bold;
}

.pay-card__scan {
  min-height: 150px;
  border-radius: 18px;
  font-size: 1.2rem;
  font-weight: bold;

  .q-icon {
    font-size: 3.2rem;
    margin-bottom: 6px;
  }
}
</style>
