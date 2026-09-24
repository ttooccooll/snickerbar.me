<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    maximized
    transition-show="fade"
    transition-hide="fade"
  >
    <div class="porch" data-test="porch-mode">
      <div class="porch__top">
        <span class="porch__left" data-test="porch-left"
          >{{ leftCount }} of {{ tokens.length }} treat{{
            tokens.length == 1 ? "" : "s"
          }}
          left</span
        >
        <div>
          <q-btn
            flat
            round
            :icon="sound ? 'volume_up' : 'volume_off'"
            color="orange"
            data-test="porch-sound"
            @click="$emit('toggle-sound')"
            ><q-tooltip>{{
              sound ? "Mute spooky sounds" : "Play spooky sounds"
            }}</q-tooltip></q-btn
          >
          <q-btn
            v-if="current !== null && leftCount > 1"
            flat
            round
            icon="skip_next"
            color="orange"
            @click="skip"
            ><q-tooltip>Next treat</q-tooltip></q-btn
          >
          <q-btn
            flat
            round
            icon="close"
            color="orange"
            @click="$emit('update:modelValue', false)"
            ><q-tooltip>Leave porch mode</q-tooltip></q-btn
          >
        </div>
      </div>

      <div v-if="current === null" class="porch__empty">
        <div class="porch__emoji">🍭</div>
        <div class="porch__title spooky-title">Out of candy!</div>
        <div class="porch__sub" data-test="porch-recap">
          You handed out <b>{{ totalLabel }}</b> of real bitcoin to
          <b>{{ tokens.length }}</b> trick-or-treater{{
            tokens.length == 1 ? "" : "s"
          }}. Happy Halloween! 🎃
        </div>
        <q-btn
          unelevated
          rounded
          no-caps
          size="lg"
          color="deep-orange"
          class="q-mt-lg"
          :loading="refilling"
          data-test="porch-refill"
          @click="$emit('refill')"
          >🍬 Fill another bag</q-btn
        >
      </div>

      <template v-else>
        <div class="porch__title spooky-title">
          {{ mascot.emoji }} {{ message || "Trick or treat!" }}
          {{ mascot.emoji }}
        </div>
        <div class="porch__qr" :class="{ 'porch__qr--claimed': celebrating }">
          <vue-qrcode
            :key="tokens[current]"
            :value="qrValue"
            :options="{
              errorCorrectionLevel: 'M',
              width: 720,
              margin: 3,
              color: { dark: '#000000', light: '#ffffff' },
            }"
            tag="img"
            class="porch__qr-img"
            :style="{ borderColor: mascot.color }"
          />
          <transition
            appear
            enter-active-class="animated zoomIn"
            leave-active-class="animated fadeOut"
          >
            <div v-if="celebrating" class="porch__claimed">
              <div class="porch__ghost">👻</div>
              Claimed!
            </div>
          </transition>
        </div>
        <div class="porch__amount">
          🍬 {{ amountLabel }} of real bitcoin for this little monster
        </div>
        <div class="porch__sub">
          Grown-ups: scan with your phone camera to claim it.
        </div>
      </template>
    </div>
  </q-dialog>
</template>
<script>
import { defineComponent } from "vue";
import { mapActions } from "pinia";
import token from "src/js/token";
import { buildClaimLink, mascotFor } from "src/js/treats";
import { playClaimSound } from "src/js/spookySounds";
import { useUiStore } from "src/stores/ui";

// how long the "Claimed!" ghost stays before the next treat shows up
const CELEBRATION_MS = 2500;

