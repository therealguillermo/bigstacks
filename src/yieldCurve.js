// ============================================================
// YIELD CURVE — Treasury yield interpolation + daily evolution.
//
// The yield curve drives every treasury bond's coupon. The curve
// itself is a small array of (term, yield) "pillars". Day-to-day
// it does a random walk biased back toward the baseline pillars.
// ============================================================

import { YIELD_CURVE } from "./config.js";
import { randn } from "./utils.js";

// Linearly interpolate the annual yield for `term` from a pillar curve.
// Below the first pillar we return the first pillar's yield;
// above the last we return the last's.
export function interpolateYield(curve, term) {
  const exact = curve.find(p => p.term === term);
  if (exact) return exact.yield;

  const below = [...curve].reverse().find(p => p.term <= term);
  const above = curve.find(p => p.term >= term);
  if (!below) return above.yield;
  if (!above) return below.yield;

  const t = (term - below.term) / (above.term - below.term);
  return below.yield + t * (above.yield - below.yield);
}

// Current market yield for `term`, using the state's evolving curve
// (or falling back to the baseline pillars if the state has none).
export function yieldForTerm(state, term) {
  const curve = state && state.yieldCurve && state.yieldCurve.length
    ? state.yieldCurve
    : YIELD_CURVE;
  return interpolateYield(curve, term);
}

// Defensive copy of a yield curve so callers can mutate freely.
export function cloneYieldCurve(curve) {
  return curve.map(p => ({ term: p.term, yield: p.yield }));
}

// Advance the yield curve by one day:
//   - each pillar takes a small Gaussian shock,
//   - then mean-reverts toward the baseline pillar with strength kappa,
//   - and is clamped to [yMin, yMax].
export function evolveYieldCurve(state, params = {}) {
  const vol   = params.yieldCurveVol   ?? 0.0007;
  const kappa = params.yieldCurveKappa ?? 0.018;
  const yMin  = params.yieldCurveMin   ?? 0.002;
  const yMax  = params.yieldCurveMax   ?? 0.20;

  const curve = state.yieldCurve && state.yieldCurve.length
    ? state.yieldCurve
    : YIELD_CURVE;

  return YIELD_CURVE.map((base, i) => {
    const current = curve[i]?.yield ?? base.yield;
    const shock   = randn() * vol;
    let y = current + shock + kappa * (base.yield - current);
    y = Math.max(yMin, Math.min(yMax, y));
    return { term: base.term, yield: y };
  });
}
