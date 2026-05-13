// ============================================================
// OPTIONS — strike math, buy/sell, and the daily pricing model.
//
// Pricing model (per day, per contract):
//   1. Compute intrinsic value from the underlying vs. strike.
//   2. Compute a "time value" that decays as the option moves
//      further from the money.
//   3. Blend a momentum step (price * (1 + leveraged underlying
//      return + shock - theta)) with the intrinsic+time target.
// ============================================================

import { OPTIONS } from "../config.js";
import { randn, roundToNearestFive } from "../utils.js";
import { tradeAsset } from "./common.js";

// Default strike "width" — strikes sit ~8% above/below the underlying.
const DEFAULT_STRIKE_OFFSET_PCT = 0.08;

export function buyOption(state, assetId, qty) {
  return tradeAsset(state, "options", assetId, qty, "buy", "contract");
}

export function sellOption(state, assetId, qty) {
  return tradeAsset(state, "options", assetId, qty, "sell", "contract");
}

// For a given underlying price, return the rounded "lower" and "upper"
// strike prices that bracket it.
export function optionStrikesForUnderlying(underlyingPrice, offsetPct = DEFAULT_STRIKE_OFFSET_PCT) {
  const center = Math.max(1, underlyingPrice);
  const lower = roundToNearestFive(center * (1 - offsetPct));
  const upper = roundToNearestFive(center * (1 + offsetPct));
  return {
    lower: Math.min(lower, upper - 1),
    upper: Math.max(upper, lower + 1),
  };
}

// Step every option contract forward one day.
//
// We re-derive contracts from the OPTIONS catalog every tick so any
// edits to that catalog show up immediately, while preserving the
// per-option state (price, held contracts, history) the player has
// accumulated in this run.
export function evolveOptions(state, params, updatedIndexFunds) {
  const existingById = Object.fromEntries((state.options || []).map(o => [o.id, o]));
  const strikeOffsetPct = params.optionStrikeOffsetPct ?? DEFAULT_STRIKE_OFFSET_PCT;
  const optionsVol = params.volOptions ?? 0.075;

  return OPTIONS.map(template => {
    const previousState = existingById[template.id];
    const option = previousState
      ? { ...template, ...previousState }
      : { ...template, contracts: 0, costBasis: 0, price: template.startPrice, history: [template.startPrice] };

    const underlyingPrev = ((state.indexFunds || []).find(f => f.id === option.underlyingId)?.price) ?? 100;
    const underlyingNext = ((updatedIndexFunds || []).find(f => f.id === option.underlyingId)?.price) ?? underlyingPrev;

    const strikes = optionStrikesForUnderlying(underlyingNext, strikeOffsetPct);
    const strike = strikes[option.strikeRef] ?? option.strike ?? underlyingNext;
    const price = priceOption(option, underlyingPrev, underlyingNext, strike, optionsVol);

    return {
      ...option,
      strike,
      price,
      history: [...option.history, price].slice(-500),
    };
  });
}

// Pure price update for a single contract (exported for tests and newState prefill).
export function priceOption(option, underlyingPrev, underlyingNext, strike, dailyVol) {
  const direction = option.direction ?? (option.optionType === "put" ? -1 : 1);

  const intrinsic = option.optionType === "put"
    ? Math.max(strike - underlyingNext, 0)
    : Math.max(underlyingNext - strike, 0);

  const moneyness = Math.abs(underlyingNext - strike) / Math.max(strike, 1);
  const baseTimeValue = Math.max(0.15, underlyingNext * 0.015 * (1 - Math.min(moneyness, 1)));
  const timeValue = Math.max(0, baseTimeValue * (1 + randn() * 0.2));
  const fairValueTarget = intrinsic + timeValue;

  const underlyingRet = underlyingPrev > 0
    ? ((underlyingNext - underlyingPrev) / underlyingPrev)
    : 0;
  const shock = randn() * dailyVol;
  const drift = (underlyingRet * option.leverage * direction)
              + (shock * 0.6)
              - ((option.theta || 0.003) * 0.35);

  const momentumPrice = option.price * (1 + drift);
  return Math.max(0.05, (momentumPrice * 0.55) + (fairValueTarget * 0.45));
}
