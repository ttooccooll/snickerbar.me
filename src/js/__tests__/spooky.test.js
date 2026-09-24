import { describe, expect, it } from "vitest";
import { hashString, treatName } from "../spooky";

describe("treatName", () => {
  it("gives every treat a cursed name that never changes", () => {
    const name = treatName("cashuBabc");
    expect(name).toMatch(/^The \w+ [\w ]+ (of|from) /);
    expect(treatName("cashuBabc")).toEqual(name);
  });

  it("gives different treats different names", () => {
    const names = new Set(
      Array.from({ length: 50 }, (_, i) => treatName("token" + i))
    );
    expect(names.size).toBeGreaterThan(40);
  });

  it("hashes deterministically", () => {
    expect(hashString("")).toEqual(0x811c9dc5);
    expect(hashString("a")).not.toEqual(hashString("b"));
  });
});
