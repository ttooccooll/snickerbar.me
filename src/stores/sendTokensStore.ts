import { defineStore } from "pinia";

export const useSendTokensStore = defineStore("sendTokensStore", {
  state: () => ({
    showSendTokens: false,
    showLockInput: false,
    sendData: {
      amount1: null,
      amount2: null,
      amount3: null,
      amount4: null,
      amount5: null,
      tokens: [],
      tokensBase64: [],
      memo: "",
    } as {
      amount1: number | null;
      amount2: number | null;
      amount3: number | null;
      amount4: number | null;
      amount5: number | null;
      tokens: string[];
      tokensBase64: string[];
      memo: string;
    },
  }),
  actions: {},
});
