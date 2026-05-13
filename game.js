// ============================================================
// GAME — Public API façade.
//
// The actual logic lives in ./src/ and is split into focused
// modules. This file just re-exports the symbols index.html
// needs, plus a few legacy ones (buy / sell / YIELD_CURVE /
// yieldForTerm) that other tooling or older builds may import.
//
// If you're trying to understand how the game works, start by
// reading these in order:
//
//   src/config.js              — what assets exist
//   src/state.js               — what a "game state" looks like
//   src/yieldCurve.js          — how the treasury curve evolves
//   src/trading/common.js      — generic buy/sell engine
//   src/trading/{indexFunds,bonds,crypto,stocks,options}.js
//                              — per-asset trading + daily evolution
//   src/simulation.js          — how a single day is advanced
// ============================================================

// State & valuation
export { newState, portfolioValue, netWorth } from "./src/state.js";

// Daily simulation
export { nextDay } from "./src/simulation.js";

// Yield curve (used by the bonds page UI)
export { YIELD_CURVE } from "./src/config.js";
export { yieldForTerm, interpolateYield } from "./src/yieldCurve.js";

// Trading actions
export { buyIndexFund, sellIndexFund, buy, sell } from "./src/trading/indexFunds.js";
export { buyBond, buyCorporateBond, sellBondEarly } from "./src/trading/bonds.js";
export { buyCrypto, sellCrypto } from "./src/trading/crypto.js";
export { buyStock, sellStock } from "./src/trading/stocks.js";
export { buyOption, sellOption } from "./src/trading/options.js";

// Catalog constants (handy for external tooling / tests)
export {
  CORPORATE_BOND_OFFERS,
  INDEX_FUNDS,
  CRYPTOS,
  STOCKS,
  OPTIONS,
} from "./src/config.js";
