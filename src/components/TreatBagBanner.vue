<template>
  <div v-if="pendingTreats.length" class="row justify-center q-mt-sm">
    <q-btn
      rounded
      outline
      no-caps
      color="primary"
      class="q-px-md"
      data-test="treat-bag-banner"
      @click="openTreatBag"
    >
      <span aria-hidden="true" class="q-mr-sm">🎃</span>
      {{ pendingTreats.length }} unclaimed treat{{
        pendingTreats.length == 1 ? "" : "s"
      }}
      · {{ formatCurrency(pendingTotal, activeUnit) }}
    </q-btn>
  </div>
</template>
<script>
import { defineComponent } from "vue";
import { mapState, mapWritableState } from "pinia";
import { useTokensStore } from "src/stores/tokens";
import { useMintsStore } from "src/stores/mints";
import { useSendTokensStore } from "src/stores/sendTokensStore";

export default defineComponent({
  name: "TreatBagBanner",
  mixins: [windowMixin],
  computed: {
    ...mapState(useTokensStore, ["historyTokens"]),
    ...mapState(useMintsStore, ["activeUnit"]),
    ...mapWritableState(useSendTokensStore, ["showSendTokens", "sendData"]),
    pendingTreats: function () {
      // ecash we sent in the active unit that nobody has claimed yet
      return this.historyTokens.filter(
        (t) =>
          t.status === "pending" && t.amount < 0 && t.unit === this.activeUnit
      );
    },
    pendingTotal: function () {
      return this.pendingTreats.reduce((sum, t) => sum - t.amount, 0);
    },
  },
  methods: {
    openTreatBag: function () {
      this.sendData.tokensBase64 = "";
      this.sendData.tokens = this.pendingTreats.map((t) => t.token);
      this.showSendTokens = true;
    },
  },
});
</script>
