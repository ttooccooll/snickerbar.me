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
      amount6: null,
      amount7: null,
      amount8: null,
      amount9: null,
      amount10: null,
      tokens: [],
      tokensBase64: [],
      memo: "",
    } as {
      amount1: number | null;
      amount2: number | null;
      amount3: number | null;
      amount4: number | null;
      amount5: number | null;
      amount6: number | null;
      amount7: number | null;
      amount8: number | null;
      amount9: number | null;
      amount10: number | null;
      tokens: string[];
      tokensBase64: string[];
      memo: string;
    },
  }),
  actions: {},
});
