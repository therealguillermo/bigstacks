// ============================================================
// SIMULATION — Advance the game state by one day.
//
// This file is intentionally short: every asset class owns its
// own evolution logic in src/trading/*.js. The job of `nextDay`
// is simply to call those in the right order and stitch the
// results back into a new state object.
//
// Daily order of operations:
//   1. Pay/accrue bond coupons and process any maturities.
//   2. Bump the day counter and check for a month boundary.
//   3. Evolve the yield curve.
//   4. Evolve all risky assets (index funds, crypto, stocks, options).
//      Options evolve last because their price depends on the
//      *new* underlying index fund prices.
//   5. Append the new net worth snapshot.
//   6. If the run just ended, log the final summary line.
// ============================================================

import { fmt } from "./utils.js";
import { netWorth } from "./state.js";
import { evolveYieldCurve } from "./yieldCurve.js";
import { processBondsForDay } from "./trading/bonds.js";
import { evolveIndexFunds } from "./trading/indexFunds.js";
import { evolveCryptos } from "./trading/crypto.js";
import { evolveStocks } from "./trading/stocks.js";
import { evolveOptions } from "./trading/options.js";

// One trading day = one call to nextDay.
export function nextDay(state, params = {}) {
  if (state.day >= state.maxDays) return state;

  const bondResult = processBondsForDay(state);

  const newDay = state.day + 1;
  const isMonthEnd = newDay % 30 === 0;

  const yieldCurve      = evolveYieldCurve(state, params);
  const updatedIndex    = evolveIndexFunds(state, params, isMonthEnd);
  const updatedCryptos  = evolveCryptos(state, params);
  const updatedStocks   = evolveStocks(state, params);
  const updatedOptions  = evolveOptions(state, params, updatedIndex);

  const updated = {
    ...state,
    day: newDay,
    cash: state.cash + bondResult.cashDelta,
    yieldCurve,
    indexFunds: updatedIndex,
    cryptos: updatedCryptos,
    stocks: updatedStocks,
    options: updatedOptions,
    bondHoldings: bondResult.bondHoldings,
    log: [...state.log, ...bondResult.logEntries],
  };

  const nw = netWorth(updated);
  const withNetWorth = {
    ...updated,
    netWorthHistory: [...state.netWorthHistory, Math.round(nw)].slice(-500),
  };

  if (newDay >= state.maxDays) {
    return {
      ...withNetWorth,
      log: [...withNetWorth.log, {
        msg: `── RUN OVER ── Net worth: $${fmt(nw)}`,
        type: "event",
        day: newDay,
      }],
    };
  }

  return withNetWorth;
}
