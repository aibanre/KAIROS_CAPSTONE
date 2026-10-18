import { useEffect, useRef, useState } from "react";
import { FaArrowLeft, FaClock } from "react-icons/fa";
import { getHoldCountdownState } from "../hooks/useHoldCountdown.js";

const HOLD_DURATION_SECONDS = 15 * 60;

function formatCountdown(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function HoldTimerBar({
  secondsLeft,
  resourceName,
  expiredHref,
  backLabel = "Back to rooms and venues",
  placement = "standalone",
}) {
  const previousState = useRef(null);
  const [announcement, setAnnouncement] = useState("");
  const state = getHoldCountdownState(secondsLeft);
  const portalPlacement = placement === "portal";

  useEffect(() => {
    if (!portalPlacement) return undefined;
    const root = document.documentElement;
    const previousHeight = root.style.getPropertyValue("--portal-topbar-height");
    const topbar = document.getElementById("portal-topbar");
    if (!topbar) return undefined;

    const updateHeight = () => {
      root.style.setProperty("--portal-topbar-height", `${topbar.getBoundingClientRect().height}px`);
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(topbar);
    return () => {
      observer.disconnect();
      if (previousHeight) root.style.setProperty("--portal-topbar-height", previousHeight);
      else root.style.removeProperty("--portal-topbar-height");
    };
  }, [portalPlacement]);

  useEffect(() => {
    const root = document.documentElement;
    const previousScrollPadding = root.style.scrollPaddingTop;
    const barTop = portalPlacement ? "calc(var(--portal-topbar-height, 0px) + 3.25rem)" : "calc(var(--public-header-height, 4rem) + 3.25rem)";
    root.style.scrollPaddingTop = `calc(${barTop} + env(safe-area-inset-top, 0px))`;
    return () => {
      root.style.scrollPaddingTop = previousScrollPadding;
    };
  }, [portalPlacement]);

  useEffect(() => {
    if (!state) {
      previousState.current = null;
      setAnnouncement("");
      return;
    }
    const stateOrder = { normal: 0, warning: 1, urgent: 2, expired: 3 };
    if (previousState.current !== null && stateOrder[state] > stateOrder[previousState.current]) {
      setAnnouncement(state === "warning"
        ? "Your hold has less than five minutes remaining."
        : state === "urgent"
          ? "Your hold has less than one minute remaining."
          : "Your hold has expired.");
    }
    previousState.current = state;
  }, [state]);

  if (secondsLeft === null) return null;

  const expired = state === "expired";
  const palette = expired
    ? "border-rose-300 bg-rose-100 text-rose-900"
    : state === "urgent"
      ? "border-red-300 bg-red-100 text-red-900"
      : state === "warning"
        ? "border-orange-300 bg-orange-100 text-orange-950"
        : "border-amber-300 bg-amber-100 text-amber-950";
  const progress = Math.min(100, Math.max(0, ((HOLD_DURATION_SECONDS - secondsLeft) / HOLD_DURATION_SECONDS) * 100));
  const time = formatCountdown(secondsLeft);
  const top = portalPlacement ? "var(--portal-topbar-height, 0px)" : "var(--public-header-height, 4rem)";

  return (
    <div
      className={`sticky z-20 w-full border-b shadow-sm ${palette} motion-reduce:transition-none`}
      style={{
        top,
        scrollMarginTop: `calc(${top} + 3rem)`,
      }}
    >
      <div className="h-0.5 w-full bg-black/10" aria-hidden="true">
        {!expired ? (
          <div
            className="h-full bg-current motion-reduce:transition-none"
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-label="Hold time used"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
          />
        ) : null}
      </div>
      <div className="mx-auto w-full max-w-[80rem] px-3 sm:px-6 lg:px-8">
        <div className="flex min-h-[2.75rem] items-center gap-2 sm:gap-3">
          <FaClock aria-hidden="true" className="shrink-0 text-sm sm:text-base" />
          <span className="hidden shrink-0 text-xs font-semibold sm:inline">
            {expired ? "Your hold has expired" : state === "normal" ? "Your dates are held for" : "Hold ending soon"}
          </span>
          <span className="shrink-0 text-[11px] font-semibold sm:hidden">
            {expired ? "Hold expired" : state === "normal" ? "Held for" : "Ending soon"}
          </span>
          {!expired ? (
            <span
              role="timer"
              aria-label={`${time} remaining`}
              className="shrink-0 font-mono text-sm font-bold tabular-nums sm:text-base"
            >
              {time}
            </span>
          ) : null}
          {resourceName ? (
            <span className="min-w-0 flex-1 truncate text-[11px] font-medium sm:text-sm" title={resourceName}>
              {resourceName}
            </span>
          ) : (
            <span className="min-w-0 flex-1" />
          )}
          {expired ? (
            <a
              href={expiredHref || "/rooms-and-venues"}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-rose-400 bg-white/70 px-2 py-1.5 text-[10px] font-bold text-rose-900 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 sm:px-3 sm:text-xs"
            >
              <FaArrowLeft aria-hidden="true" />
              <span>{backLabel}</span>
            </a>
          ) : null}
          <span className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</span>
        </div>
      </div>
    </div>
  );
}
