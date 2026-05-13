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
import { optionStrikesForUnderlying, priceOption } from "./trading/options.js";
import { randn } from "./utils.js";

// Synthetic days before game day 1 — same model as evolveAssetPrices (vol + optional drift).
const DEFAULT_PREFILL_DAYS = 50;

function resolvePrefillDays(params, key) {
  const v = key != null ? params[key] : undefined;
  return Math.max(2, Math.min(200, v ?? DEFAULT_PREFILL_DAYS));
}

function geometricPrefill(anchor, vol, drift, n, initialJitterSigma) {
  let p = Math.max(0.01, anchor * (1 + randn() * initialJitterSigma));
  const history = [p];
  for (let i = 1; i < n; i++) {
    p = Math.max(0.01, p * (1 + drift + randn() * vol));
    history.push(p);
  }
  return { price: p, history };
}

// Synthetic month-end closes from a daily prefill (30-day "months" match simulation).
function monthlyClosesFromDailyPrefill(daily) {
  if (!daily.length) return [];
  const out = [];
  for (let idx = 29; idx < daily.length; idx += 30) {
    out.push(daily[idx]);
  }
  const last = daily[daily.length - 1];
  if (!out.length || out[out.length - 1] !== last) {
    out.push(last);
  }
  return out;
}

function newIndexFundInstance(f, params) {
  const vol = params.volIndex ?? 0.0126;
  const drift = params.driftIndex ?? 0.00025;
  const n = resolvePrefillDays(params, "indexPrefillDays");
  const { price, history } = geometricPrefill(f.startPrice, vol, drift, n, 0.12);
  return {
    ...f,
    shares: 0,
    costBasis: 0,
    price,
    startPrice: price,
    history,
    monthlyHistory: monthlyClosesFromDailyPrefill(history),
  };
}

function newCryptoInstance(c, params) {
  const vol = params.volCrypto ?? 0.04;
  const n = resolvePrefillDays(params, "cryptoPrefillDays");
  const { price, history } = geometricPrefill(c.startPrice, vol, 0, n, 0.22);
  return {
    ...c,
    coins: 0,
    costBasis: 0,
    price,
    startPrice: price,
    history,
  };
}

function newStockInstance(stk, params) {
  const vol = params.volStock ?? 0.02;
  const n = resolvePrefillDays(params, "stockPrefillDays");
  const { price, history } = geometricPrefill(stk.startPrice, vol, 0, n, 0.18);
  return {
    ...stk,
    shares: 0,
    costBasis: 0,
    price,
    startPrice: price,
    history,
  };
}

// Replay the real pricing step along a synthetic underlying path (strikes roll like live sim).
function newOptionInstances(params, spyDailyHistory) {
  const vol = params.volOptions ?? 0.075;
  const strikeOffsetPct = params.optionStrikeOffsetPct ?? 0.08;
  const hist = spyDailyHistory && spyDailyHistory.length ? spyDailyHistory : [100];

  return OPTIONS.map(template => {
    const strike0 =
      optionStrikesForUnderlying(hist[0], strikeOffsetPct)[template.strikeRef] ?? hist[0];
    let opt = {
      ...template,
      contracts: 0,
      costBasis: 0,
      price: template.startPrice,
      strike: strike0,
    };
    let price = priceOption({ ...opt, price: template.startPrice }, hist[0], hist[0], strike0, vol);
    opt = { ...opt, price, strike: strike0 };
    const history = [price];

    for (let i = 0; i < hist.length - 1; i++) {
      const uPrev = hist[i];
      const uNext = hist[i + 1];
      const strikes = optionStrikesForUnderlying(uNext, strikeOffsetPct);
      const strike = strikes[template.strikeRef] ?? uNext;
      price = priceOption({ ...opt, price }, uPrev, uNext, strike, vol);
      opt = { ...opt, strike, price };
      history.push(price);
    }

    return {
      ...opt,
      startPrice: price,
      history,
    };
  });
}

// Re-export appendLog so existing `import { appendLog } from "./state.js"`
// callers keep working. New code should import from ./log.js directly.
export { appendLog } from "./log.js";

// Build a brand-new game state. Accepts a `params` object that may
// override any of the starting conditions.
export function newState(params = {}) {
  const cash = params.startCash ?? 10_000;
  const corporateSpreadMult = params.corporateSpreadMult ?? 1.0;
  const nwDays = resolvePrefillDays(params, "netWorthPrefillDays");
  const roundedCash = Math.round(cash);

  const indexFunds = INDEX_FUNDS.map(f => newIndexFundInstance(f, params));
  const spy = indexFunds.find(f => f.id === "spy");
  const spyHist = spy?.history ?? [INDEX_FUNDS.find(f => f.id === "spy")?.startPrice ?? 100];

  return {
    day: 1,
    maxDays: params.maxDays ?? 2000,
    startCash: cash,
    cash,

    indexFunds,

    // Individual bond purchases live here; see src/trading/bonds.js
    bondHoldings: [],

    corporateBondOffers: CORPORATE_BOND_OFFERS.map(b => ({
      ...b,
      yield: Math.max(0.001, b.yield * corporateSpreadMult),
    })),

    yieldCurve: cloneYieldCurve(YIELD_CURVE),

    cryptos: CRYPTOS.map(c => newCryptoInstance(c, params)),

    stocks: STOCKS.map(stk => newStockInstance(stk, params)),

    options: newOptionInstances(params, spyHist),

    // Flat pre-game series (all cash, no positions) so the overview chart has
    // ≥2 points; `nextDay` appends live snapshots after this.
    netWorthHistory: Array.from({ length: nwDays }, () => roundedCash),
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
