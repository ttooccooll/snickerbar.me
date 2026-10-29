<template>
  <q-dialog
    v-model="showClaimTreat"
    :maximized="$q.screen.lt.sm"
    persistent
    transition-show="fade"
    transition-hide="fade"
    backdrop-filter="blur(2px) brightness(60%)"
    @before-show="onShow"
  >
    <q-card class="claim-treat column no-wrap" data-test="claim-treat">
      <q-card-section
        class="col column items-center justify-center no-wrap text-center claim-treat__body"
      >
        <div class="claim-treat__emoji" aria-hidden="true">
          {{ state === "ready" ? "🎃" : "👻" }}
        </div>
        <template v-if="state === 'invalid'">
          <div class="spooky-title claim-treat__title">
            This treat got scrambled
          </div>
          <div class="claim-treat__text">
            The code didn't come through. Close this and scan the card again,
            holding your phone steady.
          </div>
        </template>
        <template v-else-if="state === 'spent'">
          <div class="spooky-title claim-treat__title">Already claimed</div>
          <div class="claim-treat__text" data-test="claim-spent">
            The bitcoin on this card was already received. If you claimed it
            earlier, your sats are in the wallet you used then. If not, ask
            whoever gave you the card.
          </div>
        </template>
        <template v-else>
          <div class="spooky-title claim-treat__title">You got a treat!</div>
          <div class="claim-treat__amount" data-test="claim-amount">
            {{ amountLabel }}
          </div>
          <div class="claim-treat__text">of real bitcoin, yours to keep</div>
          <div v-if="memo" class="claim-treat__memo">“{{ memo }}”</div>
        </template>
      </q-card-section>
      <q-card-section class="claim-treat__actions">
        <template v-if="state === 'ready'">
          <div v-if="error" class="claim-treat__error" data-test="claim-error">
            {{ error }}
          </div>
          <q-btn
            unelevated
            rounded
            no-caps
            color="primary"
            class="full-width claim-treat__btn"
            :loading="claiming"
            :label="error ? 'Try again' : 'Receive my treat'"
            data-test="claim-treat-btn"
            @click="claim"
          >
            <template v-slot:loading>
              <q-spinner-hourglass class="q-mr-sm" />
              Getting your treat…
            </template>
          </q-btn>
          <div class="claim-treat__fine">
            Free, no app and no sign-up. Your wallet lives in this browser.
            <span class="claim-treat__mint">Ecash from {{ mintHost }}</span>
          </div>
        </template>
        <q-btn
          flat
          rounded
          no-caps
          color="grey-5"
          class="full-width q-mt-xs"
          :label="state === 'ready' ? 'Not now' : 'Close'"
          :disable="claiming"
          data-test="claim-close"
          @click="close"
        />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
<script>
import { defineComponent } from "vue";
import { mapActions, mapState, mapWritableState } from "pinia";
import { useReceiveTokensStore } from "src/stores/receiveTokensStore";
import { useWalletStore } from "src/stores/wallet";
import { useMintsStore } from "src/stores/mints";
import { useP2PKStore } from "src/stores/p2pk";
import { getShortUrl } from "src/js/wallet-helpers";
import token from "src/js/token";

// what the mint says when a note was used before
const SPENT_ERROR = /already spent|spent|11001/i;

