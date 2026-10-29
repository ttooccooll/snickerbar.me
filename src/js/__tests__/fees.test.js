import { describe, expect, it } from "vitest";
import {
  affordableAmount,
  amountPlusInputFee,
  feeForCount,
  inputFeeForProofs,
} from "../fees";

const notes = (...ids) => ids.map((id) => ({ id, amount: 1 }));

describe("inputFeeForProofs", () => {
  it("is free on fee-free mints and for unknown keysets", () => {
    expect(inputFeeForProofs(notes("a", "a"), { a: 0 })).toEqual(0);
    expect(inputFeeForProofs(notes("x"), {})).toEqual(0);
    expect(inputFeeForProofs([], { a: 100 })).toEqual(0);
  });

  it("rounds the summed per-note fees up to whole sats", () => {
    // 100 ppk = 0.1 sat per note
    expect(inputFeeForProofs(notes("a"), { a: 100 })).toEqual(1);
    expect(
      inputFeeForProofs(notes(...Array(10).fill("a")), { a: 100 })
    ).toEqual(1);
    expect(
      inputFeeForProofs(notes(...Array(11).fill("a")), { a: 100 })
    ).toEqual(2);
    expect(inputFeeForProofs(notes("a", "a", "a"), { a: 1000 })).toEqual(3);
  });

  it("adds up notes from keysets with different fees", () => {
    const ppk = new Map([
      ["old", 0],
      ["new", 400],
    ]);
    expect(inputFeeForProofs(notes("old", "new", "new"), ppk)).toEqual(1);
    expect(inputFeeForProofs(notes("new", "new", "new"), ppk)).toEqual(2);
  });
});

describe("feeForCount", () => {
  it("matches the per-note rule", () => {
    expect(feeForCount(1, 100)).toEqual(1);
    expect(feeForCount(10, 100)).toEqual(1);
    expect(feeForCount(4, 1000)).toEqual(4);
    expect(feeForCount(3, 0)).toEqual(0);
    expect(feeForCount(0, 100)).toEqual(0);
  });
});

describe("amountPlusInputFee", () => {
  it("is the amount itself on fee-free mints", () => {
    expect(amountPlusInputFee(1024, 0)).toEqual(1024);
    expect(amountPlusInputFee(1024, undefined)).toEqual(1024);
    expect(amountPlusInputFee(0, 100)).toEqual(0);
  });

  it("adds the fee for the notes the split makes", () => {
    // 1024 + 1 = 1025 is two notes, still a 1 sat fee at 0.1 sat per note
    expect(amountPlusInputFee(1024, 100)).toEqual(1025);
    // 1023 is ten notes (1 sat), 1024 is a single note (still 1 sat)
    expect(amountPlusInputFee(1023, 100)).toEqual(1024);
    // a full sat per note: 7 + 3 = 10 is two notes, 7 + 2 = 9 is two notes
    expect(amountPlusInputFee(7, 1000)).toEqual(9);
  });

  it("always covers the amount plus the fee of its own notes", () => {
    for (const ppk of [1, 100, 250, 1000, 2000]) {
      for (let amount = 1; amount < 3000; amount += 37) {
        const target = amountPlusInputFee(amount, ppk);
        const notes = target.toString(2).split("").filter((b) => b === "1");
        expect(target).toBeGreaterThanOrEqual(
          amount + feeForCount(notes.length, ppk)
        );
        expect(target - amount).toBeLessThanOrEqual(
          feeForCount(64, ppk) + 1
        );
      }
    }
  });
});

describe("affordableAmount", () => {
  it("keeps the amount when it fits", () => {
    expect(affordableAmount(500, 510, 1024)).toEqual(500);
    expect(affordableAmount(1014, 1024, 1024)).toEqual(1014);
  });

  it("takes the shortfall off", () => {
    // 1,024 sat wallet, sending 1,024 needs 10 sat of fees on top
    expect(affordableAmount(1024, 1034, 1024)).toEqual(1014);
    expect(affordableAmount(1000, 1012.5, 1000)).toEqual(987);
  });

  it("gives up below the smallest amount the receiver takes", () => {
    expect(affordableAmount(10, 25, 5)).toBeNull();
    expect(affordableAmount(100, 150, 80, 50)).toBeNull();
    expect(affordableAmount(100, 150, 120, 50)).toEqual(70);
  });
});
