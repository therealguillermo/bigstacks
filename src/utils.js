// ============================================================
// UTILS — Pure helpers with no dependencies on game state.
// ============================================================

// Standard normal random variable via Box-Muller transform.
// Used as the "shock" term in every daily price walk.
export function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Round to the nearest multiple of 5, with a floor of 1.
// Used to keep option strike prices on tidy values.
export function roundToNearestFive(n) {
  return Math.max(1, Math.round(n / 5) * 5);
}

// Format a number as a whole-dollar amount, e.g. 12345.67 -> "$12,346".
export function fmt(n) {
  return "$" + Math.round(n).toLocaleString();
}
