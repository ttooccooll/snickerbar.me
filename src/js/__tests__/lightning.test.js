import { describe, expect, it } from "vitest";
import { parseLightningRequest } from "../lightning";

const INVOICE =
  "lnbc210n1p4wydx59qypqqqdqqxqrrsssp5xzd8mrw3fapp5x4h6v2n7ag6xahj4mzv3hwq2tc0lqr4n0ghfs9q";
const LNURL =
  "lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0v9cxj0m385ekvcenxc6r2c35xvukxefcv5mkvv34x5ekzd3ev56nyd3hxqurzepexejxxepnxscrvwfnv9nxzcn9xq6xyefhvgcxxcmyxymnserxfq5fns";

describe("parseLightningRequest", () => {
  it("reads plain and upper case invoices", () => {
    expect(parseLightningRequest(INVOICE)).toEqual({
      type: "bolt11",
      value: INVOICE,
    });
    expect(parseLightningRequest(INVOICE.toUpperCase())).toEqual({
      type: "bolt11",
      value: INVOICE,
    });
    expect(parseLightningRequest(`  ${INVOICE}\n`).value).toEqual(INVOICE);
  });

  it("strips lightning: links", () => {
    expect(parseLightningRequest(`lightning:${INVOICE}`).value).toEqual(
      INVOICE
    );
    expect(
      parseLightningRequest(`LIGHTNING:${INVOICE.toUpperCase()}`).value
    ).toEqual(INVOICE);
  });

  it("finds the invoice in a bitcoin: QR code from a store terminal", () => {
    const bip21 = `bitcoin:BC1QYLH3U67J673H6Y6ALV70M0PL2YZ53TZHVXGG7U?amount=0.00001&label=Coffee&lightning=${INVOICE.toUpperCase()}`;
    expect(parseLightningRequest(bip21)).toEqual({
      type: "bolt11",
      value: INVOICE,
    });
  });

  it("reads LNURLs, also inside lightning: and lnurl: links and web links", () => {
    expect(parseLightningRequest(LNURL)).toEqual({
      type: "lnurl",
      value: LNURL,
    });
    expect(parseLightningRequest(LNURL.toUpperCase()).value).toEqual(LNURL);
    expect(
      parseLightningRequest(`lightning:${LNURL.toUpperCase()}`).value
    ).toEqual(LNURL);
    expect(parseLightningRequest(`lnurl:${LNURL}`).value).toEqual(LNURL);
    expect(
      parseLightningRequest(
        `https://shop.example/pay?lightning=${LNURL.toUpperCase()}`
      ).value
    ).toEqual(LNURL);
  });

  it("reads Lightning addresses", () => {
    expect(parseLightningRequest("Satoshi@Coinos.io")).toEqual({
      type: "address",
      value: "satoshi@coinos.io",
    });
    expect(
      parseLightningRequest("lightning:tips@walletofsatoshi.com").value
    ).toEqual("tips@walletofsatoshi.com");
  });

  it("returns null for anything that isn't payable over Lightning", () => {
    expect(parseLightningRequest("")).toBeNull();
    expect(parseLightningRequest(undefined)).toBeNull();
    expect(
      parseLightningRequest(
        "bitcoin:bc1qylh3u67j673h6y6alv70m0pl2yz53tzhvxgg7u"
      )
    ).toBeNull();
    expect(
      parseLightningRequest("https://snickerbar.me/?token=cashuBo2F0")
    ).toBeNull();
    expect(parseLightningRequest("cashuBo2Ftd")).toBeNull();
    expect(parseLightningRequest("hello there")).toBeNull();
    expect(parseLightningRequest("not an @ address")).toBeNull();
  });
});
