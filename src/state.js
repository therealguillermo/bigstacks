// ============================================================
// STATE — Build a fresh game state and value the portfolio.
// (The log-append helper lives in ./log.js to keep the import
// graph acyclic.)
// ============================================================

import {
  YIELD_CURVE,
  CORPORATE_BOND_OFFERS,
  INDEX_FUNDS,
  CRYPTOS,
  STOCKS,
  OPTIONS,
} from "./config.js";
import { cloneYieldCurve } from "./yieldCurve.js";
import { optionStrikesForUnderlying } from "./trading/options.js";

// Re-export appendLog so existing `import { appendLog } from "./state.js"`
// callers keep working. New code should import from ./log.js directly.
export { appendLog } from "./log.js";

// Build a brand-new game state. Accepts a `params` object that may
// override any of the starting conditions.
export function newState(params = {}) {
  const cash = params.startCash ?? 10_000;
  const baseUnderlying = INDEX_FUNDS.find(f => f.id === "spy")?.startPrice ?? 100;
  const strikes = optionStrikesForUnderlying(baseUnderlying, params.optionStrikeOffsetPct ?? 0.08);
  const corporateSpreadMult = params.corporateSpreadMult ?? 1.0;

  return {
    day: 1,
    maxDays: params.maxDays ?? 2000,
    startCash: cash,
    cash,

    indexFunds: INDEX_FUNDS.map(f => ({
      ...f,
      shares: 0,
      costBasis: 0,
      price: f.startPrice,
      history: [f.startPrice],
      monthlyHistory: [f.startPrice],
    })),

    // Individual bond purchases live here; see src/trading/bonds.js
    bondHoldings: [],

    corporateBondOffers: CORPORATE_BOND_OFFERS.map(b => ({
      ...b,
      yield: Math.max(0.001, b.yield * corporateSpreadMult),
    })),

    yieldCurve: cloneYieldCurve(YIELD_CURVE),

    cryptos: CRYPTOS.map(c => ({
      ...c,
      coins: 0,
      costBasis: 0,
      price: c.startPrice,
      history: [c.startPrice],
    })),

    stocks: STOCKS.map(stk => ({
      ...stk,
      shares: 0,
      costBasis: 0,
      price: stk.startPrice,
      history: [stk.startPrice],
    })),

    options: OPTIONS.map(opt => ({
      ...opt,
      strike: strikes[opt.strikeRef] ?? baseUnderlying,
      contracts: 0,
      costBasis: 0,
      price: opt.startPrice,
      history: [opt.startPrice],
    })),

    netWorthHistory: [cash],
    log: [],
  };
}

// Sum the market value of every non-cash position.
export function portfolioValue(state) {
  const bondsValue   = (state.bondHoldings || []).reduce((sum, b)  => sum + b.faceValue,            0);
  const indexValue   = (state.indexFunds   || []).reduce((sum, f)  => sum + (f.shares    * f.price), 0);
  const cryptoValue  = (state.cryptos      || []).reduce((sum, c)  => sum + (c.coins     * c.price), 0);
  const stockValue   = (state.stocks       || []).reduce((sum, st) => sum + (st.shares   * st.price), 0);
  const optionsValue = (state.options      || []).reduce((sum, op) => sum + (op.contracts * op.price), 0);
  return indexValue + bondsValue + cryptoValue + stockValue + optionsValue;
}

// Net worth = cash + market value of every position.
export function netWorth(state) {
  return state.cash + portfolioValue(state);
}
