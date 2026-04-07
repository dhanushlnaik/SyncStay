import { NextRequest, NextResponse } from "next/server";

import { canAccessHotel } from "@/lib/authorization";
import { env } from "@/lib/env";
import { getUserScopedHotel } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

function percentile95(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[index];
}

export async function GET(request: NextRequest) {
  const authResult = await requireSession();
  if ("error" in authResult) {
    return authResult.error;
  }

  let hotelId = request.nextUrl.searchParams.get("hotelId");
  if (!hotelId) {
    const scoped = await getUserScopedHotel(authResult.domainUser.id);
    if (!scoped) {
      return NextResponse.json({ error: "No hotel assigned" }, { status: 404 });
    }
    hotelId = scoped.id;
  }

  const access = await canAccessHotel(authResult.domainUser, hotelId);
  if (!access) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [logs, lastScheduledRun] = await Promise.all([
    prisma.syncLog.findMany({
      where: {
        hotelId,
        createdAt: { gte: since },
      },
      select: {
        id: true,
        status: true,
        retryCount: true,
        createdAt: true,
        updatedAt: true,
      },
      take: 5000,
      orderBy: { createdAt: "desc" },
    }),
    prisma.syncReconciliationRun.findFirst({
      where: {
        hotelId,
        triggeredById: null,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        status: true,
        issuesFound: true,
      },
    }),
  ]);

  const total = logs.length;
  const successful = logs.filter((row) => row.status === "SUCCESS").length;
  const retried = logs.filter((row) => (row.retryCount ?? 0) > 0).length;
  const latenciesMs = logs.map((row) => Math.max(0, row.updatedAt.getTime() - row.createdAt.getTime()));

  const successRate = total === 0 ? 100 : Number(((successful / total) * 100).toFixed(1));
  const retryRate = total === 0 ? 0 : Number(((retried / total) * 100).toFixed(1));
  const p95LatencyMs = Math.round(percentile95(latenciesMs));

  return NextResponse.json({
    hotelId,
    windowHours: 24,
    metrics: {
      total,
      successful,
      retried,
      successRate,
      retryRate,
      p95LatencyMs,
    },
    schedule: {
      enabled: env.RECONCILIATION_ENABLED,
      intervalMinutes: env.RECONCILIATION_INTERVAL_MINUTES,
      lastScheduledRun,
    },
  });
}
