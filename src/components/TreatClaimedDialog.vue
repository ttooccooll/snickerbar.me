<template>
  <q-dialog v-model="show" position="top" persistent>
    <q-card class="q-pa-lg qcard treat-claimed" data-test="treat-claimed">
      <div class="text-center">
        <div class="treat-claimed__emoji" aria-hidden="true">🎉</div>
        <div class="spooky-title treat-claimed__title">
          {{ amountLabel }} of bitcoin are yours!
        </div>
      </div>
      <div
        class="treat-claimed__warning q-mt-md"
        data-test="treat-claimed-warning"
      >
        <b>⚠️ Move them to a wallet you own.</b> Right now they're in a
        temporary wallet that lives only in this browser. If the browser's data
        gets cleared, or this website shuts down, the sats are lost.
      </div>
      <q-btn
        unelevated
        rounded
        no-caps
        color="primary"
        class="full-width q-mt-md treat-claimed__move"
        icon="send"
        label="Move them to my wallet"
        data-test="treat-claimed-move"
        @click="moveNow"
      />
      <div class="treat-claimed__caption q-mt-sm text-center">
        Sends them to your own Lightning wallet: Coinos, Strike, Wallet of
        Satoshi, Cash App and most others work.
      </div>
      <div class="treat-claimed__coinos q-mt-md">
        <b>No wallet yet?</b> Coinos is free and works right in your browser:
        make an account at coinos.io, then come back and tap
        <b>Move them to my wallet</b>.
        <div class="text-center">
          <q-btn
            outline
            rounded
            no-caps
            color="primary"
            class="q-mt-sm"
            icon-right="open_in_new"
            label="Open coinos.io"
            href="https://coinos.io"
            target="_blank"
            rel="noopener"
          />
        </div>
      </div>
      <q-btn
        flat
        rounded
        no-caps
        color="grey-5"
        class="full-width q-mt-md"
        label="Keep them here"
        data-test="treat-claimed-ok"
        v-close-popup
      />
      <div class="treat-claimed__caption text-center">{{ keepHint }}</div>
    </q-card>
  </q-dialog>
</template>
<script>
import { defineComponent } from "vue";
import { mapActions, mapWritableState } from "pinia";
import { useUiStore } from "src/stores/ui";
import { useWalletStore } from "src/stores/wallet";

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
        return "Keeping them here? Don't clear this app's data.";
      }
      if (/iPhone|iPad|iPod/.test(ua)) {
        return "Keeping them here? Tap Share, then Add to Home Screen, and don't clear Safari's data.";
      }
      if (/Android/.test(ua)) {
        return "Keeping them here? Tap ⋮, then Add to Home screen, and don't clear the browser's data.";
      }
      return "Keeping them here? Bookmark this page and don't clear the browser's data.";
    },
  },
  methods: {
    ...mapActions(useWalletStore, ["openMoveSats"]),
    moveNow: function () {
      this.treatClaimed = null;
      this.openMoveSats();
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

.treat-claimed__warning {
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(255, 235, 59, 0.12);
  color: #fff59d;
  line-height: 1.4;
}

.treat-claimed__move {
  min-height: 52px;
  font-size: 1.15rem;
  font-weight: bold;
}

.treat-claimed__caption {
  font-size: 0.85rem;
  line-height: 1.35;
  opacity: 0.8;
}

.treat-claimed__coinos {
  padding-top: 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  font-size: 0.9rem;
  line-height: 1.4;
}
</style>
