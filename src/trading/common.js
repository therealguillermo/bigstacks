// ============================================================
// TRADING COMMON — generic helpers shared by every asset class.
// ============================================================

import { appendLog } from "../log.js";
import { fmt, randn } from "../utils.js";

// Map an asset's "unit label" (share / coin / contract) to the
// property name on the asset object that stores the held quantity.
const HOLDING_KEY_BY_UNIT = {
  share: "shares",
  coin: "coins",
  contract: "contracts",
};

// Generic buy/sell engine used by index funds, crypto, stocks and options.
// Bonds have their own flow because every purchase creates a separate lot.
//
//   state      — current game state
//   listKey    — name of the array on state (e.g. "stocks")
//   assetId    — id of the asset within that array
//   qty        — how many units to buy or sell
//   mode       — "buy" | "sell"
//   unitLabel  — "share" | "coin" | "contract" (drives wording + holding key)
export function tradeAsset(state, listKey, assetId, qty, mode, unitLabel) {
  const list = state[listKey] || [];
  const idx = list.findIndex(a => a.id === assetId);
  if (idx < 0) return appendLog(state, "Asset not found.", "bad");

  const asset = list[idx];
  const price = asset.price;
  const holdingKey = HOLDING_KEY_BY_UNIT[unitLabel] || "shares";
  const owned = asset[holdingKey];

  if (mode === "buy") {
    const cost = qty * price;
    if (cost > state.cash) {
      return appendLog(state, `Need ${fmt(cost)} — only have ${fmt(state.cash)}.`, "bad");
    }
    const updated = {
      ...asset,
      [holdingKey]: owned + qty,
      costBasis: (asset.costBasis || 0) + cost,
    };
    const next = replaceAt(state, listKey, idx, updated);
    next.cash = state.cash - cost;
    return appendLog(next, `Bought ${qty} ${asset.name} ${unitLabel}(s) @ $${price.toFixed(2)}.`, "good");
  }

  if (qty > owned) {
    return appendLog(state, `Only have ${owned} ${unitLabel}(s).`, "bad");
  }
  const proceeds = qty * price;
  const avgCost = owned > 0 ? (asset.costBasis || 0) / owned : 0;
  const nextOwned = owned - qty;
  const nextCostBasis = nextOwned <= 0
    ? 0
    : Math.max(0, (asset.costBasis || 0) - (avgCost * qty));
  const updated = {
    ...asset,
    [holdingKey]: nextOwned,
    costBasis: nextCostBasis,
  };
  const next = replaceAt(state, listKey, idx, updated);
  next.cash = state.cash + proceeds;
  return appendLog(next, `Sold ${qty} ${asset.name} ${unitLabel}(s) @ $${price.toFixed(2)}.`, "info");
}

// Apply a Gaussian random walk to a list of assets and append the
// new price to each asset's history. Used by index funds, stocks
// and crypto. Options have their own (more complex) model.
//
//   assets                — the array of assets to evolve
//   overrideVol           — daily vol to use (falls back to asset.dailyVol)
//   drift                 — deterministic per-day drift component
//   trackMonthlyHistory   — also extend the monthlyHistory array on month-end days
//   isMonthEnd            — whether today closes a 30-day "month" bucket
export function evolveAssetPrices(assets, { overrideVol, drift = 0, trackMonthlyHistory = false, isMonthEnd = false } = {}) {
  return (assets || []).map(asset => {
    const vol = overrideVol ?? asset.dailyVol;
    const shock = randn() * vol;
    const price = Math.max(0.01, asset.price * (1 + drift + shock));
    const next = {
      ...asset,
      price,
      history: [...asset.history, price].slice(-500),
    };
    if (trackMonthlyHistory) {
      next.monthlyHistory = isMonthEnd
        ? [...(asset.monthlyHistory || []), price]
        : (asset.monthlyHistory || []);
    }
    return next;
  });
}

// Return a copy of `state` with element `idx` of `state[listKey]` replaced.
function replaceAt(state, listKey, idx, item) {
  const nextList = [...state[listKey]];
  nextList[idx] = item;
  return { ...state, [listKey]: nextList };
}
