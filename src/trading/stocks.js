// ============================================================
// STOCKS — buy/sell + daily price evolution.
// ============================================================

import { tradeAsset, evolveAssetPrices } from "./common.js";

export function buyStock(state, assetId, qty) {
  return tradeAsset(state, "stocks", assetId, qty, "buy", "share");
}

export function sellStock(state, assetId, qty) {
  return tradeAsset(state, "stocks", assetId, qty, "sell", "share");
}

// Step every stock forward one day.
export function evolveStocks(state, params) {
  return evolveAssetPrices(state.stocks, {
    overrideVol: params.volStock ?? 0.02,
  });
}
