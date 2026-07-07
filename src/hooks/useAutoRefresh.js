import { useRef, useEffect } from "react";

/**
 * Re-runs a callback on a fixed interval, always invoking the latest
 * callback via a ref (avoids stale closures without resetting the interval).
 * @param {() => void} callback - function to call on each tick
 * @param {number} intervalMs - interval in milliseconds (default 5 minutes)
 */
export function useAutoRefresh(callback, intervalMs = 5 * 60 * 1000) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  useEffect(() => {
    const interval = setInterval(() => callbackRef.current(), intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs]);
}