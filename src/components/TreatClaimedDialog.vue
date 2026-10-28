<template>
  <q-dialog v-model="show" position="top">
    <q-card class="q-pa-lg qcard treat-claimed" data-test="treat-claimed">
      <div class="text-center">
        <div class="treat-claimed__emoji" aria-hidden="true">🎉</div>
        <div class="spooky-title treat-claimed__title">
          {{ amountLabel }} of bitcoin are yours!
        </div>
        <div class="text-body2 q-mt-xs">
          They're in a free wallet that lives in this browser.
        </div>
      </div>
      <q-list class="q-mt-md">
        <q-item class="q-px-none">
          <q-item-section avatar class="treat-claimed__icon">📲</q-item-section>
          <q-item-section>
            <q-item-label><b>Keep it</b></q-item-label>
            <q-item-label caption class="treat-claimed__caption">{{
              keepHint
            }}</q-item-label>
          </q-item-section>
        </q-item>
        <q-item class="q-px-none">
          <q-item-section avatar class="treat-claimed__icon">⚡</q-item-section>
          <q-item-section>
            <q-item-label><b>Spend it</b></q-item-label>
            <q-item-label caption class="treat-claimed__caption"
              >Tap <b>Send</b>, then <b>Lightning</b>, and scan any Lightning QR
              code, at a store or from another wallet.</q-item-label
            >
          </q-item-section>
        </q-item>
        <q-item class="q-px-none">
          <q-item-section avatar class="treat-claimed__icon">🔐</q-item-section>
          <q-item-section>
            <q-item-label><b>Back it up (later)</b></q-item-label>
            <q-item-label caption class="treat-claimed__caption"
              >Menu ☰ → Settings shows your backup words. Write them down to get
              your sats back if you lose this phone.</q-item-label
            >
          </q-item-section>
        </q-item>
      </q-list>
      <q-btn
        unelevated
        rounded
        color="primary"
        class="full-width q-mt-md"
        label="Got it!"
        data-test="treat-claimed-ok"
        v-close-popup
      />
    </q-card>
  </q-dialog>
</template>
<script>
import { defineComponent } from "vue";
import { mapWritableState } from "pinia";
import { useUiStore } from "src/stores/ui";

export default defineComponent({
  name: "TreatClaimedDialog",
  mixins: [windowMixin],
  computed: {
    ...mapWritableState(useUiStore, ["treatClaimed"]),
    show: {
      get: function () {
        return !!this.treatClaimed;
      },
      set: function (val) {
        if (!val) {
          this.treatClaimed = null;
        }
      },
    },
    amountLabel: function () {
      if (!this.treatClaimed) {
        return "";
      }
      const { amount, unit } = this.treatClaimed;
      if (unit === "sat") {
        return `${new Intl.NumberFormat().format(amount)} ${
          amount === 1 ? "sat" : "sats"
        }`;
      }
      return this.formatCurrency(amount, unit, true);
    },
    keepHint: function () {
      const ua = navigator.userAgent || "";
      const standalone =
        window.matchMedia &&
        window.matchMedia("(display-mode: standalone)").matches;
      if (standalone || navigator.standalone) {
        return "It's on your home screen already. Open it from there any time.";
      }
      if (/iPhone|iPad|iPod/.test(ua)) {
        return "Tap the Share button, then Add to Home Screen. Your sats are saved in this browser, so don't clear its data.";
      }
      if (/Android/.test(ua)) {
        return "Tap ⋮ in the browser, then Add to Home screen (or Install app). Your sats are saved in this browser.";
      }
      return "Bookmark this page. Your sats are saved in this browser, so don't clear its data.";
    },
  },
});
</script>
<style lang="scss">
.treat-claimed__emoji {
  font-size: 3.5rem;
  line-height: 1;
}

.treat-claimed__title {
  font-size: 1.7rem;
  line-height: 1.15;
  margin-top: 6px;
}

.treat-claimed__icon {
  font-size: 1.6rem;
  min-width: 44px;
}

.treat-claimed__caption {
  font-size: 0.85rem;
  line-height: 1.35;
}
</style>
