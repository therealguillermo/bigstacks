// ============================================================
// GAME LOGIC — no DOM, no rendering, pure state + functions
// ============================================================

// Yield curve baseline: term (years) → annual yield (curve in state mean-reverts here over time)
export const YIELD_CURVE = [
  { term: 1,  yield: 0.030 },
  { term: 2,  yield: 0.035 },
  { term: 5,  yield: 0.042 },
  { term: 10, yield: 0.048 },
  { term: 30, yield: 0.052 },
];

export const INDEX_FUNDS = [
  { id: "spy",  name: "SPY (S&P 500)", startPrice: 100.0, dailyVol: 0.0126 },
  { id: "qqq",  name: "QQQ (Nasdaq 100)", startPrice: 90.0, dailyVol: 0.0150 },
  { id: "vti",  name: "VTI (Total Market)", startPrice: 80.0, dailyVol: 0.0118 },
  { id: "dia",  name: "DIA (Dow 30)", startPrice: 70.0, dailyVol: 0.0105 },
  { id: "iwm",  name: "IWM (Russell 2000)", startPrice: 65.0, dailyVol: 0.0140 },
];

export const CRYPTOS = [
  { id: "btc", name: "Bitcoin (BTC)", startPrice: 50.0, dailyVol: 0.0400 },
  { id: "eth", name: "Ethereum (ETH)", startPrice: 38.0, dailyVol: 0.0480 },
  { id: "sol", name: "Solana (SOL)", startPrice: 24.0, dailyVol: 0.0600 },
];

export const STOCKS = [
  { id: "aapl", name: "Apple (AAPL)", startPrice: 45.0, dailyVol: 0.0180 },
  { id: "msft", name: "Microsoft (MSFT)", startPrice: 48.0, dailyVol: 0.0170 },
  { id: "nvda", name: "NVIDIA (NVDA)", startPrice: 42.0, dailyVol: 0.0300 },
  { id: "tsla", name: "Tesla (TSLA)", startPrice: 32.0, dailyVol: 0.0360 },
];

export const OPTIONS = [
  { id: "spy-90-put",  name: "SPY 90 Put",  optionType: "put",  strike: 90,  startPrice: 7.0,  dailyVol: 0.0800, underlyingId: "spy", leverage: 3.2, theta: 0.0035, direction: -1 },
  { id: "spy-100-put", name: "SPY 100 Put", optionType: "put",  strike: 100, startPrice: 9.0,  dailyVol: 0.0820, underlyingId: "spy", leverage: 3.3, theta: 0.0038, direction: -1 },
  { id: "spy-110-put", name: "SPY 110 Put", optionType: "put",  strike: 110, startPrice: 11.5, dailyVol: 0.0850, underlyingId: "spy", leverage: 3.4, theta: 0.0040, direction: -1 },
  { id: "spy-90-call",  name: "SPY 90 Call",  optionType: "call", strike: 90,  startPrice: 14.0, dailyVol: 0.0800, underlyingId: "spy", leverage: 3.2, theta: 0.0035, direction: 1 },
  { id: "spy-100-call", name: "SPY 100 Call", optionType: "call", strike: 100, startPrice: 10.0, dailyVol: 0.0820, underlyingId: "spy", leverage: 3.3, theta: 0.0038, direction: 1 },
  { id: "spy-110-call", name: "SPY 110 Call", optionType: "call", strike: 110, startPrice: 7.5, dailyVol: 0.0850, underlyingId: "spy", leverage: 3.4, theta: 0.0040, direction: 1 },
];

/** Interpolate annual yield for a term (years) from a pillar curve. */
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

/** Current market yield for `term` using the state's evolving curve (falls back to baseline). */
export function yieldForTerm(state, term) {
  const curve = state && state.yieldCurve && state.yieldCurve.length ? state.yieldCurve : YIELD_CURVE;
  return interpolateYield(curve, term);
}

function cloneYieldCurve(curve) {
  return curve.map(p => ({ term: p.term, yield: p.yield }));
}

