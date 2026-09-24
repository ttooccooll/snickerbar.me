// Helpers for the trick-or-treat ecash sheet. Kept free of Vue/Pinia so they
// can be unit tested.

export const MAX_TREATS = 60;

export const TREAT_MODES = ["same", "mystery", "custom"];

/**
 * Returns the list of amounts (in the wallet's display unit) for a bag of
 * treats, or throws with a human readable message if the settings are invalid.
 *
 * @param {object} settings
 * @param {number} settings.count number of treats
 * @param {"same"|"mystery"|"custom"} settings.mode
 * @param {number} settings.amount amount per treat ("same" mode)
 * @param {number} settings.minAmount lower bound ("mystery" mode)
 * @param {number} settings.maxAmount upper bound ("mystery" mode)
 * @param {number[]} settings.customAmounts one amount per treat ("custom" mode)
 * @param {() => number} [random] source of randomness in [0, 1)
 */
export function planTreatAmounts(settings, random = Math.random) {
  const count = Number(settings.count);
  if (!Number.isInteger(count) || count < 1) {
    throw new Error("Add at least one treat.");
  }
  if (count > MAX_TREATS) {
    throw new Error(`That's a lot of candy! Max ${MAX_TREATS} treats per bag.`);
  }
  const isPositiveInt = (x) => Number.isInteger(x) && x > 0;

  switch (settings.mode) {
    case "same": {
      const amount = Number(settings.amount);
      if (!isPositiveInt(amount)) {
        throw new Error("Enter an amount per treat.");
      }
      return Array(count).fill(amount);
    }
    case "mystery": {
      const min = Number(settings.minAmount);
      const max = Number(settings.maxAmount);
      if (!isPositiveInt(min) || !isPositiveInt(max)) {
        throw new Error("Enter a minimum and maximum amount.");
      }
      if (min > max) {
        throw new Error("The minimum can't be bigger than the maximum.");
      }
      return Array.from(
        { length: count },
        () => min + Math.floor(random() * (max - min + 1))
      );
    }
    case "custom": {
      const amounts = (settings.customAmounts || [])
        .slice(0, count)
        .map(Number);
      if (amounts.length < count || !amounts.every(isPositiveInt)) {
        throw new Error("Enter an amount for every treat.");
      }
      return amounts;
    }
    default:
      throw new Error("Unknown treat mode.");
  }
}

/**
 * The most a bag can cost. Mystery bags are funded for the worst case so the
 * wallet never runs dry halfway through.
 */
export function maxBagTotal(settings) {
  const count = Number(settings.count) || 0;
  switch (settings.mode) {
    case "same":
      return count * (Number(settings.amount) || 0);
    case "mystery":
      return count * (Number(settings.maxAmount) || 0);
    case "custom":
      return (settings.customAmounts || [])
        .slice(0, count)
        .reduce((sum, a) => sum + (Number(a) || 0), 0);
    default:
      return 0;
  }
}

/**
 * Number of ecash notes (proofs) an amount is made of. Each note makes the QR
 * code bigger, so fewer notes = easier scanning.
 */
export function noteCount(amount) {
  let n = 0;
  let a = Math.floor(Math.abs(amount));
  while (a > 0) {
    n += a & 1;
    a = Math.floor(a / 2);
  }
  return n;
}

/**
 * Builds a link that opens a wallet and pre-fills the token, so a plain phone
 * camera can claim it. Falls back to the bare token if no base URL is given.
 */
export function buildClaimLink(baseUrl, token) {
  if (!baseUrl) {
    return token;
  }
  const url = baseUrl.trim().split("#")[0];
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}token=${token}`;
}

/**
 * Keyset IDs are hex strings: "00…" (v1) and "01…" (v2, used by 2025+ mints).
 * Very old mints used base64 IDs.
 */
export function isHexKeysetId(id) {
  return typeof id === "string" && /^[0-9a-f]+$/i.test(id);
}
