import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateHoldSecondsLeft,
  getHoldCountdownState,
  getServerClockOffset,
  startHoldClock,
} from "./useHoldCountdown.js";

test("calculates remaining time against the server clock and clamps expired holds", () => {
  const now = Date.parse("2026-01-01T10:00:00Z");
  const offset = getServerClockOffset("2026-01-01T10:00:30Z", now);

  assert.equal(calculateHoldSecondsLeft("2026-01-01T10:05:00Z", offset, now), 270);
  assert.equal(calculateHoldSecondsLeft("2026-01-01T09:59:59Z", offset, now), 0);
  assert.equal(calculateHoldSecondsLeft("not-a-date", offset, now), null);
});

test("classifies normal, warning, urgent, and expired countdown thresholds", () => {
  assert.equal(getHoldCountdownState(300), "normal");
  assert.equal(getHoldCountdownState(299), "warning");
  assert.equal(getHoldCountdownState(60), "warning");
  assert.equal(getHoldCountdownState(59), "urgent");
  assert.equal(getHoldCountdownState(0), "expired");
  assert.equal(getHoldCountdownState(null), null);
});

test("refreshes immediately on focus and visibility changes and cleans up listeners", () => {
  const listeners = new Map();
  let intervalCallback;
  let cleared = false;
  let calls = 0;
  const windowObject = {
    setInterval(callback) {
      intervalCallback = callback;
      return 1;
    },
    clearInterval(id) {
      cleared = id === 1;
    },
    addEventListener(name, callback) {
      listeners.set(`window:${name}`, callback);
    },
    removeEventListener(name, callback) {
      if (listeners.get(`window:${name}`) === callback) listeners.delete(`window:${name}`);
    },
  };
  const documentObject = {
    addEventListener(name, callback) {
      listeners.set(`document:${name}`, callback);
    },
    removeEventListener(name, callback) {
      if (listeners.get(`document:${name}`) === callback) listeners.delete(`document:${name}`);
    },
  };

  const stop = startHoldClock(() => { calls += 1; }, windowObject, documentObject);
  listeners.get("window:focus")();
  listeners.get("document:visibilitychange")();
  intervalCallback();

  assert.equal(calls, 4);
  stop();
  assert.equal(cleared, true);
  assert.equal(listeners.size, 0);
});
