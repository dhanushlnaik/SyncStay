import { PlatformConnectionStatus, SyncActionType, SyncStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { getChannelAdapter } from "@/lib/channel-adapters";
import { canAccessHotel } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function POST(
  _request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  const authResult = await requireSession();
  if ("error" in authResult) {
    return authResult.error;
  }

  const { id } = await context.params;
  const channel = await prisma.hotelPlatformConfig.findUnique({
    where: { id },
  });

  if (!channel) {
    return NextResponse.json({ error: "Channel config not found" }, { status: 404 });
  }

  const access = await canAccessHotel(authResult.domainUser, channel.hotelId);
  if (!access) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let pendingLogId: string | null = null;

  try {
    const correlationId = `healthcheck:${Date.now()}:${channel.id}`;
    const startedAt = new Date();

    const pendingLog = await prisma.syncLog.create({
      data: {
        hotelId: channel.hotelId,
        hotelPlatformConfigId: channel.id,
        platform: channel.platform,
        action: SyncActionType.FULL_SYNC,
        status: SyncStatus.PROCESSING,
        correlationId,
        requestPayload: {
          kind: "connection_test",
          initiatedBy: authResult.domainUser.id,
          startedAt: startedAt.toISOString(),
        },
      },
    });
    pendingLogId = pendingLog.id;

    const adapter = getChannelAdapter(channel.platform);
    const health = await adapter.healthCheck({
      hotelId: channel.hotelId,
      platformConfigId: channel.id,
    });

    const status = health.ok ? PlatformConnectionStatus.CONNECTED : PlatformConnectionStatus.ERROR;
    const updated = await prisma.hotelPlatformConfig.update({
      where: { id: channel.id },
      data: {
        status,
        lastSyncedAt: health.ok ? new Date() : channel.lastSyncedAt,
        lastErrorAt: health.ok ? null : new Date(),
        lastErrorMessage: health.ok ? null : health.message ?? "Connection test failed",
      },
    });

    const completedLog = await prisma.syncLog.update({
      where: { id: pendingLog.id },
      data: {
        status: health.ok ? SyncStatus.SUCCESS : SyncStatus.FAILED,
        errorMessage: health.ok ? null : health.message ?? "Connection test failed",
        responsePayload: {
          kind: "connection_test",
          latencyMs: health.latencyMs,
          ok: health.ok,
          message: health.message,
        },
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        errorMessage: true,
      },
    });

    return NextResponse.json({
      ok: health.ok,
      latencyMs: health.latencyMs,
      message: health.message,
      status,
      channel: updated,
      testLog: {
        id: completedLog.id,
        status: completedLog.status,
        createdAt: completedLog.createdAt,
        errorMessage: completedLog.errorMessage,
        latencyMs: health.latencyMs,
      },
    });
  } catch (error) {
    const failedLog = pendingLogId
      ? await prisma.syncLog.update({
          where: { id: pendingLogId },
          data: {
            status: SyncStatus.FAILED,
            errorMessage: error instanceof Error ? error.message : "Unknown connection test error",
            responsePayload: {
              kind: "connection_test",
              ok: false,
            },
          },
          select: {
            id: true,
            status: true,
            createdAt: true,
            errorMessage: true,
          },
        })
      : await prisma.syncLog.create({
          data: {
            hotelId: channel.hotelId,
            hotelPlatformConfigId: channel.id,
            platform: channel.platform,
            action: SyncActionType.FULL_SYNC,
            status: SyncStatus.FAILED,
            correlationId: `healthcheck:${Date.now()}:${channel.id}`,
            errorMessage: error instanceof Error ? error.message : "Unknown connection test error",
            requestPayload: {
              kind: "connection_test",
              initiatedBy: authResult.domainUser.id,
            },
          },
          select: {
            id: true,
            status: true,
            createdAt: true,
            errorMessage: true,
          },
        });

    const updated = await prisma.hotelPlatformConfig.update({
      where: { id: channel.id },
      data: {
        status: PlatformConnectionStatus.ERROR,
        lastErrorAt: new Date(),
        lastErrorMessage: error instanceof Error ? error.message : "Unknown connection test error",
      },
    });

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Connection test failed",
        status: PlatformConnectionStatus.ERROR,
        channel: updated,
        testLog: {
          id: failedLog.id,
          status: failedLog.status,
          createdAt: failedLog.createdAt,
          errorMessage: failedLog.errorMessage,
          latencyMs: null,
        },
      },
      { status: 400 },
    );
  }
}
