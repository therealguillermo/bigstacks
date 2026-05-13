// ============================================================
// CRYPTO — buy/sell + daily price evolution.
// ============================================================

import { tradeAsset, evolveAssetPrices } from "./common.js";

export function buyCrypto(state, assetId, qty) {
  return tradeAsset(state, "cryptos", assetId, qty, "buy", "coin");
}

export function sellCrypto(state, assetId, qty) {
  return tradeAsset(state, "cryptos", assetId, qty, "sell", "coin");
}

// Step every crypto forward one day.
export function evolveCryptos(state, params) {
  return evolveAssetPrices(state.cryptos, {
    overrideVol: params.volCrypto ?? 0.04,
  });
}
