// ============================================================
// INDEX FUNDS — buy/sell + daily price evolution.
// Index funds also track a monthly close history for the
// "monthly" chart toggle on the index fund page.
// ============================================================

import { appendLog } from "../log.js";
import { tradeAsset, evolveAssetPrices } from "./common.js";

export function buyIndexFund(state, assetId, qty) {
  return tradeAsset(state, "indexFunds", assetId, qty, "buy", "share");
}

export function sellIndexFund(state, assetId, qty) {
  return tradeAsset(state, "indexFunds", assetId, qty, "sell", "share");
}

// Backwards-compatible single-fund shims (default to the first fund).
export function buy(state, qty) {
  const first = (state.indexFunds || [])[0];
  return first ? buyIndexFund(state, first.id, qty) : appendLog(state, "No index funds configured.", "bad");
}

export function sell(state, qty) {
  const first = (state.indexFunds || [])[0];
  return first ? sellIndexFund(state, first.id, qty) : appendLog(state, "No index funds configured.", "bad");
}

// Step every index fund forward one day.
export function evolveIndexFunds(state, params, isMonthEnd) {
  return evolveAssetPrices(state.indexFunds, {
    overrideVol: params.volIndex ?? 0.0126,
    drift: params.driftIndex ?? 0.00025,
    trackMonthlyHistory: true,
    isMonthEnd,
  });
}
