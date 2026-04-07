import { randomUUID } from "node:crypto";

import { Queue } from "bullmq";
import { PlatformType, Prisma, SyncActionType, SyncStatus } from "@prisma/client";

import { validateSyncPayloadForPlatform } from "@/lib/channel-capabilities";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { getRedisClient } from "@/lib/redis";
import type { SyncDlqJobPayload, SyncJobPayload } from "@/types/jobs";

export const SYNC_QUEUE_NAME = "sync-jobs";
export const SYNC_DLQ_QUEUE_NAME = "sync-dlq";

let syncQueueInstance: Queue<SyncJobPayload> | null = null;
let syncDlqQueueInstance: Queue<SyncDlqJobPayload> | null = null;

export function getSyncQueue() {
  if (!syncQueueInstance) {
    syncQueueInstance = new Queue<SyncJobPayload>(SYNC_QUEUE_NAME, {
      connection: getRedisClient(),
      defaultJobOptions: {
        attempts: 4,
        removeOnComplete: 200,
        removeOnFail: 500,
        backoff: {
          type: "exponential",
          delay: 2_000,
        },
      },
    });
  }

  return syncQueueInstance;
}

export function getSyncDlqQueue() {
  if (!syncDlqQueueInstance) {
    syncDlqQueueInstance = new Queue<SyncDlqJobPayload>(SYNC_DLQ_QUEUE_NAME, {
      connection: getRedisClient(),
      defaultJobOptions: {
        removeOnComplete: 500,
        removeOnFail: 1000,
      },
    });
  }

  return syncDlqQueueInstance;
}

export async function enqueueSyncForHotel(params: {
  hotelId: string;
  action: SyncActionType;
  bookingId?: string;
  roomTypeId?: string;
  payload?: Record<string, unknown>;
  platformIds?: string[];
  correlationId?: string;
  idempotencyKey?: string;
}) {
  const correlationId = params.correlationId ?? randomUUID();

  const platformConfigs = await prisma.hotelPlatformConfig.findMany({
    where: {
      hotelId: params.hotelId,
      isEnabled: true,
      ...(params.platformIds?.length
        ? {
            id: {
              in: params.platformIds,
            },
          }
        : {}),
    },
  });

  if (platformConfigs.length === 0) {
    logger.warn("No active platform configs found for sync enqueue", {
      hotelId: params.hotelId,
      action: params.action,
    });

    return { correlationId, queued: 0 };
  }

  const validPlatformConfigs: typeof platformConfigs = [];
  const skipped: Array<{ platformConfigId: string; platform: PlatformType; reason: string }> = [];

  for (const config of platformConfigs) {
    const validation = validateSyncPayloadForPlatform({
      platform: config.platform,
      action: params.action,
      bookingId: params.bookingId,
      roomTypeId: params.roomTypeId,
      payload: params.payload,
    });

    if (!validation.ok) {
      skipped.push({
        platformConfigId: config.id,
        platform: config.platform,
        reason: validation.errors.join("; "),
      });
      continue;
    }

    validPlatformConfigs.push(config);
  }

  if (skipped.length > 0) {
    await prisma.syncLog.createMany({
      data: skipped.map((entry) => ({
        hotelId: params.hotelId,
        bookingId: params.bookingId,
        hotelPlatformConfigId: entry.platformConfigId,
        platform: entry.platform,
        action: params.action,
        status: SyncStatus.FAILED,
        requestPayload: params.payload as Prisma.InputJsonValue | undefined,
        correlationId,
        idempotencyKey: params.idempotencyKey,
        errorMessage: entry.reason,
      })),
    });
  }

  if (validPlatformConfigs.length === 0) {
    logger.warn("No valid platform configs after capability/payload validation", {
      hotelId: params.hotelId,
      action: params.action,
      skipped,
    });
    return {
      correlationId,
      queued: 0,
      skipped: skipped.length,
      skippedDetails: skipped,
    };
  }

  await prisma.syncLog.createMany({
    data: validPlatformConfigs.map((config) => ({
      hotelId: params.hotelId,
      bookingId: params.bookingId,
      hotelPlatformConfigId: config.id,
      platform: config.platform,
      action: params.action,
      status: SyncStatus.QUEUED,
      requestPayload: params.payload as Prisma.InputJsonValue | undefined,
      correlationId,
      idempotencyKey: params.idempotencyKey,
    })),
  });

  await getSyncQueue().addBulk(
    validPlatformConfigs.map((config) => ({
      name: `${params.action}:${config.platform}`,
      opts: {
        jobId: `${correlationId}:${config.id}`,
      },
      data: {
        hotelId: params.hotelId,
        platformConfigId: config.id,
        platform: config.platform as PlatformType,
        action: params.action,
        bookingId: params.bookingId,
        roomTypeId: params.roomTypeId,
        correlationId,
        idempotencyKey: params.idempotencyKey,
        payload: params.payload,
      },
    })),
  );

  return {
    correlationId,
    queued: validPlatformConfigs.length,
    skipped: skipped.length,
    skippedDetails: skipped,
  };
}