/** One-day random walk + mean reversion toward YIELD_CURVE pillars. */
function evolveYieldCurve(state, params = {}) {
  const vol = params.yieldCurveVol ?? 0.00014;
  const kappa = params.yieldCurveKappa ?? 0.018;
  const yMin = params.yieldCurveMin ?? 0.002;
  const yMax = params.yieldCurveMax ?? 0.20;
  const curve = state.yieldCurve && state.yieldCurve.length ? state.yieldCurve : YIELD_CURVE;
  return YIELD_CURVE.map((base, i) => {
    const current = curve[i]?.yield ?? base.yield;
    const shock = randn() * vol;
    let y = current + shock + kappa * (base.yield - current);
    y = Math.max(yMin, Math.min(yMax, y));
    return { term: base.term, yield: y };
  });
}

// Jobs — daily pay when you click Work (before advancing the day)
// minNetWorth: minimum net worth to apply (or start with, via debug)
const JOBS = [
  { id: "intern", title: "Intern", dailyPay: 10, minNetWorth: 0 },
  { id: "clerk", title: "Clerk", dailyPay: 40, minNetWorth: 100_000 },
  { id: "analyst", title: "Analyst", dailyPay: 95, minNetWorth: 100_000 },
  { id: "director", title: "Director", dailyPay: 220, minNetWorth: 1_000_000 },
];
export { JOBS };

export function jobById(id) {
  return JOBS.find(j => j.id === id) ?? JOBS[0];
}

/** Highest-tier job the player qualifies for at this net worth (JOBS ordered low → high). */
export function highestJobForNetWorth(nw) {
  let pick = JOBS[0];
  for (const j of JOBS) {
    if (nw >= j.minNetWorth) pick = j;
  }
  return pick;
}

export function jobUnlockedAtNetWorth(job, nw) {
  return nw >= job.minNetWorth;
}

export function newState(params = {}) {
  const cash = params.startCash ?? 10_000;
  const startNw = cash;
  const wanted = jobById(params.startJobId ?? "intern");
  const job = jobUnlockedAtNetWorth(wanted, startNw)
    ? { ...wanted }
    : { ...highestJobForNetWorth(startNw) };
  return {
    day: 1,
    maxDays: 365 * 30,
    startCash: cash,
    totalIncome: 0,
    cash,
    job,
    indexFunds: INDEX_FUNDS.map(f => ({ ...f, shares: 0, price: f.startPrice, history: [f.startPrice], monthlyHistory: [f.startPrice] })),
    bondHoldings: [],   // list of individual bond purchases
    yieldCurve: cloneYieldCurve(YIELD_CURVE),
    cryptos: CRYPTOS.map(c => ({ ...c, coins: 0, price: c.startPrice, history: [c.startPrice] })),
    stocks: STOCKS.map(stk => ({ ...stk, shares: 0, price: stk.startPrice, history: [stk.startPrice] })),
    options: OPTIONS.map(opt => ({ ...opt, contracts: 0, price: opt.startPrice, history: [opt.startPrice] })),
    netWorthHistory: [cash],
    log: [],
  };
}

export function portfolioValue(state) {
  const bondsValue = (state.bondHoldings || []).reduce((sum, b) => sum + b.faceValue, 0);
  const indexValue = (state.indexFunds || []).reduce((sum, f) => sum + (f.shares * f.price), 0);
  const cryptoValue = (state.cryptos || []).reduce((sum, c) => sum + (c.coins * c.price), 0);
  const stockValue = (state.stocks || []).reduce((sum, st) => sum + (st.shares * st.price), 0);
  const optionsValue = (state.options || []).reduce((sum, op) => sum + (op.contracts * op.price), 0);
  return indexValue + bondsValue + cryptoValue + stockValue + optionsValue;
}

export function netWorth(state) {
  return state.cash + portfolioValue(state);
}

// ── helpers ──
function appendLog(state, msg, type) {
  return { ...state, log: [...state.log, { msg, type, day: state.day }] };
}

function tradeAsset(state, listKey, assetId, qty, mode, unitLabel) {
  const list = state[listKey] || [];
  const idx = list.findIndex(a => a.id === assetId);
  if (idx < 0) return appendLog(state, `Asset not found.`, "bad");
  const asset = list[idx];
  const price = asset.price;
  const holdingKey = unitLabel === "coin" ? "coins" : (unitLabel === "contract" ? "contracts" : "shares");
  const owned = asset[holdingKey];

  if (mode === "buy") {
    const cost = qty * price;
    if (cost > state.cash) return appendLog(state, `Need ${fmt(cost)} — only have ${fmt(state.cash)}.`, "bad");
    const updated = { ...asset, [holdingKey]: owned + qty };
    const nextList = [...list];
    nextList[idx] = updated;
    const next = { ...state, cash: state.cash - cost, [listKey]: nextList };
    return appendLog(next, `Bought ${qty} ${asset.name} ${unitLabel}(s) @ $${price.toFixed(2)}.`, "good");
  }

  if (qty > owned) return appendLog(state, `Only have ${owned} ${unitLabel}(s).`, "bad");
  const proceeds = qty * price;
  const updated = { ...asset, [holdingKey]: owned - qty };
  const nextList = [...list];
  nextList[idx] = updated;
  const next = { ...state, cash: state.cash + proceeds, [listKey]: nextList };
  return appendLog(next, `Sold ${qty} ${asset.name} ${unitLabel}(s) @ $${price.toFixed(2)}.`, "info");
}

