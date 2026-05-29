"use client";

/**
 * AutoRefresh — silent client component that calls router.refresh() on an
 * interval so server-rendered pages (like /dashboard) pick up new data
 * without requiring a full navigation. Used in the "generating" state to
 * detect when a scoring run completes.
 */

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface AutoRefreshProps {
  /** How often to refresh server data (ms). Default: 30 000 (30 s). */
  intervalMs?: number;
  /** Optional label shown in the countdown. Default: "Checking for results" */
  label?: string;
}

export default function AutoRefresh({
  intervalMs = 30_000,
  label = "Checking for results",
}: AutoRefreshProps) {
  const router = useRouter();
  const intervalSec = Math.floor(intervalMs / 1_000);
  const [countdown, setCountdown] = useState(intervalSec);

  useEffect(() => {
    // Refresh server data on interval
    const refreshId = setInterval(() => {
      router.refresh();
    }, intervalMs);

    // Tick countdown every second for the progress indicator
    const tickId = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) return intervalSec;
        return c - 1;
      });
    }, 1_000);

    return () => {
      clearInterval(refreshId);
      clearInterval(tickId);
    };
  }, [router, intervalMs, intervalSec]);

  return (
    <p className="text-xs text-gray-400 tabular-nums">
      {label} — refreshing in {countdown}s
    </p>
  );
}
