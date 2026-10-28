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
