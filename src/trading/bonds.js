// ============================================================
// BONDS — treasury & corporate purchases, early sales,
// daily coupon accrual, and maturity payouts.
//
// Each bond purchase creates its own holding (a "lot") with a
// unique id, so a player can hold many bonds simultaneously.
// ============================================================

import { appendLog } from "../log.js";
import { fmt } from "../utils.js";
import { yieldForTerm } from "../yieldCurve.js";

// Penalty (as a fraction of face value) for selling a bond before maturity.
const EARLY_SALE_PENALTY = 0.15;

// Purchase a U.S. Treasury bond, priced off the live yield curve.
export function buyBond(state, faceValue, term) {
  if (faceValue > state.cash) {
    return appendLog(state, `Need ${fmt(faceValue)} — only have ${fmt(state.cash)}.`, "bad");
  }
  const y = yieldForTerm(state, term);
  const bond = {
    id: makeBondId(state),
    type: "treasury",
    issuer: "U.S. Treasury",
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
  return appendLog(
    next,
    `Bought ${term}yr bond — face ${fmt(faceValue)}, yield ${(y * 100).toFixed(2)}%.`,
    "good",
  );
}

// Purchase a corporate bond by offer id. Yield is fixed at the
// time the offer was generated (see corporateSpreadMult in newState).
export function buyCorporateBond(state, offerId) {
  const offer = (state.corporateBondOffers || []).find(b => b.id === offerId);
  if (!offer) return appendLog(state, "Corporate bond offer not found.", "bad");
  if (offer.faceValue > state.cash) {
    return appendLog(state, `Need ${fmt(offer.faceValue)} — only have ${fmt(state.cash)}.`, "bad");
  }
  const bond = {
    id: makeBondId(state),
    type: "corporate",
    issuer: offer.issuer,
    rating: offer.rating,
    faceValue: offer.faceValue,
    term: offer.term,
    yield: offer.yield,
    purchaseDay: state.day,
    maturityDay: state.day + offer.term * 365,
    couponAccrued: 0,
  };
  const next = {
    ...state,
    cash: state.cash - offer.faceValue,
    bondHoldings: [...(state.bondHoldings || []), bond],
  };
  return appendLog(
    next,
    `Bought ${offer.issuer} ${offer.term}yr bond (${offer.rating}) — face ${fmt(offer.faceValue)}, yield ${(offer.yield * 100).toFixed(2)}%.`,
    "good",
  );
}

// Liquidate a single bond before maturity. The player pays a penalty.
export function sellBondEarly(state, bondId) {
  const bond = (state.bondHoldings || []).find(b => b.id === bondId);
  if (!bond) return appendLog(state, "Bond not found.", "bad");

  const proceeds = Math.round(bond.faceValue * (1 - EARLY_SALE_PENALTY));
  const next = {
    ...state,
    cash: state.cash + proceeds,
    bondHoldings: state.bondHoldings.filter(b => b.id !== bondId),
  };
  return appendLog(
    next,
    `Sold bond early — received ${fmt(proceeds)} (${(EARLY_SALE_PENALTY * 100).toFixed(0)}% penalty applied).`,
    "info",
  );
}

// Daily bond housekeeping. Returns:
//   - cashDelta    : sum of all coupons paid + face values returned at maturity
//   - bondHoldings : updated holdings array (matured bonds removed)
//   - logEntries   : log entries for any maturities (already day-stamped)
//
// Called once per day from src/simulation.js — keeps nextDay() readable.
export function processBondsForDay(state) {
  let cashDelta = 0;
  const remaining = [];
  const logEntries = [];

  for (const bond of (state.bondHoldings || [])) {
    const dailyCoupon = bond.faceValue * (bond.yield / 365);
    cashDelta += dailyCoupon;

    if (state.day >= bond.maturityDay) {
      cashDelta += bond.faceValue;
      logEntries.push({
        msg: `Bond matured — received face value ${fmt(bond.faceValue)}.`,
        type: "good",
        day: state.day,
      });
    } else {
      remaining.push({
        ...bond,
        couponAccrued: bond.couponAccrued + dailyCoupon,
      });
    }
  }

  return { cashDelta, bondHoldings: remaining, logEntries };
}

function makeBondId(state) {
  return state.day + "_" + Math.random().toString(36).slice(2, 6);
}
