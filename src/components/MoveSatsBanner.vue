<template>
  <div v-if="show" class="move-banner q-mx-md" data-test="move-banner">
    <div class="move-banner__text">
      <b
        >⚠️ Your {{ formatCurrency(activeBalance, activeUnit, true) }} live only
        in this browser.</b
      >
      If its data gets cleared, or this website shuts down, they're gone. Move
      them to a wallet you own.
    </div>
    <q-btn
      unelevated
      rounded
      no-caps
      color="primary"
      class="full-width q-mt-sm"
      icon="send"
      label="Move to my wallet"
      data-test="move-banner-btn"
      @click="openMoveSats"
    />
  </div>
</template>
<script>
import { defineComponent } from "vue";
import { mapActions, mapState } from "pinia";
import { useMintsStore } from "src/stores/mints";
import { useWalletStore } from "src/stores/wallet";

// below this a move costs about as much as it saves
const WORTH_MOVING = 21;

export default defineComponent({
  name: "MoveSatsBanner",
  mixins: [windowMixin],
  computed: {
    ...mapState(useMintsStore, ["activeBalance", "activeUnit"]),
    ...mapState(useWalletStore, ["invoiceHistory"]),
    // whoever filled this wallet over Lightning (the host) knows the drill;
    // everybody who got their sats as a treat or a token gets the warning
    fundedOverLightning: function () {
      return this.invoiceHistory.some(
        (i) => i.amount > 0 && i.status === "paid"
      );
    },
    show: function () {
      return (
        !this.fundedOverLightning &&
        this.activeUnit === "sat" &&
        this.activeBalance >= WORTH_MOVING
      );
    },
  },
  methods: {
    ...mapActions(useWalletStore, ["openMoveSats"]),
  },
});
</script>
<style lang="scss">
.move-banner {
  padding: 12px 14px;
  border: 1px solid rgba(255, 235, 59, 0.35);
  border-radius: 14px;
  background: rgba(255, 235, 59, 0.1);
  color: #fff59d;
  text-align: left;
  line-height: 1.4;
}
</style>
