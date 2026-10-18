import { useEffect, useState } from "react";

export function getServerTimeOffset(serverTime, serverTimeReceivedAt = Date.now()) {
  const serverTimestamp = serverTime ? new Date(serverTime).getTime() : Number.NaN;
  const receivedAt = Number(serverTimeReceivedAt);
  return Number.isFinite(serverTimestamp) && Number.isFinite(receivedAt)
    ? serverTimestamp - receivedAt
    : 0;
}

export function getHoldServerTimeOffset(
  expiresAt,
  serverTime,
  serverTimeReceivedAt,
  storage = globalThis.sessionStorage,
  now = Date.now(),
) {
  if (!serverTime) return 0;
  const explicitReceivedAt = Number(serverTimeReceivedAt);
  if (serverTimeReceivedAt !== null
    && serverTimeReceivedAt !== undefined
    && Number.isFinite(explicitReceivedAt)) {
    return getServerTimeOffset(serverTime, explicitReceivedAt);
  }

  const key = "kairos_hold_clock_reference";
  const reference = storage ? JSON.parse(storage.getItem(key) || "null") : null;
  const sameHold = reference?.expiresAt === expiresAt && reference?.serverTime === serverTime;
  const receivedAt = sameHold && Number.isFinite(Number(reference.receivedAt))
    ? Number(reference.receivedAt)
    : now;
  if (!sameHold && storage) {
    storage.setItem(key, JSON.stringify({ expiresAt, serverTime, receivedAt }));
  }
  return getServerTimeOffset(serverTime, receivedAt);
}

export function getRemainingHoldSeconds(expiresAt, serverOffset = 0, now = Date.now()) {
  const expiryTimestamp = expiresAt ? new Date(expiresAt).getTime() : Number.NaN;
  if (!Number.isFinite(expiryTimestamp)) return null;
  return Math.max(0, Math.ceil((expiryTimestamp - (now + serverOffset)) / 1000));
}

export function getHoldCountdownState(secondsLeft) {
  if (secondsLeft === null) return "inactive";
  if (secondsLeft <= 0) return "expired";
  if (secondsLeft < 60) return "urgent";
  if (secondsLeft < 300) return "warning";
  return "normal";
}

export function subscribeToHoldCountdown(
  expiresAt,
  serverOffset,
  onUpdate,
  browserWindow = window,
  browserDocument = document,
  now = Date.now,
) {
  if (getRemainingHoldSeconds(expiresAt, serverOffset, now()) === null) {
    onUpdate(null);
    return () => {};
  }

  const update = () => onUpdate(getRemainingHoldSeconds(expiresAt, serverOffset, now()));
  const updateWhenVisible = () => {
    if (browserDocument.visibilityState === "visible") update();
  };

  update();
  const timer = browserWindow.setInterval(update, 1000);
  browserWindow.addEventListener("focus", update);
  browserDocument.addEventListener("visibilitychange", updateWhenVisible);

  return () => {
    browserWindow.clearInterval(timer);
    browserWindow.removeEventListener("focus", update);
    browserDocument.removeEventListener("visibilitychange", updateWhenVisible);
  };
}

export default function useHoldCountdown(expiresAt, serverTime, serverTimeReceivedAt) {
  const serverOffset = getHoldServerTimeOffset(
    expiresAt,
    serverTime,
    serverTimeReceivedAt,
  );
  const [secondsLeft, setSecondsLeft] = useState(() => getRemainingHoldSeconds(
    expiresAt,
    serverOffset,
  ));

  useEffect(() => {
    return subscribeToHoldCountdown(expiresAt, serverOffset, setSecondsLeft);
  }, [expiresAt, serverTime, serverTimeReceivedAt]);

  return secondsLeft;
}