import test from "node:test";
import assert from "node:assert/strict";
import {
  getHoldCountdownState,
  getRemainingHoldSeconds,
  getServerTimeOffset,
  subscribeToHoldCountdown,
} from "./useHoldCountdown.js";

test("remaining hold time uses the expiry timestamp and server clock offset", () => {
  const now = Date.parse("2026-01-01T00:00:00.000Z");
  const offset = getServerTimeOffset("2026-01-01T00:00:05.000Z", now);

  assert.equal(getRemainingHoldSeconds("2026-01-01T00:00:15.000Z", offset, now), 10);
  assert.equal(getRemainingHoldSeconds("2026-01-01T00:00:05.500Z", offset, now), 1);
  assert.equal(getRemainingHoldSeconds("2026-01-01T00:00:04.000Z", offset, now), 0);
});

test("countdown states switch at warning, urgent, and expiry thresholds", () => {
  assert.equal(getHoldCountdownState(null), "inactive");
  assert.equal(getHoldCountdownState(300), "normal");
  assert.equal(getHoldCountdownState(299), "warning");
  assert.equal(getHoldCountdownState(60), "warning");
  assert.equal(getHoldCountdownState(59), "urgent");
  assert.equal(getHoldCountdownState(0), "expired");
});

test("visibility and focus events recompute from the timestamp and clean up listeners", () => {
  const windowListeners = new Map();
  const documentListeners = new Map();
  let now = 0;
  let intervalCallback;
  let clearedInterval;
  const browserWindow = {
    addEventListener: (name, callback) => windowListeners.set(name, callback),
    removeEventListener: (name) => windowListeners.delete(name),
    setInterval: (callback) => {
      intervalCallback = callback;
      return 7;
    },
    clearInterval: (id) => { clearedInterval = id; },
  };
  const browserDocument = {
    visibilityState: "visible",
    addEventListener: (name, callback) => documentListeners.set(name, callback),
    removeEventListener: (name) => documentListeners.delete(name),
  };
  const updates = [];
  const cleanup = subscribeToHoldCountdown(
    15_000,
    0,
    (remaining) => updates.push(remaining),
    browserWindow,
    browserDocument,
    () => now,
  );

  now = 2_000;
  browserDocument.visibilityState = "hidden";
  documentListeners.get("visibilitychange")();
  assert.deepEqual(updates, [15]);

  browserDocument.visibilityState = "visible";
  documentListeners.get("visibilitychange")();
  now = 5_000;
  windowListeners.get("focus")();
  intervalCallback();
  assert.deepEqual(updates, [15, 13, 10, 10]);

  cleanup();
  assert.equal(clearedInterval, 7);
  assert.equal(windowListeners.size, 0);
  assert.equal(documentListeners.size, 0);
});