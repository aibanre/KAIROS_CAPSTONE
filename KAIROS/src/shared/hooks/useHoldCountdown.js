import { useEffect, useMemo, useState } from "react";

export function getServerClockOffset(serverTime, clientTime = Date.now()) {
  const serverTimestamp = Date.parse(serverTime);
  return Number.isFinite(serverTimestamp) ? serverTimestamp - clientTime : 0;
}

export function calculateHoldSecondsLeft(expiresAt, serverOffset = 0, now = Date.now()) {
  const expiration = Date.parse(expiresAt);
  if (!Number.isFinite(expiration)) return null;
  return Math.max(0, Math.ceil((expiration - (now + serverOffset)) / 1000));
}

export function getHoldCountdownState(secondsLeft) {
  if (secondsLeft === null) return null;
  if (secondsLeft <= 0) return "expired";
  if (secondsLeft < 60) return "urgent";
  if (secondsLeft < 5 * 60) return "warning";
  return "normal";
}

export function startHoldClock(update, windowObject = window, documentObject = document) {
  const refresh = () => update();
  const interval = windowObject.setInterval(refresh, 1000);
  windowObject.addEventListener("focus", refresh);
  documentObject.addEventListener("visibilitychange", refresh);
  refresh();

  return () => {
    windowObject.clearInterval(interval);
    windowObject.removeEventListener("focus", refresh);
    documentObject.removeEventListener("visibilitychange", refresh);
  };
}

export default function useHoldCountdown(expiresAt, serverTime = null) {
  const [now, setNow] = useState(() => Date.now());
  const serverOffset = useMemo(() => getServerClockOffset(serverTime), [serverTime]);

  useEffect(() => startHoldClock(() => setNow(Date.now())), []);

  return calculateHoldSecondsLeft(expiresAt, serverOffset, now);
}
