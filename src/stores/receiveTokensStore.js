import { defineStore } from "pinia";

export const useReceiveTokensStore = defineStore("receiveTokensStore", {
  state: () => ({
    showReceiveTokens: false,
    // opened from a trick-or-treat claim link
    fromClaimLink: false,
    // the big "You got a treat!" screen for claim links
    showClaimTreat: false,
    receiveData: {
      tokensBase64: "",
      p2pkPrivateKey: "",
    },
  }),
  actions: {},
});
