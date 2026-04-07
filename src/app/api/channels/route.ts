import { NextRequest, NextResponse } from "next/server";

import { canAccessHotel } from "@/lib/authorization";
import { getUserScopedHotel } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

type ChannelTestHistoryItem = {
  id: string;
  status: string;
  createdAt: Date;
  errorMessage: string | null;
  latencyMs: number | null;
};

function extractLatencyMs(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const value = (payload as { latencyMs?: unknown }).latencyMs;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function GET(request: NextRequest) {
  const authResult = await requireSession();
  if ("error" in authResult) {
    return authResult.error;
  }

  const hotelIdQuery = request.nextUrl.searchParams.get("hotelId");
  let hotelId = hotelIdQuery;

  if (!hotelId) {
    const scopedHotel = await getUserScopedHotel(authResult.domainUser.id);
    if (!scopedHotel) {
      return NextResponse.json({ error: "No hotel assigned" }, { status: 404 });
    }
    hotelId = scopedHotel.id;
  }

  const access = await canAccessHotel(authResult.domainUser, hotelId);
  if (!access) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [channels, testLogs] = await Promise.all([
    prisma.hotelPlatformConfig.findMany({
      where: { hotelId },
      include: {
        roomMappings: true,
      },
      orderBy: { platform: "asc" },
    }),
    prisma.syncLog.findMany({
      where: {
        hotelId,
        action: "FULL_SYNC",
        correlationId: {
          startsWith: "healthcheck:",
        },
      },
      select: {
        id: true,
        hotelPlatformConfigId: true,
        status: true,
        createdAt: true,
        errorMessage: true,
        responsePayload: true,
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
  ]);

  const historyByChannel = new Map<string, ChannelTestHistoryItem[]>();

  for (const row of testLogs) {
    if (!row.hotelPlatformConfigId) {
      continue;
    }

    const current = historyByChannel.get(row.hotelPlatformConfigId) ?? [];
    if (current.length >= 5) {
      continue;
    }

    current.push({
      id: row.id,
      status: row.status,
      createdAt: row.createdAt,
      errorMessage: row.errorMessage,
      latencyMs: extractLatencyMs(row.responsePayload),
    });
    historyByChannel.set(row.hotelPlatformConfigId, current);
  }

  return NextResponse.json({
    hotelId,
    items: channels.map((channel) => ({
      ...channel,
      testHistory: historyByChannel.get(channel.id) ?? [],
    })),
  });
}
