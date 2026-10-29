// Mint fees (NUT-02). A mint may charge `input_fee_ppk` (parts per thousand
// sats) for every ecash note spent in a transaction; the total is rounded up
// to whole sats.

/**
 * The fee a mint charges for spending these notes.
 *
 * @param {{id: string}[]} proofs the notes being spent
 * @param {Map<string, number> | Object<string, number>} ppkByKeysetId
 */
export function inputFeeForProofs(proofs, ppkByKeysetId) {
  const lookup =
    ppkByKeysetId instanceof Map
      ? (id) => ppkByKeysetId.get(id)
      : (id) => ppkByKeysetId[id];
  const ppk = proofs.reduce((sum, p) => sum + (Number(lookup(p.id)) || 0), 0);
  return Math.ceil(ppk / 1000);
}

/**
 * The fee for spending `count` notes of a keyset with the given fee.
 */
export function feeForCount(count, inputFeePpk) {
  if (!inputFeePpk || count <= 0) {
    return 0;
  }
  return Math.ceil((count * inputFeePpk) / 1000);
}

// number of notes an exact split makes: one per power of two
function notesFor(amount) {
  let n = 0;
  for (let a = Math.floor(amount); a > 0; a = Math.floor(a / 2)) {
    n += a & 1;
  }
  return n;
}

/**
 * How much to split off so that `amount` is still covered after the mint
 * took its input fee for spending the split-off notes. On fee-free mints
 * that's just `amount`.
 */
export function amountPlusInputFee(amount, inputFeePpk) {
  if (!inputFeePpk || amount <= 0) {
    return amount;
  }
  let target = amount;
  let highest = amount;
  for (let i = 0; i < 8; i++) {
    const next = amount + feeForCount(notesFor(target), inputFeePpk);
    if (next === target) {
      return target;
    }
    target = next;
    highest = Math.max(highest, target);
  }
  // never settled: covering a sat too much is better than one too few
  return highest;
}

/**
 * A smaller amount that fits the balance once all fees are paid, or null
 * if even `minAmount` wouldn't fit. Fees shrink (or stay) when the amount
 * gets smaller, so taking the whole shortfall off is on the safe side.
 */
export function affordableAmount(amount, totalCost, balance, minAmount = 1) {
  const shortfall = totalCost - balance;
  if (shortfall <= 0) {
    return amount;
  }
  const smaller = Math.floor(amount - shortfall);
  return smaller >= Math.max(1, minAmount) ? smaller : null;
}