export default defineComponent({
  name: "PorchMode",
  props: {
    modelValue: { type: Boolean, default: false },
    tokens: { type: Array, required: true },
    claimed: { type: Array, required: true },
    message: { type: String, default: "" },
    qrStyle: { type: String, default: "link" },
    claimBaseUrl: { type: String, default: "" },
    sound: { type: Boolean, default: true },
    refilling: { type: Boolean, default: false },
  },
  emits: ["update:modelValue", "toggle-sound", "refill"],
  data: function () {
    return {
      current: null,
      celebrating: false,
      celebrationTimer: null,
      wakeLock: null,
    };
  },
  computed: {
    leftCount: function () {
      return this.tokens.filter((t, i) => !this.claimed[i]).length;
    },
    qrValue: function () {
      const t = this.tokens[this.current];
      return this.qrStyle === "link" ? buildClaimLink(this.claimBaseUrl, t) : t;
    },
    mascot: function () {
      return mascotFor(this.current || 0);
    },
    amountLabel: function () {
      return this.satsLabel(this.tokenAmount(this.tokens[this.current]));
    },
    totalLabel: function () {
      return this.satsLabel(
        this.tokens.reduce((sum, t) => sum + this.tokenAmount(t), 0)
      );
    },
  },
  watch: {
    modelValue: function (val) {
      if (val) {
        this.open();
      } else {
        this.close();
      }
    },
    tokens: function () {
      // a refilled bag starts over at its first treat
      if (this.modelValue) {
        clearTimeout(this.celebrationTimer);
        this.celebrating = false;
        this.current = this.nextUnclaimed(-1);
      }
    },
    claimed: function () {
      if (
        this.modelValue &&
        this.current !== null &&
        this.claimed[this.current] &&
        !this.celebrating
      ) {
        this.celebrate();
      }
    },
  },
  beforeUnmount: function () {
    this.close();
  },
  methods: {
    ...mapActions(useUiStore, { rainCandy: "celebrate" }),
    open: function () {
      document.body.classList.add("porch-mode");
      this.celebrating = false;
      this.current = this.nextUnclaimed(-1);
      this.keepScreenOn();
    },
    close: function () {
      document.body.classList.remove("porch-mode");
      clearTimeout(this.celebrationTimer);
      this.celebrating = false;
      if (this.wakeLock) {
        this.wakeLock.release().catch(() => {});
        this.wakeLock = null;
      }
    },
    // index of the next unclaimed treat after `from`, wrapping around
    nextUnclaimed: function (from) {
      const n = this.tokens.length;
      for (let step = 1; step <= n; step++) {
        const i = (((from + step) % n) + n) % n;
        if (!this.claimed[i]) {
          return i;
        }
      }
      return null;
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
    satsLabel: function (amount) {
      return `${amount} ${amount === 1 ? "sat" : "sats"}`;
    },
    celebrate: function () {
      this.celebrating = true;
      this.rainCandy();
      if (this.sound) {
        playClaimSound();
      }
      this.celebrationTimer = setTimeout(() => {
        this.celebrating = false;
        this.current = this.nextUnclaimed(this.current);
      }, CELEBRATION_MS);
    },
    skip: function () {
      this.current = this.nextUnclaimed(this.current);
    },
    keepScreenOn: async function () {
      // a tablet at the front door shouldn't fall asleep
      try {
        if (navigator.wakeLock) {
          this.wakeLock = await navigator.wakeLock.request("screen");
        }
      } catch (e) {
        console.log("wake lock not available", e);
      }
    },
  },
});
</script>
<style lang="scss">
.porch {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2vh;
  min-height: 100vh;
  width: 100vw;
  padding: 12px 16px 24px;
  box-sizing: border-box;
  background: radial-gradient(circle at 50% 35%, #2a1440 0%, #07040b 70%);
  color: #ffcc80;
  text-align: center;
}

.porch__top {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
}

.porch__left {
  font-weight: bold;
  color: #ff9f1c;
}

.porch__title {
  font-size: clamp(2rem, 7vw, 4rem);
  line-height: 1.1;
}

.porch__qr {
  position: relative;
  width: min(80vw, 58vh);
  animation: porch-glow 2.5s ease-in-out infinite;
  border-radius: 18px;
}

.porch__qr-img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 18px;
  border: 6px solid #ff7518;
  box-sizing: border-box;
}

.porch__qr--claimed .porch__qr-img {
  opacity: 0.15;
}

.porch__claimed {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: clamp(2rem, 6vw, 3.5rem);
  font-weight: bold;
  color: #d1b3ff;
}

.porch__ghost {
  font-size: clamp(4rem, 14vw, 8rem);
  animation: porch-float 1.2s ease-in-out infinite alternate;
}

.porch__amount {
  font-size: clamp(1.2rem, 4vw, 2rem);
  font-weight: bold;
  color: #ff9f1c;
}

.porch__sub {
  font-size: clamp(0.95rem, 2.5vw, 1.3rem);
}

.porch__empty {
  max-width: 640px;
}

.porch__empty .porch__emoji {
  font-size: 7rem;
}

@keyframes porch-glow {
  0%,
  100% {
    box-shadow: 0 0 20px 2px rgba(255, 117, 24, 0.45);
  }
  50% {
    box-shadow: 0 0 45px 10px rgba(179, 136, 255, 0.55);
  }
}

@keyframes porch-float {
  from {
    transform: translateY(0) rotate(-6deg);
  }
  to {
    transform: translateY(-14px) rotate(6deg);
  }
}

// nothing flies over the code while people are scanning it
.porch-mode .spooky-bat {
  display: none;
}

@media (prefers-reduced-motion: reduce) {
  .porch__qr,
  .porch__ghost {
    animation: none;
  }
}
</style>
