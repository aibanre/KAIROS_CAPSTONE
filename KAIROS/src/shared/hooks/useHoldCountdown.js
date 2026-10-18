import { useEffect, useState } from "react";

export function getServerTimeOffset(serverTime, clientNow = Date.now()) {
  const serverTimestamp = serverTime ? new Date(serverTime).getTime() : Number.NaN;
  return Number.isFinite(serverTimestamp) ? serverTimestamp - clientNow : 0;
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

export default function useHoldCountdown(expiresAt, serverTime) {
  const [secondsLeft, setSecondsLeft] = useState(() => getRemainingHoldSeconds(
    expiresAt,
    getServerTimeOffset(serverTime),
  ));

  useEffect(() => {
    const serverOffset = getServerTimeOffset(serverTime);
    return subscribeToHoldCountdown(expiresAt, serverOffset, setSecondsLeft);
  }, [expiresAt, serverTime]);

  return secondsLeft;
}