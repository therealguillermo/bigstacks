# Invest Rogue

A single-page, dependency-free investment simulator. You start with $10,000 and a fixed number of trading days; your job is to grow your net worth by allocating between index funds, U.S. Treasury bonds, corporate bonds, crypto, individual stocks, and options.

The whole thing is plain HTML + vanilla ES modules — open `index.html` in any modern browser (served over HTTP, since modules require it) and play.

```bash
# from the project root
python3 -m http.server 8000
# then visit http://localhost:8000/index.html
```

---

## Table of contents

1. [Project structure](#project-structure)
2. [How the pieces fit together](#how-the-pieces-fit-together)
3. [The game state](#the-game-state)
4. [The daily simulation loop](#the-daily-simulation-loop)
5. [Supported functionality](#supported-functionality)
6. [The UI](#the-ui)
7. [Extending the game](#extending-the-game)

---

## Project structure

```
bigstacks/
├── index.html              Single-page UI: HTML, CSS, and the render layer
├── game.js                 Public-API façade (re-exports everything the UI needs)
├── README.md               You are here
└── src/                    All game logic lives here, split by concern
    ├── config.js           Static catalog of every tradable asset
    ├── utils.js            Pure helpers: randn(), fmt(), roundToNearestFive()
    ├── log.js              appendLog() — zero-dependency log helper
    ├── state.js            newState(), portfolioValue(), netWorth()
    ├── yieldCurve.js       Yield interpolation + daily mean-reverting walk
    ├── simulation.js       nextDay() — the daily orchestrator
    └── trading/
        ├── common.js       Generic tradeAsset() engine + evolveAssetPrices() walk
        ├── indexFunds.js   buy/sell + daily evolution (with monthly history)
        ├── bonds.js        buyBond, buyCorporateBond, sellBondEarly, processBondsForDay
        ├── crypto.js       buy/sell + daily evolution
        ├── stocks.js       buy/sell + daily evolution
        └── options.js      Strike math, buy/sell, daily pricing model
```

### What lives where

| Module                       | Responsibility                                                                                                 |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `index.html`                 | Markup, styling, render functions, button wiring, charts. **The only file that touches the DOM.**              |
| `game.js`                    | Re-exports the symbols `index.html` imports. Keeping this file slim means the UI never has to know paths.      |
| `src/config.js`              | The asset catalog. Want a new stock? Add a line here — no other file changes.                                  |
| `src/utils.js`               | `randn()` (Box-Muller normal), `fmt()` (dollar formatter), `roundToNearestFive()` (option-strike rounding).    |
| `src/log.js`                 | `appendLog(state, msg, type)` — produces a new state with one extra entry in `state.log`.                      |
| `src/state.js`               | Builds a fresh game state from params. Computes `portfolioValue` and `netWorth`.                               |
| `src/yieldCurve.js`          | Interpolates yields between term pillars and evolves the curve each day.                                       |
| `src/trading/common.js`      | The generic buy/sell engine (`tradeAsset`) and the generic Gaussian price walk (`evolveAssetPrices`).          |
| `src/trading/indexFunds.js`  | Index-fund trading + per-day evolution. Also tracks a monthly close history for the chart toggle.              |
| `src/trading/bonds.js`       | Treasury & corporate purchases, early sale (with penalty), daily coupon accrual, maturity payouts.             |
| `src/trading/crypto.js`      | Crypto trading + per-day evolution.                                                                            |
| `src/trading/stocks.js`      | Stock trading + per-day evolution.                                                                             |
| `src/trading/options.js`     | Strike math, option buy/sell, and a daily pricing model that blends intrinsic + time value + leveraged drift.  |
| `src/simulation.js`          | `nextDay(state, params)` — calls each evolver in the right order and stitches the results into a new state.    |

---

## How the pieces fit together

The codebase is **pure state in, pure state out**: every function takes the current `state` object and returns a *new* state object. Nothing mutates anything. The UI keeps a single mutable variable (`let state`) at the top of the `<script>` in `index.html` and reassigns it after every action.

### High-level data flow

```
                      ┌─────────────────────────┐
                      │      index.html         │
                      │  (UI + render layer)    │
                      └────────────┬────────────┘
                                   │  imports
                                   ▼
                           ┌──────────────┐
                           │   game.js    │  (façade — re-exports only)
                           └──────┬───────┘
                                  │
              ┌───────────────────┼─────────────────────┐
              ▼                   ▼                     ▼
       ┌────────────┐      ┌─────────────┐      ┌──────────────┐
       │  state.js  │      │ simulation  │      │  trading/*   │
       │ newState() │      │ nextDay()   │      │ buy/sell +   │
       │ netWorth() │      │             │      │ evolveX()    │
       └─────┬──────┘      └──────┬──────┘      └──────┬───────┘
             │                    │                    │
             └────────┬───────────┴────────┬───────────┘
                      ▼                    ▼
              ┌──────────────┐     ┌──────────────┐
              │ yieldCurve.js│     │  config.js   │
              └──────┬───────┘     └──────────────┘
                     ▼
            ┌─────────────────┐
            │ utils.js / log.js│  (leaf modules — no dependencies)
            └─────────────────┘
```

### A typical user interaction

1. **User clicks a button** (e.g. "Buy 5 shares of Stock A") in `index.html`.
2. The click handler calls a trading function from `game.js`, e.g. `state = buyStock(state, "aapl", 5);`
3. That function lives in `src/trading/stocks.js`, which delegates to the generic `tradeAsset()` in `src/trading/common.js`.
4. `tradeAsset()` validates the trade, updates the asset's `shares`, `costBasis`, and the player's `cash`, and appends a log entry via `appendLog` from `src/log.js`.
5. A new state object is returned. The UI calls `render(state)`, which redraws the sidebar, the active tab, the holdings list, and any sparkline charts.

### A typical "advance time" interaction

1. User clicks **Next day** (or **+1 Week**, or **Advance N days**).
2. The handler calls `state = nextDay(state, params);` from `src/simulation.js`.
3. `nextDay()` runs the full daily loop (described below) and returns the new state.
4. UI re-renders.

---

## The game state

`newState(params)` (in `src/state.js`) returns an object with this shape:

```js
{
  day: 1,                      // current trading day (1-indexed)
  maxDays: 2000,               // total days in the run
  startCash: 10000,            // initial cash (for computing total return)
  cash: 10000,                 // current cash balance

  indexFunds: [                // one entry per index fund (see config.js)
    {
      id, name, startPrice, dailyVol,
      shares: 0,
      costBasis: 0,            // total $ spent (for avg-cost and P/L math)
      price: 100.0,            // current market price
      history: [...],          // daily closes (capped at 500)
      monthlyHistory: [...],   // monthly closes (used by chart toggle)
    },
    ...
  ],

  bondHoldings: [              // each purchase creates its own lot
    {
      id, type: "treasury" | "corporate",
      issuer, rating?,
      faceValue, term,
      yield,                   // fixed at purchase time
      purchaseDay, maturityDay,
      couponAccrued,           // running total of coupon payments
    },
    ...
  ],

  corporateBondOffers: [...],  // listings on the bonds page (yields scaled by debug param)

  yieldCurve: [                // mutable copy of the treasury baseline
    { term: 1, yield: 0.030 },
    { term: 2, yield: 0.035 },
    ...
  ],

  cryptos:  [{ id, name, coins,     costBasis, price, history, ... }, ...],
  stocks:   [{ id, name, shares,    costBasis, price, history, ... }, ...],
  options:  [{ id, name, contracts, costBasis, price, history,
               optionType, strikeRef, strike, underlyingId,
               leverage, theta, direction, ... }, ...],

  netWorthHistory: [10000],    // one snapshot per day (capped at 500)
  log: [                       // tagged messages for the on-screen log
    { msg: "Bought 5 Stock A share(s) @ $45.00.", type: "good", day: 12 },
    ...
  ],
}
```

`portfolioValue(state)` sums the market value of every non-cash position. `netWorth(state)` is just `cash + portfolioValue(state)`. The UI uses these for the sidebar.

---

## The daily simulation loop

`nextDay(state, params)` (in `src/simulation.js`) is intentionally short — it's an orchestrator. Each step delegates to the asset module that owns it.

```
nextDay(state, params)
│
├─ 1. processBondsForDay(state)          ───→  src/trading/bonds.js
│       For every bond holding:
│         • credit one day's coupon to cash (face × yield / 365)
│         • if it matured, also credit face value and remove the lot
│
├─ 2. day += 1  /  isMonthEnd = (newDay % 30 === 0)
│
├─ 3. evolveYieldCurve(state, params)    ───→  src/yieldCurve.js
│       Each pillar gets a Gaussian shock plus mean reversion toward
│       the baseline curve, then is clamped to [yMin, yMax].
│
├─ 4. evolveIndexFunds(state, params, isMonthEnd)  ───→  trading/indexFunds.js
│       Random walk with daily drift. Appends to both `history` and,
│       on month-end days, `monthlyHistory`.
│
├─ 5. evolveCryptos(state, params)       ───→  trading/crypto.js
│       Random walk (higher vol by default).
│
├─ 6. evolveStocks(state, params)        ───→  trading/stocks.js
│       Random walk (mid vol by default).
│
├─ 7. evolveOptions(state, params, updatedIndex)  ───→  trading/options.js
│       Runs AFTER index funds so it can read the new underlying price.
│       For each contract:
│         • Re-derive strike from the new underlying ("lower"/"upper")
│         • Intrinsic value from underlying vs. strike
│         • Time value, decaying with moneyness
│         • Momentum step: price × (1 + leveraged underlying return
│           + shock − theta)
│         • Final price = blend(momentum, intrinsic + timeValue)
│
├─ 8. Build new state with all the above results stitched in.
├─ 9. Append round(netWorth) to netWorthHistory.
└─ 10. If newDay === maxDays, append a "RUN OVER" log entry.
```

The whole loop is deterministic given the same `Math.random()` sequence, which makes the game easy to reason about even though it looks chaotic on screen.

---

## Supported functionality

### Index funds

- **Buy / sell** any whole number of shares.
- Single fund by default (`spy` / "Index Fund A — Broad Market"), but you can add more in `src/config.js`.
- Daily price walk with configurable volatility and **positive drift** (so holding long-term is positive-EV, like a real index).
- Tracks both a daily history (for the daily chart) and a monthly history (for the monthly chart toggle on the Index Fund tab).

### U.S. Treasury bonds

- **Buy** a bond with a custom face value (default $1,000) and term (1, 2, 5, 10, or 30 years).
- Yield is interpolated from the **current** treasury yield curve at purchase time and is then **locked in** for the life of the bond.
- Pays **daily coupon** equal to `faceValue × yield / 365` directly to cash.
- At maturity, the face value is returned to cash and the lot is removed.
- **Sell early** at any time for `round(faceValue × 0.85)` (a 15% penalty).
- The yield curve itself shifts daily (Gaussian shocks + mean reversion to baseline).

### Corporate bonds

- A fixed list of standing offers on the bonds page (see `CORPORATE_BOND_OFFERS` in `src/config.js`).
- Higher yields than treasuries, in exchange for credit risk *(risk is cosmetic in v1 — no defaults are modelled yet)*.
- Each offer has an issuer, credit rating, term, face value, and yield.
- The yields displayed in the listings are scaled by the debug parameter **Corporate Spread Multiplier** (set when a run is created).
- Same daily-coupon and maturity mechanics as treasuries; same 15% early-sale penalty.

### Crypto

- Three coins by default: BTC, ETH, SOL. Each has its own start price and vol; see `src/config.js`.
- **Buy / sell** any whole number of coins.
- High-vol random walk, no drift. Live mini-chart per coin.

### Stocks

- Four individual stocks (A–D) with varying volatility.
- **Buy / sell** any whole number of shares.
- Mid-vol random walk, no drift. Live mini-chart per stock.

### Options

- A live **options chain** on a single underlying (Index Fund A), with two strikes (lower & upper, ~8% out from spot, rounded to the nearest $5).
- Four contract templates per chain row: Put OTM, Put ITM, Call ITM, Call OTM.
- Strikes are **re-derived every day** from the new underlying price, so the chain stays centered on spot as the market moves.
- Daily pricing model (in `src/trading/options.js`) combines:
  - **Intrinsic value** (`max(strike − spot, 0)` for puts, `max(spot − strike, 0)` for calls).
  - **Time value** that decays as moneyness grows.
  - **Momentum step** scaled by `leverage` (×3.2–3.3 by default) and direction (+1 for calls, −1 for puts), minus a small daily `theta` decay.
  - The final price is a 55/45 blend of the momentum step and the intrinsic + time-value target.
- **Buy / sell** contracts. A trade-ticket panel shows premium, break-even, estimated cost, held contracts, average cost, and unrealized P/L for the selected contract.

### Net worth & P/L

- The sidebar shows cash, portfolio value (split by asset class with per-class P/L), net worth, and total return since day 1.
- P/L is computed against `costBasis` for non-bond assets (so it reflects realized + unrealized gains/losses), and against `couponAccrued` for bonds.
- `netWorthHistory` is updated once per day and shown as a yellow line chart on the Overview tab.

### Time controls

- **⏭ Next day** — advance one day.
- **+1 Week** — advance 7 days.
- **Advance** with a custom day count input — advance any number of days in one click.
- **↺ New Run** — discard the current state and roll up a fresh one using the current debug params.

### News ticker

A scrolling ticker at the bottom of the page rotates through six headlines (lead index move, 5-year treasury yield, lead stock price, lead crypto price, options-desk activity, net worth snapshot). It re-renders each time the ticker animation completes a pass.

---

## The UI

`index.html` is divided into three regions:

- **Sidebar** — always-visible run summary and the day-advancement / reset controls.
- **Top nav** — seven tabs: Overview, Index Fund, Bonds, Crypto, Stocks, Options, Debug.
- **News ticker** — a thin strip at the bottom of the viewport.

### Tabs

| Tab          | What's on it                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------ |
| Overview     | Net worth chart, a single "All Holdings" table that lists every position across asset classes, message log.  |
| Index Fund   | Per-fund stats, market table with buy/sell, price chart with Daily / Monthly toggle, current holdings.       |
| Bonds        | Aggregate value & P/L, live yield-curve chart, treasury bond purchase form (with live yield preview), corporate offers, current holdings with per-lot Sell buttons. |
| Crypto       | Per-coin cards with mini sparklines, buy/sell controls, and holdings.                                        |
| Stocks       | Same card layout as crypto, for individual stocks.                                                           |
| Options      | Full options chain (puts vs. strike vs. calls), per-row mini sparklines, a trade ticket for the selected contract, and an open-positions table. |
| Debug        | Parameter editor (starting cash, run length, per-asset vols, drift, full yield-curve dynamics, corporate spread multiplier). Hit **Apply & New Run** to commit changes. |

### Tunable parameters (Debug tab)

Every parameter has a sensible default; values are stored in the UI and passed through to `newState()` and `nextDay()` as `params`.

| Parameter                            | Used by                            | Default |
| ------------------------------------ | ---------------------------------- | ------- |
| Starting Cash ($)                    | `newState`                         | 10,000  |
| Run Length (days)                    | `newState`                         | 2,000   |
| Index Fund Volatility (%)            | `evolveIndexFunds`                 | 1.26    |
| Crypto Volatility (%)                | `evolveCryptos`                    | 4.0     |
| Stocks Volatility (%)                | `evolveStocks`                     | 2.0     |
| Options Volatility (%)               | `evolveOptions`                    | 7.5     |
| Index Drift (% / day)                | `evolveIndexFunds`                 | 0.025   |
| Treasury Curve Vol (bps/day)         | `evolveYieldCurve`                 | 7       |
| Treasury Mean Reversion (% / day)    | `evolveYieldCurve`                 | 1.8     |
| Min / Max Treasury Yield (%)         | `evolveYieldCurve`                 | 0.2 / 20 |
| Corporate Spread Multiplier          | `newState` (scales offer yields)   | 1.0     |

---

## Extending the game

The structure is designed so that most additions touch exactly one file.

- **Add a new stock / crypto / index fund / option / corporate bond offer** → add an entry to the appropriate array in `src/config.js`. Everything else (the market table, the holdings table, daily evolution) picks it up automatically.
- **Tune default behaviour** (vols, drifts, yield-curve dynamics) → change the defaults in `src/yieldCurve.js`, `src/trading/*.js`, or `src/simulation.js`, or just tweak the Debug-tab inputs and hit **Apply & New Run**.
- **Add a brand-new asset class** → create `src/trading/<name>.js` with `buyX` / `sellX` / `evolveX`, register the asset list in `newState()` (in `src/state.js`), call `evolveX` from `nextDay()` (in `src/simulation.js`), re-export the public API in `game.js`, and add a tab + render function in `index.html`.
- **Add a new game mechanic** (random events, taxes, fees, etc.) → write a small pure helper that takes a state and returns a new state, then call it from `nextDay()` at the appropriate point in the daily order of operations.

Because every module returns a new state object instead of mutating, you can also save/load by `JSON.stringify`-ing `state` and `JSON.parse`-ing it back — no serialization helpers required.
