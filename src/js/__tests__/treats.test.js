import { describe, expect, it } from "vitest";
import {
  MAX_TREATS,
  buildClaimLink,
  daysUntilHalloween,
  isAfterHalloween,
  mascotFor,
  MASCOTS,
  isHexKeysetId,
  maxBagTotal,
  noteCount,
  planTreatAmounts,
} from "../treats";

describe("planTreatAmounts", () => {
  it("gives every treat the same amount", () => {
    expect(planTreatAmounts({ count: 3, mode: "same", amount: 21 })).toEqual([
      21, 21, 21,
    ]);
  });

  it("rolls mystery amounts within the bounds", () => {
    const rolls = [0, 0.5, 0.9999];
    let i = 0;
    const amounts = planTreatAmounts(
      { count: 3, mode: "mystery", minAmount: 10, maxAmount: 20 },
      () => rolls[i++]
    );
    expect(amounts).toEqual([10, 15, 20]);
  });

  it("uses one custom amount per treat", () => {
    expect(
      planTreatAmounts({
        count: 2,
        mode: "custom",
        customAmounts: [5, 50, 500],
      })
    ).toEqual([5, 50]);
  });

  it.each([
    [{ count: 0, mode: "same", amount: 1 }, /at least one/],
    [{ count: MAX_TREATS + 1, mode: "same", amount: 1 }, /Max/],
    [{ count: 2, mode: "same", amount: 0 }, /amount per treat/],
    [{ count: 2, mode: "same", amount: 1.5 }, /amount per treat/],
    [{ count: 2, mode: "mystery", minAmount: 9, maxAmount: 3 }, /minimum/],
    [{ count: 2, mode: "custom", customAmounts: [5] }, /every treat/],
    [{ count: 2, mode: "custom", customAmounts: [5, -1] }, /every treat/],
    [{ count: 2, mode: "nope" }, /Unknown/],
  ])("rejects invalid settings %#", (settings, message) => {
    expect(() => planTreatAmounts(settings)).toThrow(message);
  });
});

describe("maxBagTotal", () => {
  it("funds mystery bags for the worst case", () => {
    expect(
      maxBagTotal({ count: 4, mode: "mystery", minAmount: 1, maxAmount: 50 })
    ).toEqual(200);
  });

  it("sums custom amounts of the treats in the bag only", () => {
    expect(
      maxBagTotal({ count: 2, mode: "custom", customAmounts: [3, 4, 100] })
    ).toEqual(7);
  });
});

describe("noteCount", () => {
  it("counts the power-of-two notes an amount is made of", () => {
    expect(noteCount(1)).toEqual(1);
    expect(noteCount(21)).toEqual(3);
    expect(noteCount(64)).toEqual(1);
    expect(noteCount(100)).toEqual(3);
  });
});

describe("buildClaimLink", () => {
  it("appends the token to the wallet url", () => {
    expect(buildClaimLink("https://snickerbar.me/", "cashuBabc")).toEqual(
      "https://snickerbar.me/?token=cashuBabc"
    );
  });

  it("keeps existing query params and drops the hash", () => {
    expect(buildClaimLink("https://w.example/?a=1#/x", "cashuBabc")).toEqual(
      "https://w.example/?a=1&token=cashuBabc"
    );
  });

  it("falls back to the bare token", () => {
    expect(buildClaimLink("", "cashuBabc")).toEqual("cashuBabc");
  });
});

describe("isHexKeysetId", () => {
  it("recognizes v1 and v2 hex keyset ids", () => {
    expect(isHexKeysetId("009a1f293253e41e")).toBe(true);
    expect(
      isHexKeysetId(
        "0166d9a712be9936acc1138096d8f0ed80a005cb18b406cb79a66219a7414fda5b"
      )
    ).toBe(true);
  });

  it("rejects legacy base64 keyset ids", () => {
    expect(isHexKeysetId("I2yN+iRYfkzT")).toBe(false);
  });
});

describe("daysUntilHalloween", () => {
  it("counts down to October 31", () => {
    expect(daysUntilHalloween(new Date(2026, 8, 24, 15, 30))).toEqual(37);
    expect(daysUntilHalloween(new Date(2026, 9, 30, 23, 59))).toEqual(1);
  });

  it("is zero on Halloween", () => {
    expect(daysUntilHalloween(new Date(2026, 9, 31, 20, 0))).toEqual(0);
  });

  it("rolls over to next year after Halloween", () => {
    expect(daysUntilHalloween(new Date(2026, 10, 1))).toEqual(364);
  });
});

describe("mascotFor", () => {
  it("cycles through the monsters", () => {
    expect(mascotFor(0)).toBe(MASCOTS[0]);
    expect(mascotFor(MASCOTS.length + 1)).toBe(MASCOTS[1]);
  });
});

describe("isAfterHalloween", () => {
  it("is true in November and December only", () => {
    expect(isAfterHalloween(new Date(2026, 9, 31))).toBe(false);
    expect(isAfterHalloween(new Date(2026, 10, 1))).toBe(true);
    expect(isAfterHalloween(new Date(2026, 11, 31))).toBe(true);
    expect(isAfterHalloween(new Date(2027, 0, 1))).toBe(false);
  });
});
