// ============================================================
// LOG — A tiny helper for appending day-stamped messages.
// Lives in its own module so it has zero dependencies and can
// be imported by anything without risking a circular import.
// ============================================================

// Append a log entry tagged with the current day. Returns a new state.
// `type` is one of: "good" | "bad" | "info" | "event" (used for CSS).
export function appendLog(state, msg, type) {
  return { ...state, log: [...state.log, { msg, type, day: state.day }] };
}
