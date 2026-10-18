import { useLayoutEffect, useRef, useState } from "react";
import { FaArrowLeft, FaClock } from "react-icons/fa";
import { Link } from "react-router-dom";
import { getHoldCountdownState } from "../hooks/useHoldCountdown.js";

const stateStyles = {
  normal: "border-amber-300 bg-amber-100 text-amber-950",
  warning: "border-orange-400 bg-orange-100 text-orange-950",
  urgent: "border-red-400 bg-red-100 text-red-950",
  expired: "border-red-400 bg-red-100 text-red-950",
};

const announcements = {
  warning: "Your hold is ending in less than five minutes.",
  urgent: "Your hold is ending in less than one minute.",
  expired: "Your hold has expired.",
};

function formatCountdown(seconds) {
  const safeSeconds = Math.max(0, seconds || 0);
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, "0")}:${String(safeSeconds % 60).padStart(2, "0")}`;
}

export default function HoldTimerBar({
  secondsLeft,
  resourceName,
  expiredHref,
  backLabel = "Back to rooms and venues",
}) {
  const [headerHeight, setHeaderHeight] = useState(0);
  const [isPublicHeader, setIsPublicHeader] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const previousState = useRef("inactive");
  const state = getHoldCountdownState(secondsLeft);
  const isExpired = state === "expired";

  useLayoutEffect(() => {
    if (state === "inactive") return undefined;

    const updateHeaderHeight = () => {
      const publicHeader = document.getElementById("public-site-header");
      const header = publicHeader || document.getElementById("portal-topbar");
      const height = header?.getBoundingClientRect().height || 0;
      setHeaderHeight(height);
      setIsPublicHeader(Boolean(publicHeader));
      document.documentElement.style.setProperty("--hold-timer-top", `${height}px`);
      document.documentElement.style.scrollPaddingTop = `calc(${height}px + 3.5rem + env(safe-area-inset-top, 0px))`;
    };
    const previousScrollPadding = document.documentElement.style.scrollPaddingTop;
    const previousTimerTop = document.documentElement.style.getPropertyValue("--hold-timer-top");

    updateHeaderHeight();
    const header = document.getElementById("public-site-header")
      || document.getElementById("portal-topbar");
    const observer = header && window.ResizeObserver
      ? new ResizeObserver(updateHeaderHeight)
      : null;
    if (header && observer) observer.observe(header);
    window.addEventListener("resize", updateHeaderHeight);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateHeaderHeight);
      if (previousTimerTop) document.documentElement.style.setProperty("--hold-timer-top", previousTimerTop);
      else document.documentElement.style.removeProperty("--hold-timer-top");
      document.documentElement.style.scrollPaddingTop = previousScrollPadding;
    };
  }, [state !== "inactive"]);

  useLayoutEffect(() => {
    if (previousState.current !== state && announcements[state]) {
      setAnnouncement(announcements[state]);
    }
    previousState.current = state;
  }, [state]);

  if (state === "inactive") return null;

  const timerLabel = isExpired
    ? "Your hold has expired"
    : state === "urgent"
      ? "Hold ending soon"
      : state === "warning"
        ? "Hold ending soon"
        : "Your dates are held for";
  const top = `${headerHeight}px`;

  return (
    <>
      <div
        aria-hidden="true"
        className="box-content h-[2.9375rem] pt-[env(safe-area-inset-top)] sm:h-[3.6875rem]"
        style={{ marginTop: isPublicHeader ? Math.max(0, headerHeight - 65) : undefined }}
      />
      <div
        className={`fixed inset-x-0 z-[60] border-b shadow-sm ${stateStyles[state]}`}
        style={{ top }}
      >
        <div className="mx-auto flex min-h-11 max-w-7xl items-center gap-2 px-3 pt-[env(safe-area-inset-top)] sm:min-h-14 sm:gap-3 sm:px-6 lg:px-8">
          <FaClock aria-hidden="true" className="shrink-0 text-sm sm:text-base" />
          <span className="hidden shrink-0 text-sm font-semibold sm:inline">
            {timerLabel}
          </span>
          <span className="shrink-0 text-xs font-semibold sm:hidden">
            {isExpired ? "Hold expired" : state === "normal" ? "Held for" : "Ending soon"}
          </span>
          <span
            role="timer"
            aria-label={isExpired ? "Hold expired" : `Time remaining ${formatCountdown(secondsLeft)}`}
            className="shrink-0 font-mono text-sm font-bold tabular-nums sm:text-base"
          >
            {formatCountdown(secondsLeft)}
          </span>
          {resourceName ? (
            <span
              className="min-w-0 flex-1 truncate text-xs font-medium sm:text-sm"
              title={resourceName}
            >
              {resourceName}
            </span>
          ) : <span className="min-w-0 flex-1" />}
          {isExpired && expiredHref ? (
            <Link
              to={expiredHref}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-current px-2 py-1 text-xs font-bold hover:bg-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current sm:gap-2 sm:px-3 sm:py-2 sm:text-sm"
            >
              <FaArrowLeft aria-hidden="true" />
              <span className="hidden sm:inline">{backLabel}</span>
              <span className="sm:hidden">Back</span>
            </Link>
          ) : null}
        </div>
        {!isExpired ? (
          <div
            aria-hidden="true"
            className="h-0.5 bg-black/10"
          >
            <div
              className="h-full bg-current"
              style={{ width: `${Math.max(0, Math.min(100, 100 - (secondsLeft / 900) * 100))}%` }}
            />
          </div>
        ) : null}
      </div>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>
    </>
  );
}