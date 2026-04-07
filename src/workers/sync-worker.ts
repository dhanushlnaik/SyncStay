import { Worker } from "bullmq";
import { NotificationType, SyncStatus } from "@prisma/client";

import {
  dispatchSyncActionToAdapter,
  getChannelAdapter,
} from "@/lib/channel-adapters";
import { ChannelAdapterError } from "@/lib/channel-adapters/types";
import { validateSyncPayloadForPlatform } from "@/lib/channel-capabilities";
import { publishEvent } from "@/lib/events";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { notifyAdmins } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { getSyncDlqQueue, SYNC_QUEUE_NAME } from "@/lib/queue";
import { getRedisClient } from "@/lib/redis";
import { runReconciliation } from "@/lib/reconciliation";
import type { SyncJobPayload } from "@/types/jobs";

const worker = new Worker<SyncJobPayload>(
  SYNC_QUEUE_NAME,
  async (job) => {
    const { data } = job;

    await prisma.syncLog.updateMany({
      where: {
        hotelId: data.hotelId,
        hotelPlatformConfigId: data.platformConfigId,
        action: data.action,
        status: SyncStatus.QUEUED,
        correlationId: data.correlationId,
      },
      data: {
        status: SyncStatus.PROCESSING,
        retryCount: job.attemptsMade,
      },
    });

    publishEvent({
      type: "sync.job.status",
      timestamp: new Date().toISOString(),
      payload: {
        status: SyncStatus.PROCESSING,
        correlationId: data.correlationId,
        platform: data.platform,
        action: data.action,
        idempotencyKey: data.idempotencyKey,
      },
    });

    try {
      const validation = validateSyncPayloadForPlatform({
        platform: data.platform,
        action: data.action,
        bookingId: data.bookingId,
        roomTypeId: data.roomTypeId,
        payload: data.payload,
      });

      if (!validation.ok) {
        throw new ChannelAdapterError(validation.errors.join("; "), {
          code: "CHANNEL_PAYLOAD_VALIDATION_FAILED",
          retriable: false,
        });
      }

      const adapter = getChannelAdapter(data.platform);
      const adapterResult = await dispatchSyncActionToAdapter(adapter, data);

      await prisma.syncLog.updateMany({
        where: {
          hotelId: data.hotelId,
          hotelPlatformConfigId: data.platformConfigId,
          action: data.action,
          correlationId: data.correlationId,
          status: {
            in: [SyncStatus.QUEUED, SyncStatus.PROCESSING],
          },
        },
        data: {
          status: SyncStatus.SUCCESS,
          responsePayload: adapterResult,
          retryCount: job.attemptsMade,
        },
      });

      await prisma.hotelPlatformConfig.update({
        where: {
          id: data.platformConfigId,
        },
        data: {
          lastSyncedAt: new Date(),
          lastErrorAt: null,
          lastErrorMessage: null,
        },
      });

      publishEvent({
        type: "sync.job.status",
        timestamp: new Date().toISOString(),
        payload: {
          status: SyncStatus.SUCCESS,
          correlationId: data.correlationId,
          platform: data.platform,
          action: data.action,
          providerReference: adapterResult.providerReference,
          idempotencyKey: data.idempotencyKey,
        },
      });
    } catch (error) {
      const adapterError =
        error instanceof ChannelAdapterError
          ? error
          : new ChannelAdapterError(
              error instanceof Error ? error.message : `Unexpected ${data.platform} sync failure`,
            );

      const errorMessage = adapterError.message;

      await prisma.syncLog.updateMany({
        where: {
          hotelId: data.hotelId,
          hotelPlatformConfigId: data.platformConfigId,
          action: data.action,
          correlationId: data.correlationId,
          status: {
            in: [SyncStatus.QUEUED, SyncStatus.PROCESSING],
          },
        },
        data: {
          status: SyncStatus.FAILED,
          errorMessage,
          retryCount: job.attemptsMade,
        },
      });

      await prisma.hotelPlatformConfig.update({
        where: {
          id: data.platformConfigId,
        },
        data: {
          lastErrorAt: new Date(),
          lastErrorMessage: errorMessage,
        },
      });

      publishEvent({
        type: "sync.job.status",
        timestamp: new Date().toISOString(),
        payload: {
          status: SyncStatus.FAILED,
          correlationId: data.correlationId,
          platform: data.platform,
          action: data.action,
          errorMessage,
          errorCode: adapterError.code,
          retriable: adapterError.retriable,
          idempotencyKey: data.idempotencyKey,
        },
      });

      if (!adapterError.retriable) {
        job.discard();
      }

      throw adapterError;
    }
  },
  {
    connection: getRedisClient(),
    concurrency: 8,
  },
);

worker.on("ready", () => {
  logger.info("Sync worker started", { queue: SYNC_QUEUE_NAME });
});

worker.on("failed", (job, error) => {
  logger.error("Sync job failed", {
    jobId: job?.id,
    error: error.message,
    attemptsMade: job?.attemptsMade,
  });

  if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    void getSyncDlqQueue().add(
      `dlq:${job.id}`,
      {
        ...job.data,
        failedJobId: String(job.id),
        failedAt: new Date().toISOString(),
        errorMessage: error.message,
      },
      {
        jobId: String(job.id),
      },
    );

    void (async () => {
      const owner = await prisma.hotel.findUnique({
        where: { id: job.data.hotelId },
        select: { ownerId: true },
      });

      if (owner?.ownerId) {
        await prisma.syncReplayRequest.create({
          data: {
            jobId: String(job.id),
            hotelId: job.data.hotelId,
            status: "REQUESTED",
            notes: error.message,
            requestedById: owner.ownerId,
          },
        });
      }
    })().catch(() => undefined);

    void notifyAdmins({
      type: NotificationType.SYNC_FAILURE,
      title: "Sync job moved to DLQ",
      body: `Job ${job.id} failed repeatedly and moved to DLQ.`,
      sendEmail: true,
    });
  }
});

worker.on("completed", (job) => {
  logger.info("Sync job completed", {
    jobId: job.id,
    name: job.name,
  });
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    logger.warn(`Received ${signal}, closing worker`);
    await worker.close();
    process.exit(0);
  });
}

if (env.RECONCILIATION_ENABLED) {
  const reconciliationIntervalMs = env.RECONCILIATION_INTERVAL_MINUTES * 60 * 1000;
  logger.info("Scheduled reconciliation enabled", {
    intervalMinutes: env.RECONCILIATION_INTERVAL_MINUTES,
  });

  const interval = setInterval(async () => {
    const hotels = await prisma.hotel.findMany({
      where: { status: "ACTIVE" },
      select: { id: true },
      take: 20,
    });

    for (const hotel of hotels) {
      try {
        await runReconciliation({
          hotelId: hotel.id,
        });
      } catch (error) {
        logger.error("Scheduled reconciliation failed", {
          hotelId: hotel.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }, reconciliationIntervalMs);

  interval.unref();
} else {
  logger.warn("Scheduled reconciliation disabled via env");
}
