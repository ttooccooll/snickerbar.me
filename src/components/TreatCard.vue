<template>
  <div
    class="treat-card"
    :class="{
      'treat-card--claimed': claimed,
      'treat-card--ink-saver': inkSaver,
    }"
  >
    <div class="treat-card__title">
      <span aria-hidden="true">🎃</span>
      <span>{{ message || "Happy Halloween!" }}</span>
      <span aria-hidden="true">🎃</span>
    </div>
    <div class="treat-card__qr">
      <vue-qrcode
        :value="qrValue"
        :options="{
          errorCorrectionLevel: 'M',
          width: 480,
          margin: 2,
          color: { dark: '#000000', light: inkSaver ? '#ffffff' : '#ff9f1c' },
        }"
        tag="img"
        class="treat-card__qr-img"
        @click="$emit('copy', qrValue)"
      />
      <div v-if="claimed" class="treat-card__stamp no-print">
        <span aria-hidden="true">👻</span> Claimed!
      </div>
    </div>
    <div class="treat-card__amount">
      <span aria-hidden="true">🍬</span> {{ amountLabel }} of real bitcoin
    </div>
    <div class="treat-card__howto">
      <template v-if="qrStyle === 'link'">
        <b>For the grown-ups:</b> scan the big code with your phone camera. It
        opens a free bitcoin ecash wallet where you can claim this treat. Any
        Cashu wallet can scan it too. Claim it soon!
      </template>
      <template v-else>
        <b>For the grown-ups:</b> get a free Cashu ecash wallet like cashu.me
        ("Free wallet" code), then scan the big code with it to claim this
        treat. Claim it soon!
      </template>
    </div>
    <div class="treat-card__links">
      <div v-if="qrStyle !== 'link'" class="treat-card__link">
        <vue-qrcode
          value="https://cashu.me"
          :options="{
            width: 160,
            margin: 2,
            color: { dark: '#000000', light: inkSaver ? '#ffffff' : '#39d353' },
          }"
          tag="img"
          class="treat-card__small-qr"
        />
        <div>Free wallet</div>
      </div>
      <div class="treat-card__link">
        <vue-qrcode
          :value="whyBitcoinUrl"
          :options="{
            width: 160,
            margin: 2,
            color: { dark: '#000000', light: inkSaver ? '#ffffff' : '#b388ff' },
          }"
          tag="img"
          class="treat-card__small-qr"
        />
        <div>Why bitcoin?</div>
      </div>
    </div>
    <div class="treat-card__footer">
      <span v-if="number">Treat #{{ number }} · </span>{{ mintHost }}
    </div>
  </div>
</template>
<script>
import { defineComponent } from "vue";
import token from "src/js/token";
import { buildClaimLink } from "src/js/treats";
import { getShortUrl } from "src/js/wallet-helpers";

export default defineComponent({
  name: "TreatCard",
  mixins: [windowMixin],
  props: {
    token: { type: String, required: true },
    message: { type: String, default: "" },
    qrStyle: { type: String, default: "link" },
    claimBaseUrl: { type: String, default: "" },
    claimed: { type: Boolean, default: false },
    inkSaver: { type: Boolean, default: false },
    number: { type: Number, default: null },
  },
  emits: ["copy"],
  data: function () {
    return {
      whyBitcoinUrl: "https://youtu.be/24waV3Fwvow?si=yNBx0t5TXD6GhwwC",
    };
  },
  computed: {
    decoded: function () {
      try {
        return token.decode(this.token);
      } catch (e) {
        return null;
      }
    },
    amountLabel: function () {
      if (!this.decoded) {
        return "?";
      }
      const amount = token
        .getProofs(this.decoded)
        .reduce((sum, p) => sum + p.amount, 0);
      const unit = token.getUnit(this.decoded);
      if (unit === "sat") {
        return `${amount} ${amount === 1 ? "sat" : "sats"}`;
      }
      // always show the real amount on the card, even if the balance is hidden
      return this.formatCurrency(amount, unit, true);
    },
    mintHost: function () {
      return this.decoded ? getShortUrl(token.getMint(this.decoded)) : "";
    },
    qrValue: function () {
      return this.qrStyle === "link"
        ? buildClaimLink(this.claimBaseUrl, this.token)
        : this.token;
    },
  },
});
</script>
<style lang="scss">
.treat-card {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  max-width: 340px;
  margin: 0 auto;
  padding: 14px 14px 10px;
  border: 2px dashed #ff9f1c;
  border-radius: 14px;
  background: #120b1a;
  color: #ffb347;
  text-align: center;
  break-inside: avoid;
  page-break-inside: avoid;
}

.treat-card__title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-family: "Creepster", "Chiller", "Papyrus", fantasy;
  font-size: 1.6rem;
  line-height: 1.2;
  letter-spacing: 1px;
  color: #ff7518;
  margin-bottom: 8px;
}

.treat-card__qr {
  position: relative;
  width: 78%;
  margin: 0 auto;
}

.treat-card__qr-img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 8px;
  cursor: pointer;
}

.treat-card__stamp {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-14deg);
  padding: 6px 14px;
  border: 3px solid #b388ff;
  border-radius: 10px;
  background: rgba(18, 11, 26, 0.92);
  color: #d1b3ff;
  font-size: 1.5rem;
  font-weight: bold;
  white-space: nowrap;
}

.treat-card--claimed .treat-card__qr-img {
  opacity: 0.25;
}

.treat-card__amount {
  margin-top: 10px;
  font-size: 1.15rem;
  font-weight: bold;
  color: #ff9f1c;
}

.treat-card__howto {
  margin: 8px 4px 10px;
  font-size: 0.8rem;
  line-height: 1.35;
  color: #ffcc80;
}

.treat-card__links {
  display: flex;
  justify-content: center;
  gap: 18px;
  font-size: 0.7rem;
  color: #ffcc80;
}

.treat-card__small-qr {
  display: block;
  width: 72px;
  height: 72px;
  margin: 0 auto 2px;
  border-radius: 4px;
}

.treat-card__footer {
  margin-top: 8px;
  font-size: 0.65rem;
  opacity: 0.7;
}

.treat-card--ink-saver {
  background: #fff;
  color: #222;
  border-color: #999;

  .treat-card__title {
    color: #d35400;
  }
  .treat-card__amount {
    color: #d35400;
  }
  .treat-card__howto,
  .treat-card__links {
    color: #222;
  }
}

@media print {
  // sized so four cards fit on a Letter or A4 page
  .treat-card {
    display: inline-block;
    vertical-align: top;
    width: 88mm;
    max-width: none;
    margin: 0 2mm 5mm;
    padding: 3mm 3mm 2mm;
  }
  .treat-card__title {
    font-size: 1.35rem;
    margin-bottom: 1mm;
  }
  .treat-card__qr {
    width: 56mm;
  }
  .treat-card__amount {
    margin-top: 1mm;
    font-size: 1rem;
  }
  .treat-card__howto {
    margin: 1mm 2mm 2mm;
    font-size: 0.68rem;
  }
  .treat-card__small-qr {
    width: 13mm;
    height: 13mm;
  }
  .treat-card__footer {
    margin-top: 1mm;
  }
}
</style>
