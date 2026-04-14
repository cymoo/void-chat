import { useState, useEffect } from "react";

// Shared interval — all subscribers share one timer
let listeners: Set<() => void> = new Set();
let intervalId: ReturnType<typeof setInterval> | null = null;

function startTicker() {
  if (intervalId !== null) return;
  intervalId = setInterval(() => {
    listeners.forEach((fn) => fn());
  }, 60_000); // every minute
}

function stopTicker() {
  if (listeners.size === 0 && intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export function useCurrentMinute(): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const notify = () => setTick((t) => t + 1);
    listeners.add(notify);
    startTicker();
    return () => {
      listeners.delete(notify);
      stopTicker();
    };
  }, []);

  return tick;
}
