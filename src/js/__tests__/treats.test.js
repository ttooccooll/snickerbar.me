import { describe, expect, it } from "vitest";
import {
  MAX_TREATS,
  buildClaimLink,
  claimLinkProblem,
  defaultClaimBase,
  isLocalHostname,
  PUBLIC_CLAIM_WALLET,
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

  it("puts the token where {token} is, for other wallets' links", () => {
    expect(
      buildClaimLink("https://wallet.example/ecash/{token}", "cashuBabc")
    ).toEqual("https://wallet.example/ecash/cashuBabc");
    expect(
      buildClaimLink(" https://w.example/#/receive?t={token} ", "cashuBabc")
    ).toEqual("https://w.example/#/receive?t=cashuBabc");
  });

  it("accepts template links as claim wallets", () => {
    expect(claimLinkProblem("https://wallet.example/ecash/{token}")).toEqual(
      ""
    );
    expect(claimLinkProblem("http://localhost:3000/ecash/{token}")).not.toEqual(
      ""
    );
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

describe("isLocalHostname", () => {
  it.each([
    "localhost",
    "LOCALHOST",
    "127.0.0.1",
    "[::1]",
    "192.168.1.20",
    "10.0.0.5",
    "172.20.1.1",
    "169.254.3.4",
    "macbook.local",
    "",
  ])("can't be opened by a parent's phone: %s", (host) => {
    expect(isLocalHostname(host)).toBe(true);
  });

  it.each(["snickerbar.me", "wallet.example.com", "8.8.8.8", "172.32.0.1"])(
    "is public: %s",
    (host) => {
      expect(isLocalHostname(host)).toBe(false);
    }
  );
});

describe("defaultClaimBase", () => {
  const loc = (href) => new URL(href);

  it("uses this wallet when it runs on a public address", () => {
    expect(defaultClaimBase(loc("https://snickerbar.me/"))).toEqual(
      "https://snickerbar.me/"
    );
    expect(defaultClaimBase(loc("https://example.com/wallet/"))).toEqual(
      "https://example.com/wallet/"
    );
  });

  it("never puts a laptop's dev server on the cards", () => {
    expect(defaultClaimBase(loc("https://localhost:8080/"))).toEqual(
      PUBLIC_CLAIM_WALLET
    );
    expect(defaultClaimBase(loc("https://192.168.1.20:8080/"))).toEqual(
      PUBLIC_CLAIM_WALLET
    );
    expect(
      defaultClaimBase({
        hostname: "localhost",
        protocol: "capacitor:",
        origin: "capacitor://localhost",
        pathname: "/",
      })
    ).toEqual(PUBLIC_CLAIM_WALLET);
  });
});

describe("claimLinkProblem", () => {
  it("accepts public https wallets", () => {
    expect(claimLinkProblem("https://snickerbar.me/")).toEqual("");
  });

  it("explains what's wrong with the others", () => {
    expect(claimLinkProblem("https://localhost:8080/")).toMatch(
      /can't open localhost:8080/
    );
    expect(claimLinkProblem("http://example.com/")).toMatch(/https/);
    expect(claimLinkProblem("snickerbar")).toMatch(/web address/);
  });
});