// ── index funds ──
export function buyIndexFund(state, assetId, qty) {
  return tradeAsset(state, "indexFunds", assetId, qty, "buy", "share");
}

export function sellIndexFund(state, assetId, qty) {
  return tradeAsset(state, "indexFunds", assetId, qty, "sell", "share");
}

// Backwards-compatible wrappers (default to first index fund)
export function buy(state, qty) {
  const first = (state.indexFunds || [])[0];
  return first ? buyIndexFund(state, first.id, qty) : appendLog(state, "No index funds configured.", "bad");
}

export function sell(state, qty) {
  const first = (state.indexFunds || [])[0];
  return first ? sellIndexFund(state, first.id, qty) : appendLog(state, "No index funds configured.", "bad");
}

// ── bonds ──
// Each bond holding: { id, faceValue, term, yield, purchaseDay, maturityDay, couponAccrued }
export function buyBond(state, faceValue, term) {
  if (faceValue > state.cash) return appendLog(state, `Need ${fmt(faceValue)} — only have ${fmt(state.cash)}.`, "bad");
  const y = yieldForTerm(state, term);
  const bond = {
    id: state.day + "_" + Math.random().toString(36).slice(2, 6),
    faceValue,
    term,
    yield: y,
    purchaseDay: state.day,
    maturityDay: state.day + term * 365,
    couponAccrued: 0,
  };
  const next = {
    ...state,
    cash: state.cash - faceValue,
    bondHoldings: [...(state.bondHoldings || []), bond],
  };
  return appendLog(next, `Bought ${term}yr bond — face ${fmt(faceValue)}, yield ${(y * 100).toFixed(2)}%.`, "good");
}

export function sellBondEarly(state, bondId) {
  const bond = (state.bondHoldings || []).find(b => b.id === bondId);
  if (!bond) return appendLog(state, `Bond not found.`, "bad");
  const penalty = 0.15;
  const proceeds = Math.round(bond.faceValue * (1 - penalty));
  const next = {
    ...state,
    cash: state.cash + proceeds,
    bondHoldings: state.bondHoldings.filter(b => b.id !== bondId),
  };
  return appendLog(next, `Sold bond early — received ${fmt(proceeds)} (15% penalty applied).`, "info");
}

// ── crypto ──
export function buyCrypto(state, assetId, qty) {
  return tradeAsset(state, "cryptos", assetId, qty, "buy", "coin");
}

export function sellCrypto(state, assetId, qty) {
  return tradeAsset(state, "cryptos", assetId, qty, "sell", "coin");
}

// ── stocks ──
export function buyStock(state, assetId, qty) {
  return tradeAsset(state, "stocks", assetId, qty, "buy", "share");
}

export function sellStock(state, assetId, qty) {
  return tradeAsset(state, "stocks", assetId, qty, "sell", "share");
}

// ── options ──
export function buyOption(state, assetId, qty) {
  return tradeAsset(state, "options", assetId, qty, "buy", "contract");
}

export function sellOption(state, assetId, qty) {
  return tradeAsset(state, "options", assetId, qty, "sell", "contract");
}

// ── work ──
export function work(state, params = {}) {
  const payout = state.job.dailyPay;
  const withWage = { ...state, cash: state.cash + payout, totalIncome: (state.totalIncome || 0) + payout };
  const logged = appendLog(withWage, `Worked (${state.job.title}) — earned $${payout}.`, "info");
  return nextDay(logged, params);
}