export default defineComponent({
  name: "ClaimTreatDialog",
  mixins: [windowMixin],
  data: function () {
    return {
      // the token this screen was opened for, the store's copy changes
      // when the wallet receives other ecash
      tokenStr: "",
      spent: false,
      claiming: false,
      error: "",
    };
  },
  computed: {
    ...mapWritableState(useReceiveTokensStore, [
      "showClaimTreat",
      "fromClaimLink",
      "receiveData",
    ]),
    ...mapState(useMintsStore, ["mints"]),
    decoded: function () {
      try {
        const tokenJson = token.decode(this.tokenStr);
        return token.getProofs(tokenJson).length ? tokenJson : undefined;
      } catch (e) {
        return undefined;
      }
    },
    state: function () {
      if (!this.decoded) {
        return "invalid";
      }
      return this.spent ? "spent" : "ready";
    },
    amount: function () {
      return token
        .getProofs(this.decoded)
        .reduce((sum, p) => sum + p.amount, 0);
    },
    amountLabel: function () {
      const unit = token.getUnit(this.decoded) || "sat";
      if (unit === "sat") {
        return `${new Intl.NumberFormat().format(this.amount)} ${
          this.amount === 1 ? "sat" : "sats"
        }`;
      }
      return this.formatCurrency(this.amount, unit, true);
    },
    mintUrl: function () {
      return token.getMint(this.decoded);
    },
    mintHost: function () {
      return getShortUrl(this.mintUrl);
    },
    memo: function () {
      return token.getMemo(this.decoded);
    },
  },
  methods: {
    ...mapActions(useWalletStore, ["redeem", "isTokenSpent"]),
    ...mapActions(useMintsStore, ["addMint"]),
    ...mapActions(useP2PKStore, ["getPrivateKeyForP2PKEncodedToken"]),
    onShow: async function () {
      this.tokenStr = this.receiveData.tokensBase64;
      this.spent = false;
      this.claiming = false;
      this.error = "";
      if (!this.decoded) {
        return;
      }
      // tell people up front when the card was already claimed, instead of
      // after they tapped the button. Offline? Then the claim will tell.
      const tokenStr = this.tokenStr;
      try {
        const spent = await this.isTokenSpent(tokenStr);
        if (tokenStr === this.tokenStr && !this.claiming) {
          this.spent = spent;
        }
      } catch (e) {
        console.warn("could not check the treat", e);
      }
    },
    claim: async function () {
      this.error = "";
      this.claiming = true;
      try {
        if (!this.mints.some((m) => m.url === this.mintUrl)) {
          await this.addMint({ url: this.mintUrl });
        }
        this.receiveData.tokensBase64 = this.tokenStr;
        this.receiveData.p2pkPrivateKey = this.getPrivateKeyForP2PKEncodedToken(
          this.tokenStr
        );
        // the wallet celebrates and shows how to keep and spend the sats
        this.fromClaimLink = true;
        await this.redeem();
        this.showClaimTreat = false;
      } catch (e) {
        console.error(e);
        const message = String((e && e.message) || e);
        if (SPENT_ERROR.test(message)) {
          this.spent = true;
        } else {
          this.error =
            "That didn't work. Check that you're online and try again.";
        }
      } finally {
        this.claiming = false;
      }
    },
    close: function () {
      this.fromClaimLink = false;
      this.showClaimTreat = false;
    },
  },
});
</script>
<style lang="scss">
.claim-treat {
  width: 440px;
  max-width: 100%;
  min-height: 520px;
  background: radial-gradient(
      circle at 50% 28%,
      rgba(255, 117, 24, 0.22),
      transparent 62%
    ),
    #1a1025 !important;
  color: #fff;
}

.q-dialog__inner--maximized > .claim-treat {
  min-height: 100%;
}

.claim-treat__body {
  padding-top: 32px;
}

.claim-treat__emoji {
  font-size: 5.5rem;
  line-height: 1;
  animation: claim-treat-bob 2.4s ease-in-out infinite;
}

.claim-treat__title {
  margin-top: 12px;
  font-size: 2.3rem;
  line-height: 1.1;
}

.claim-treat__amount {
  margin-top: 18px;
  font-size: 3.4rem;
  font-weight: 800;
  line-height: 1;
  color: #ffb74d;
  letter-spacing: -1px;
  word-break: break-word;
}

.claim-treat__text {
  margin-top: 10px;
  max-width: 320px;
  font-size: 1.05rem;
  line-height: 1.4;
  opacity: 0.85;
}

.claim-treat__memo {
  margin-top: 16px;
  max-width: 320px;
  font-style: italic;
  font-size: 1.05rem;
  color: #b388ff;
}

.claim-treat__actions {
  padding: 8px 20px calc(20px + env(safe-area-inset-bottom));
}

.claim-treat__btn {
  min-height: 58px;
  font-size: 1.25rem;
  font-weight: bold;
}

.claim-treat__error {
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(255, 82, 82, 0.15);
  color: #ffab91;
  text-align: center;
}

.claim-treat__fine {
  margin-top: 12px;
  font-size: 0.85rem;
  line-height: 1.4;
  text-align: center;
  opacity: 0.7;
}

.claim-treat__mint {
  display: block;
  word-break: break-all;
}

@keyframes claim-treat-bob {
  0%,
  100% {
    transform: translateY(0) rotate(-4deg);
  }
  50% {
    transform: translateY(-8px) rotate(4deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .claim-treat__emoji {
    animation: none;
  }
}
</style>
