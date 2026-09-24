import token from "../token";
import { getEncodedTokenV4 } from "@cashu/cashu-ts";
import { describe, expect, it, vi } from "vitest";

// token.ts only needs the mints store to look up units; keep the wallet's
// stores (which need a browser) out of these tests
vi.mock("src/stores/mints", () => ({
  useMintsStore: () => ({ mints: [], proofsToWalletProofs: (p) => p }),
}));

const VALID_V3_TOKEN =
  "cashuAeyJ0b2tlbiI6W3sicHJvb2ZzIjpbeyJpZCI6IkkyeU4raVJZZmt6VCIsImFtb3VudCI6MSwiQyI6IjAyZTRkYmJmMGZmNDI4YTU4ZDZjNjZjMTljNjI0YWRlY2MxNzg0YzdlNTU5ODZhNGVmNDQ4NDM5MzZhM2M4ZjM1OSIsInNlY3JldCI6ImZHWVpzSlVjME1mU1orVlhGandEZXNsNkJScW5wNmRSblZpUGQ2L00yQ0k9In1dLCJtaW50IjoiaHR0cHM6Ly84MzMzLnNwYWNlOjMzMzgifV19";

describe("token", () => {
  describe("decode", () => {
    it("should properly decode a V3 token", () => {
      const decoded = token.decode(VALID_V3_TOKEN);
      expect(decoded.token.length).toEqual(1);
      const { mint, proofs } = decoded.token[0];
      expect(mint).toEqual("https://8333.space:3338");
      expect(proofs.length).toEqual(1);
    });

    it("should round-trip a V4 token from a mint with v2 (01…) keyset ids", () => {
      // 2025+ mints (e.g. Nutshell 0.17+) use 33 byte keyset ids
      const keysetId =
        "0166d9a712be9936acc1138096d8f0ed80a005cb18b406cb79a66219a7414fda5b";
      const proof = {
        id: keysetId,
        amount: 16,
        secret:
          "b3a0d4e9c2f1a8b7d6e5f4c3b2a1908f7e6d5c4b3a291807f6e5d4c3b2a19080",
        C: "02e4dbbf0ff428a58d6c66c19c624adecc1784c7e55986a4ef44843936a3c8f359",
      };
      const encoded = getEncodedTokenV4({
        token: [{ mint: "https://mint.example.com", proofs: [proof] }],
        unit: "sat",
      });
      expect(encoded.startsWith("cashuB")).toBe(true);
      const decoded = token.decode(encoded);
      const { mint, proofs } = decoded.token[0];
      expect(mint).toEqual("https://mint.example.com");
      expect(proofs).toEqual([proof]);
      expect(token.getUnit(decoded)).toEqual("sat");
    });
  });

  it("should throw if the token is invalid", () => {
    expect(() => token.decode("invalid")).toThrow();
  });
});