export function applyForJob(state, jobId) {
  const job = jobById(jobId);
  if (state.job.id === job.id) {
    return appendLog(state, `Already employed as ${job.title}.`, "info");
  }
  const nw = netWorth(state);
  if (!jobUnlockedAtNetWorth(job, nw)) {
    return appendLog(state, `${job.title} requires net worth ${fmt(job.minNetWorth)}+ (you have ${fmt(nw)}).`, "bad");
  }
  const next = { ...state, job: { ...job } };
  return appendLog(next, `New job: ${job.title} — $${job.dailyPay}/day when you Work.`, "good");
}

// ── advance one day ──
export function nextDay(state, params = {}) {
  if (state.day >= state.maxDays) return state;

  let s = state;
  let cash = s.cash;
  let incomeToday = 0;
  let newLog = [...s.log];

  const dailyVol  = params.volIndex  ?? 0.0126;
  const cryptoVol = params.volCrypto ?? 0.04;
  const stockVol  = params.volStock  ?? 0.02;
  const optionsVol = params.volOptions ?? 0.075;

  // Process bond holdings: accrue daily coupon, mature if due
  let updatedBonds = [];
  for (const bond of (s.bondHoldings || [])) {
    const dailyCoupon = bond.faceValue * (bond.yield / 365);
    cash += dailyCoupon;
    incomeToday += dailyCoupon;
    if (s.day >= bond.maturityDay) {
      // Bond matures: return face value (already accruing coupon daily, so just remove)
      cash += bond.faceValue;
      newLog.push({ msg: `Bond matured — received face value ${fmt(bond.faceValue)}.`, type: "good", day: s.day });
    } else {
      updatedBonds.push({ ...bond, couponAccrued: bond.couponAccrued + dailyCoupon });
    }
  }

  // Life events are temporarily disabled.

  const newDay = s.day + 1;
  const isMonthEnd = newDay % 30 === 0;
  const yieldCurve = evolveYieldCurve(s, params);
  const evolveAssets = (assets, overrideVol, includeMonthlyHistory = false) => (
    (assets || []).map(asset => {
      const vol = overrideVol ?? asset.dailyVol;
      const shock = randn() * vol;
      const price = Math.max(0.01, asset.price * (1 + shock));
      const next = {
        ...asset,
        price,
        history: [...asset.history, price].slice(-500),
      };
      if (includeMonthlyHistory) {
        next.monthlyHistory = isMonthEnd
          ? [...(asset.monthlyHistory || []), price]
          : (asset.monthlyHistory || []);
      }
      return next;
    })
  );

  const updatedIndexFunds = evolveAssets(s.indexFunds, dailyVol, true);
  const updatedCryptos = evolveAssets(s.cryptos, cryptoVol, false);
  const updatedStocks = evolveAssets(s.stocks, stockVol, false);
  const updatedOptions = (s.options || []).map(option => {
    const underlyingPrev = ((s.indexFunds || []).find(f => f.id === option.underlyingId)?.price) ?? 100;
    const underlyingNext = ((updatedIndexFunds || []).find(f => f.id === option.underlyingId)?.price) ?? underlyingPrev;
    const underlyingRet = underlyingPrev > 0 ? ((underlyingNext - underlyingPrev) / underlyingPrev) : 0;
    const shock = randn() * (optionsVol ?? option.dailyVol);
    const direction = option.direction ?? (option.optionType === "put" ? -1 : 1);
    const drift = (underlyingRet * option.leverage * direction) + shock - (option.theta || 0.003);
    const price = Math.max(0.01, option.price * (1 + drift));
    return {
      ...option,
      price,
      history: [...option.history, price].slice(-500),
    };
  });

  const updated = {
    ...s,
    day: newDay,
    cash,
    totalIncome: (s.totalIncome || 0) + incomeToday,
    yieldCurve,
    indexFunds: updatedIndexFunds,
    cryptos: updatedCryptos,
    stocks: updatedStocks,
    options: updatedOptions,
    bondHoldings: updatedBonds,
    log: newLog,
  };

  const nw = netWorth(updated);
  const withNW = { ...updated, netWorthHistory: [...s.netWorthHistory, Math.round(nw)].slice(-500) };

  if (newDay >= s.maxDays) {
    return { ...withNW, log: [...withNW.log, { msg: `── RUN OVER ── Net worth: $${fmt(nw)}`, type: "event", day: newDay }] };
  }

  return withNW;
}

// Box-Muller normal distribution
function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function fmt(n) {
  return '$' + Math.round(n).toLocaleString();
}