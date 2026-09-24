<template>
  <div class="row justify-center">
    <div class="halloween-countdown spooky-title" data-test="countdown">
      <template v-if="days === 0">🎃 Happy Halloween! 🎃</template>
      <template v-else-if="days === 1">🎃 Halloween is tomorrow!</template>
      <template v-else-if="days <= 60"
        >🎃 {{ days }} days until Halloween</template
      >
    </div>
  </div>
</template>
<script>
import { defineComponent } from "vue";
import { daysUntilHalloween } from "src/js/treats";

export default defineComponent({
  name: "HalloweenCountdown",
  data: function () {
    return {
      days: daysUntilHalloween(),
    };
  },
});
</script>
<style lang="scss">
.halloween-countdown {
  font-size: 1.25rem;
  text-shadow: 0 0 12px rgba(255, 117, 24, 0.5);
}
</style>
