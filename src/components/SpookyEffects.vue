<template>
  <div class="spooky-effects" aria-hidden="true">
    <span
      v-for="bat in bats"
      :key="bat.id"
      class="spooky-bat"
      :style="{
        top: bat.top + 'vh',
        animationDuration: bat.duration + 's',
        animationDelay: bat.delay + 's',
        fontSize: bat.size + 'px',
      }"
      >🦇</span
    >
    <span
      v-for="drop in drops"
      :key="drop.id"
      class="candy-drop"
      :style="{
        left: drop.left + 'vw',
        animationDuration: drop.duration + 's',
        animationDelay: drop.delay + 's',
        fontSize: drop.size + 'px',
      }"
      >{{ drop.emoji }}</span
    >
  </div>
</template>
<script>
import { defineComponent } from "vue";
import { mapState } from "pinia";
import { useUiStore } from "src/stores/ui";

const CANDY = ["🍬", "🍭", "🍫", "🎃", "👻", "🍬", "🍭", "🍫"];
let nextId = 0;

export default defineComponent({
  name: "SpookyEffects",
  data: function () {
    const reduceMotion =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return {
      reduceMotion,
      // a few bats that keep crossing the screen every now and then
      bats: reduceMotion
        ? []
        : [0, 1, 2].map((i) => ({
            id: "bat" + i,
            top: 6 + i * 11,
            duration: 14 + i * 5,
            delay: 2 + i * 7,
            size: 18 + i * 6,
          })),
      drops: [],
    };
  },
  computed: {
    ...mapState(useUiStore, ["candyRain"]),
  },
  watch: {
    candyRain: function () {
      this.rain();
    },
  },
  methods: {
    rain: function () {
      if (window.navigator.vibrate) navigator.vibrate([60, 40, 60]);
      if (this.reduceMotion) {
        return;
      }
      const drops = Array.from({ length: 40 }, () => ({
        id: "drop" + nextId++,
        emoji: CANDY[Math.floor(Math.random() * CANDY.length)],
        left: Math.random() * 96,
        duration: 2.2 + Math.random() * 1.8,
        delay: Math.random() * 1.2,
        size: 22 + Math.random() * 22,
      }));
      this.drops = this.drops.concat(drops);
      setTimeout(() => {
        this.drops = this.drops.filter((d) => !drops.includes(d));
      }, 5500);
    },
  },
});
</script>
<style lang="scss">
.spooky-effects {
  position: fixed;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 9000;
}

.spooky-bat {
  position: absolute;
  left: -60px;
  opacity: 0;
  animation-name: spooky-bat-flight;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}

@keyframes spooky-bat-flight {
  0% {
    transform: translate(0, 0) scaleX(-1);
    opacity: 0;
  }
  5% {
    opacity: 0.55;
  }
  25% {
    transform: translate(35vw, 4vh) scaleX(-1);
  }
  50% {
    transform: translate(70vw, -3vh) scaleX(-1);
  }
  60%,
  100% {
    transform: translate(110vw, 2vh) scaleX(-1);
    opacity: 0;
  }
}

.candy-drop {
  position: absolute;
  top: -60px;
  animation-name: candy-fall;
  animation-timing-function: cubic-bezier(0.4, 0, 0.9, 0.6);
  animation-fill-mode: both;
}

@keyframes candy-fall {
  0% {
    transform: translateY(0) rotate(0deg);
    opacity: 1;
  }
  85% {
    opacity: 1;
  }
  100% {
    transform: translateY(110vh) rotate(540deg);
    opacity: 0;
  }
}

@media print {
  .spooky-effects {
    display: none;
  }
}
</style>
