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
                v-if="
                  payInvoiceData.meltQuote.response &&
                  payInvoiceData.meltQuote.response.amount > 0
                "
                class="pay-card__amount"
                data-test="pay-amount"
              >
                {{
                  formatCurrency(
                    payInvoiceData.meltQuote.response.amount,
                    activeUnit,
                    true
                  )
                }}
              </div>
              <div
                v-else-if="payInvoiceData.meltQuote.error != ''"
                class="pay-card__error"
              >
                {{ payInvoiceData.meltQuote.error }}
              </div>
              <div v-else class="pay-card__amount pay-card__amount--wait">
                <q-spinner-hourglass size="0.8em" /> Getting the price…
              </div>
            </div>
            <ToggleUnit v-if="activeUnits.length > 1" class="q-mt-sm" />
          </div>
          <p
            v-if="payInvoiceData.invoice.description"
            class="text-wrap q-mt-md q-mb-none pay-card__memo"
          >
            “{{ payInvoiceData.invoice.description }}”
          </p>
          <div class="q-mt-lg">
            <ChooseMint v-if="mints.length > 1" :ticker-short="tickerShort" />
            <div v-else class="text-body2 text-grey-5">
              From your wallet ·
              {{ formatCurrency(activeMintBalanceSafe, activeUnit, true) }}
              available
            </div>
          </div>
        </q-card-section>
        <q-card-section class="pay-card__footer">
          <div v-if="!enoughActiveBalance" class="pay-card__low q-mb-sm">
            Not enough sats in this wallet for that.
          </div>
          <q-btn
            v-if="enoughActiveBalance"
            unelevated
            rounded
            no-caps
            color="primary"
            class="full-width pay-card__go"
            :disabled="
              payInvoiceData.blocking || payInvoiceData.meltQuote.error != ''
            "
            @click="melt"
            :label="
              payInvoiceData.meltQuote.error != ''
                ? 'Error'
                : !payInvoiceData.blocking
                ? payLabel
                : 'Paying…'
            "
            :loading="globalMutexLock && !payInvoiceData.blocking"
            data-test="pay-btn"
          >
            <template v-slot:loading>
              <q-spinner-hourglass />
            </template>
          </q-btn>
          <q-btn
            v-close-popup
            flat
            rounded
            no-caps
            color="grey"
            class="full-width q-mt-xs"
            label="Cancel"
          />
        </q-card-section>
      </template>

      <!-- ////////////////// LNURL / LIGHTNING ADDRESS ////////////////// -->
      <q-card-section v-else-if="payInvoiceData.lnurlpay" class="col">
        <q-form @submit="lnurlPaySecond" class="q-gutter-md">
          <p
            v-if="
              payInvoiceData.lnurlpay.maxSendable ==
              payInvoiceData.lnurlpay.minSendable
            "
            class="q-my-none text-h6 text-center"
          >
            <b>{{ payInvoiceData.lnurlpay.domain }}</b> is requesting
            {{ payInvoiceData.lnurlpay.maxSendable / 1000 }}
            {{ tickerShort }}
          </p>
          <p v-else class="q-my-none text-h6 text-center">
            <b>{{
              payInvoiceData.lnurlpay.targetUser ||
              payInvoiceData.lnurlpay.domain
            }}</b>
            is requesting <br />
            between
            <b>{{ payInvoiceData.lnurlpay.minSendable / 1000 }}</b>
            and
            <b>{{ payInvoiceData.lnurlpay.maxSendable / 1000 }}</b>
            {{ tickerShort }}
          </p>
          <q-separator class="q-my-sm"></q-separator>
          <div class="row" v-if="payInvoiceData.lnurlpay.description">
            <p class="col text-justify text-italic">
              {{ payInvoiceData.lnurlpay.description }}
            </p>
            <p class="col-4 q-pl-md" v-if="payInvoiceData.lnurlpay.image">
              <q-img :src="payInvoiceData.lnurlpay.image" />
            </p>
          </div>
          <div class="row">
            <div class="col-12">
              <q-input
                outlined
                autofocus
                v-model.number="payInvoiceData.input.amount"
                type="number"
                inputmode="numeric"
                :label="'Amount (' + tickerShort + ') *'"
                :min="payInvoiceData.lnurlpay.minSendable / 1000"
                :max="payInvoiceData.lnurlpay.maxSendable / 1000"
                :readonly="
                  payInvoiceData.lnurlpay.maxSendable ==
                  payInvoiceData.lnurlpay.minSendable
                "
              ></q-input>
            </div>
            <div
              class="col-12 q-pt-sm"
              v-if="payInvoiceData.lnurlpay.commentAllowed > 0"
            >
              <q-input
                outlined
                v-model="payInvoiceData.input.comment"
                _type="payInvoiceData.lnurlpay.commentAllowed > 64 ? 'textarea' : 'text'"
                label="Comment (optional)"
                :maxlength="payInvoiceData.lnurlpay.commentAllowed"
              ></q-input>
            </div>
          </div>
          <div class="row no-wrap items-center q-mt-lg">
            <q-btn
              unelevated
              rounded
              no-caps
              color="primary"
              type="submit"
              class="pay-card__go col"
              >Next</q-btn
            >
            <q-btn
              v-close-popup
              flat
              rounded
              no-caps
              color="grey"
              class="q-ml-sm"
              >Cancel</q-btn
            >
          </div>
        </q-form>
      </q-card-section>

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
              :autofocus="!$q.screen.lt.sm"
              @keyup.enter="decodeAndQuote(payInvoiceData.input.request)"
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
    return {};
  },
  watch: {
    activeMintUrl: async function () {
      if (this.payInvoiceData.show) {
        await this.meltQuote();
      }
    },
    activeUnit: async function () {
      if (this.payInvoiceData.show) {
        await this.meltQuote();
      }
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
    enoughActiveBalance: function () {
      return (
        this.activeMintBalanceSafe >=
        this.payInvoiceData.meltQuote.response.amount
      );
    },
    activeMintBalanceSafe: function () {
      try {
        return this.activeMintBalance();
      } catch (e) {
        return 0;
      }
    },
    activeUnits: function () {
      try {
        return this.activeMint().units;
      } catch (e) {
        return [];
      }
    },
    payLabel: function () {
      const amount = this.payInvoiceData.meltQuote.response.amount;
      return amount > 0
        ? "Pay " + this.formatCurrency(amount, this.activeUnit, true)
        : "Pay";
    },
  },
  methods: {
    ...mapActions(useWalletStore, [
      "melt",
      "meltQuote",
      "decodeRequest",
      "lnurlPaySecond",
    ]),
    ...mapActions(useCameraStore, ["closeCamera", "showCamera"]),
    canPay: function () {
      if (!this.payInvoiceData.invoice) return false;
      return payInvoiceData.meltQuote.response.amount <= this.activeBalance;
    },
    closeParseDialog: function () {
      setTimeout(() => {
        clearInterval(this.payInvoiceData.paymentChecker);
      }, 10000);
    },
    decodeAndQuote: async function (request) {
      await this.decodeRequest(request);
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
