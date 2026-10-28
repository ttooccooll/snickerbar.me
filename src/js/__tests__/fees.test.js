import { describe, expect, it } from "vitest";
import { feeForCount, inputFeeForProofs } from "../fees";

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
