<template>
  <div
    class="trunk-sign"
    :class="{ 'trunk-sign--ink-saver': inkSaver }"
    data-test="trunk-sign"
  >
    <div class="trunk-sign__pumpkins" aria-hidden="true">🎃 👻 🎃</div>
    <div class="trunk-sign__title spooky-title">Free Bitcoin Treats</div>
    <div class="trunk-sign__lead">
      Grown-ups: take a card for your
      <span class="trunk-sign__nowrap">trick-or-treater!</span>
    </div>
    <div class="trunk-sign__body">
      Every card holds <b>real bitcoin</b> as Cashu ecash. It's yours to keep or
      spend.
    </div>
    <ol class="trunk-sign__steps">
      <li>
        <span class="trunk-sign__step-icon" aria-hidden="true">📷</span>
        Scan the card with your phone camera.
      </li>
      <li>
        <span class="trunk-sign__step-icon" aria-hidden="true">👆</span>
        Tap <b>Receive my treat</b>. It opens in your browser.
        <span class="trunk-sign__small">No app, no sign-up.</span>
      </li>
      <li>
        <span class="trunk-sign__step-icon" aria-hidden="true">🔒</span>
        Tap <b>Move them to my wallet</b> to keep them in a wallet you own, like
        Coinos.
      </li>
    </ol>
    <div class="trunk-sign__footer">
      <div class="trunk-sign__qr">
        <vue-qrcode
          :value="whyBitcoinUrl"
          :options="{
            width: 240,
            margin: 2,
            color: { dark: '#000000', light: inkSaver ? '#ffffff' : '#b388ff' },
          }"
          tag="img"
          class="trunk-sign__qr-img"
        />
        <div>New to bitcoin? Scan for a quick video.</div>
      </div>
      <div class="trunk-sign__bye spooky-title">Happy Halloween! 👻</div>
    </div>
  </div>
</template>
<script>
import { defineComponent } from "vue";

export default defineComponent({
  name: "TrunkSign",
  props: {
    inkSaver: { type: Boolean, default: false },
  },
  data: function () {
    return {
      whyBitcoinUrl: "https://youtu.be/24waV3Fwvow?si=yNBx0t5TXD6GhwwC",
    };
  },
});
</script>
<style lang="scss">
.trunk-sign {
  box-sizing: border-box;
  max-width: 560px;
  margin: 16px auto 4px;
  padding: 22px 22px 18px;
  border: 3px dashed #ff9f1c;
  border-radius: 18px;
  background: #120b1a;
  color: #ffcc80;
  text-align: center;
}

.trunk-sign__pumpkins {
  font-size: 2.4rem;
  line-height: 1.1;
}

.trunk-sign__title {
  font-size: 2.6rem;
  line-height: 1.1;
}

.trunk-sign__nowrap {
  white-space: nowrap;
}

.trunk-sign__lead {
  margin-top: 10px;
  font-size: 1.35rem;
  font-weight: bold;
  color: #ff9f1c;
}

.trunk-sign__body {
  margin-top: 6px;
  font-size: 1.05rem;
}

.trunk-sign__steps {
  list-style: none;
  margin: 16px auto 0;
  padding: 0;
  max-width: 460px;
  text-align: left;
  font-size: 1.1rem;
  line-height: 1.35;

  li {
    display: block;
    margin-bottom: 10px;
    padding-left: 2.2em;
    text-indent: -2.2em;
  }
}

.trunk-sign__step-icon {
  display: inline-block;
  width: 2.2em;
  text-indent: 0;
  text-align: center;
}

.trunk-sign__small {
  opacity: 0.8;
  font-size: 0.9em;
}

.trunk-sign__footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  margin-top: 10px;
}

.trunk-sign__qr {
  width: 120px;
  font-size: 0.75rem;
  line-height: 1.2;
}

.trunk-sign__qr-img {
  display: block;
  width: 96px;
  height: 96px;
  margin: 0 auto 4px;
  border-radius: 6px;
}

.trunk-sign__bye {
  font-size: 1.8rem;
}

.trunk-sign--ink-saver {
  background: #fff;
  color: #222;
  border-color: #999;

  .trunk-sign__title,
  .trunk-sign__lead,
  .trunk-sign__bye {
    color: #d35400;
  }
}

@media print {
  // the sign gets a whole page to itself, the cards follow on the next one
  .trunk-sign {
    display: flex;
    flex-direction: column;
    justify-content: center;
    width: 100%;
    max-width: none;
    height: 245mm;
    margin: 0;
    padding: 12mm 14mm;
    border-width: 4px;
    break-after: page;
    page-break-after: always;
    break-inside: avoid;
  }
  .trunk-sign__pumpkins {
    font-size: 3.4rem;
  }
  .trunk-sign__title {
    margin-top: 2mm;
    font-size: 3.4rem;
  }
  .trunk-sign__lead {
    margin-top: 8mm;
    font-size: 1.8rem;
  }
  .trunk-sign__body {
    margin-top: 4mm;
    font-size: 1.45rem;
  }
  .trunk-sign__steps {
    max-width: 150mm;
    margin-top: 10mm;
    font-size: 1.55rem;

    li {
      margin-bottom: 6mm;
    }
  }
  .trunk-sign__footer {
    margin-top: 8mm;
    gap: 14mm;
  }
  .trunk-sign__qr {
    width: 40mm;
    font-size: 0.85rem;
  }
  .trunk-sign__qr-img {
    width: 30mm;
    height: 30mm;
  }
  .trunk-sign__bye {
    font-size: 2.6rem;
  }
}
</style>
