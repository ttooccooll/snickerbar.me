import { defineStore } from "pinia";
import { useLocalStorage } from "@vueuse/core";

export type TreatSettings = {
  count: number;
  mode: "same" | "mystery" | "custom";
  amount: number | null;
  minAmount: number | null;
  maxAmount: number | null;
  customAmounts: (number | null)[];
  message: string;
  qrStyle: "link" | "token";
  claimBaseUrl: string;
  inkSaver: boolean;
  sound: boolean;
};

export const defaultTreatSettings = (): TreatSettings => ({
  count: 5,
  mode: "same",
  amount: 21,
  minAmount: 10,
  maxAmount: 100,
  customAmounts: [],
  message: "Happy Halloween!",
  qrStyle: "link",
  claimBaseUrl: "",
  inkSaver: false,
  sound: true,
});

export const useSendTokensStore = defineStore("sendTokensStore", {
  state: () => ({
    showSendTokens: false,
    showLockInput: false,
    // remembered between visits so next Halloween starts where you left off
    treatSettings: useLocalStorage<TreatSettings>(
      "snickerbar.treatSettings",
      defaultTreatSettings(),
      { mergeDefaults: true }
    ),
    sendData: {
      // one encoded token per treat
      tokens: [],
      // set when a single token from the history is shown
      tokensBase64: "",
      memo: "",
    } as {
      tokens: string[];
      tokensBase64: string;
      memo: string;
    },
  }),
  actions: {},
});
