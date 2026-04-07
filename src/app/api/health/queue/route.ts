import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getSyncDlqQueue, getSyncQueue } from "@/lib/queue";
import { requireSession } from "@/lib/session";

export async function GET() {
  const authResult = await requireSession();
  if ("error" in authResult) {
    return authResult.error;
  }

  const counts = await getSyncQueue().getJobCounts(
    "waiting",
    "active",
    "completed",
    "failed",
    "delayed",
  );
  const dlqCounts = await getSyncDlqQueue().getJobCounts("waiting", "active", "completed", "failed");
  const replayCounts = await prisma.syncReplayRequest.groupBy({
    by: ["status"],
    _count: {
      _all: true,
    },
  });

  return NextResponse.json({
    queue: "sync-jobs",
    counts,
    dlq: {
      queue: "sync-dlq",
      counts: dlqCounts,
    },
    replay: replayCounts.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = row._count._all;
      return acc;
    }, {}),
    schedule: {
      reconciliationEnabled: env.RECONCILIATION_ENABLED,
      reconciliationIntervalMinutes: env.RECONCILIATION_INTERVAL_MINUTES,
    },
    timestamp: new Date().toISOString(),
  });
}
