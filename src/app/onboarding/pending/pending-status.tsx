"use client";

import { OnboardingStatus } from "@prisma/client";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type PendingStatusProps = {
  initialStatus: OnboardingStatus;
  submittedAt?: string | null;
};

type StatusResponse = {
  approvalStatus?: OnboardingStatus;
  ownerOnboarding?: {
    status: OnboardingStatus;
  };
};

export function PendingStatus({ initialStatus, submittedAt }: PendingStatusProps) {
  const router = useRouter();
  const [status, setStatus] = useState<OnboardingStatus>(initialStatus);
  const [checking, setChecking] = useState(false);

  const refreshStatus = useCallback(async () => {
    setChecking(true);
    try {
      const response = await fetch("/api/onboarding/status", {
        cache: "no-store",
      });
      const data = (await response.json()) as StatusResponse;
      const latest = data.ownerOnboarding?.status ?? data.approvalStatus ?? OnboardingStatus.DRAFT;
      setStatus(latest);

      if (latest === OnboardingStatus.APPROVED) {
        router.replace("/dashboard");
        return;
      }

      if (latest === OnboardingStatus.REJECTED || latest === OnboardingStatus.DRAFT) {
        router.replace("/onboarding");
      }
    } finally {
      setChecking(false);
    }
  }, [router]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refreshStatus();
    }, 10000);

    return () => window.clearInterval(interval);
  }, [refreshStatus]);

  const statusLabel =
    status === OnboardingStatus.SUBMITTED
      ? "Submitted"
      : status === OnboardingStatus.UNDER_REVIEW
        ? "Under Review"
        : status === OnboardingStatus.APPROVED
          ? "Approved"
          : status === OnboardingStatus.REJECTED
            ? "Rejected"
            : "Draft";

  const progress =
    status === OnboardingStatus.SUBMITTED
      ? 34
      : status === OnboardingStatus.UNDER_REVIEW
        ? 68
        : status === OnboardingStatus.APPROVED
          ? 100
          : 0;

  const submittedAtLabel = submittedAt
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(submittedAt))
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="mt-5 space-y-4"
    >
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)]/55 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <motion.span
              className="relative inline-flex h-3 w-3 rounded-full bg-[var(--accent)]"
              animate={{
                scale: [1, 1.25, 1],
                opacity: [0.85, 1, 0.85],
              }}
              transition={{
                duration: 1.6,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }}
            >
              <span className="absolute inset-0 animate-ping rounded-full bg-[var(--accent)]/60" />
            </motion.span>
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Current status: {statusLabel}</p>
              <p className="text-xs text-[var(--text-muted)]">
                Auto-refreshes every 10 seconds{submittedAtLabel ? ` • Submitted on ${submittedAtLabel}` : ""}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" disabled={checking} onClick={() => void refreshStatus()}>
            {checking ? "Checking..." : "Check Status"}
          </Button>
        </div>

        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[var(--surface-soft)]">
          <motion.div
            className="h-full rounded-full bg-[var(--accent)]"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          />
        </div>

        <div className="mt-3 grid gap-2 text-xs text-[var(--text-secondary)] md:grid-cols-3">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2">
            1. Submission received
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2">
            2. Compliance review in progress
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2">
            3. Activation after approval
          </div>
        </div>
      </div>
    </motion.div>
  );
}
