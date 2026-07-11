"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function ReviewAutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => router.refresh(), 3_000);
    return () => clearInterval(interval);
  }, [active, router]);

  return null;
}
