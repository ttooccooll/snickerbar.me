// Making sense of whatever a store's QR code (or the clipboard) holds, so a
// parent can pay with their treat. Kept free of Vue/Pinia so it can be unit
// tested.

const LIGHTNING_ADDRESS = /^[a-z0-9._+~-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
// bech32 invoices: lnbc (mainnet), lntb, lntbs, lnbcrt, lnsb
const BOLT11 = /^ln(bc|tb|sb)[0-9a-z]*1[02-9ac-hj-np-z]+$/;

/**
 * Turns a scanned or pasted payment request into something payable.
 * Understands what store terminals show: "lightning:" links, upper case QR
 * codes and "bitcoin:" QR codes that carry a Lightning invoice.
 *
 * @param {string} raw
 * @returns {{ type: "bolt11" | "lnurl" | "address", value: string } | null}
 */
export function parseLightningRequest(raw) {
  let req = String(raw || "").trim();
  if (!req) {
    return null;
  }
  // bitcoin:bc1q...?amount=0.0001&lightning=LNBC... or a web link with
  // ?lightning=LNURL1...
  const param = req.match(/[?&]lightning=([^&#\s]+)/i);
  if (param) {
    try {
      req = decodeURIComponent(param[1]);
    } catch (e) {
      req = param[1];
    }
  }
  req = req.replace(/^(lightning|lnurl):(\/\/)?/i, "").trim();
  const lower = req.toLowerCase();
  if (lower.startsWith("lnurl1")) {
    return { type: "lnurl", value: lower };
  }
  if (BOLT11.test(lower)) {
    return { type: "bolt11", value: lower };
  }
  if (LIGHTNING_ADDRESS.test(req)) {
    return { type: "address", value: lower };
  }
  return null;
}
