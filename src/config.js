// ============================================================
// CONFIG — Static catalog of every tradable asset in the game.
// Edit these tables to add/remove instruments or retune defaults.
// ============================================================

// Treasury yield curve baseline: term (years) → annual yield.
// The state's evolving curve mean-reverts toward these pillars.
export const YIELD_CURVE = [
  { term: 1,  yield: 0.030 },
  { term: 2,  yield: 0.035 },
  { term: 5,  yield: 0.042 },
  { term: 10, yield: 0.048 },
  { term: 30, yield: 0.052 },
];

// Standing corporate bond offers available on the bonds page.
export const CORPORATE_BOND_OFFERS = [
  { id: "acme-5y",      issuer: "Acme Manufacturing", term: 5,  faceValue: 1000, yield: 0.058, rating: "BBB" },
  { id: "northstar-7y", issuer: "Northstar Energy",   term: 7,  faceValue: 1000, yield: 0.066, rating: "BB+" },
  { id: "bluefin-10y",  issuer: "Bluefin Logistics",  term: 10, faceValue: 1000, yield: 0.072, rating: "BB"  },
];

export const INDEX_FUNDS = [
  { id: "spy", name: "Index Fund A (Broad Market)", startPrice: 100.0, dailyVol: 0.0126 },
];

export const CRYPTOS = [
  { id: "btc", name: "Bitcoin (BTC)",  startPrice: 50.0, dailyVol: 0.0400 },
  { id: "eth", name: "Ethereum (ETH)", startPrice: 38.0, dailyVol: 0.0480 },
  { id: "sol", name: "Solana (SOL)",   startPrice: 24.0, dailyVol: 0.0600 },
];

export const STOCKS = [
  { id: "aapl", name: "Stock A", startPrice: 45.0, dailyVol: 0.0180 },
  { id: "msft", name: "Stock B", startPrice: 48.0, dailyVol: 0.0170 },
  { id: "nvda", name: "Stock C", startPrice: 42.0, dailyVol: 0.0300 },
  { id: "tsla", name: "Stock D", startPrice: 32.0, dailyVol: 0.0360 },
];

// Option contract templates. `strikeRef` ("lower"/"upper") is resolved
// daily against the current underlying price — see src/trading/options.js.
export const OPTIONS = [
  { id: "spy-lower-put",  name: "Put OTM",  optionType: "put",  strikeRef: "lower", startPrice: 6.0, dailyVol: 0.0800, underlyingId: "spy", leverage: 3.2, theta: 0.0035, direction: -1 },
  { id: "spy-upper-put",  name: "Put ITM",  optionType: "put",  strikeRef: "upper", startPrice: 9.0, dailyVol: 0.0820, underlyingId: "spy", leverage: 3.3, theta: 0.0038, direction: -1 },
  { id: "spy-lower-call", name: "Call ITM", optionType: "call", strikeRef: "lower", startPrice: 9.0, dailyVol: 0.0820, underlyingId: "spy", leverage: 3.3, theta: 0.0038, direction:  1 },
  { id: "spy-upper-call", name: "Call OTM", optionType: "call", strikeRef: "upper", startPrice: 6.0, dailyVol: 0.0800, underlyingId: "spy", leverage: 3.2, theta: 0.0035, direction:  1 },
];
