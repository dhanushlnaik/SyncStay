import { NextRequest, NextResponse } from "next/server";

import { canAccessHotel } from "@/lib/authorization";
import { replayRequestSchema } from "@/lib/contracts";
import { prisma } from "@/lib/prisma";
import { getSyncDlqQueue, getSyncQueue } from "@/lib/queue";
import { requireSession } from "@/lib/session";
import type { SyncDlqJobPayload } from "@/types/jobs";

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{ jobId: string }>;
  },
) {
  const authResult = await requireSession();
  if ("error" in authResult) {
    return authResult.error;
  }

  const { jobId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const parsed = replayRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const dlqQueue = getSyncDlqQueue();
  const syncQueue = getSyncQueue();

  const dlqJob = await dlqQueue.getJob(jobId);
  if (!dlqJob) {
    return NextResponse.json({ error: "DLQ job not found" }, { status: 404 });
  }

  const payload = dlqJob.data as SyncDlqJobPayload;
  const access = await canAccessHotel(authResult.domainUser, payload.hotelId);
  if (!access) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const replayedJob = await syncQueue.add(
    `replay:${payload.action}:${payload.platform}`,
    {
      hotelId: payload.hotelId,
      platformConfigId: payload.platformConfigId,
      platform: payload.platform,
      action: payload.action,
      bookingId: payload.bookingId,
      roomTypeId: payload.roomTypeId,
      correlationId: payload.correlationId,
      idempotencyKey: payload.idempotencyKey,
      payload: {
        ...(payload.payload ?? {}),
        replayedFromJobId: jobId,
        replayRequestedBy: authResult.domainUser.id,
      },
    },
    {
      jobId: `replay-${jobId}-${Date.now()}`,
    },
  );

  await prisma.syncReplayRequest.create({
    data: {
      jobId,
      hotelId: payload.hotelId,
      requestedById: authResult.domainUser.id,
      status: "COMPLETED",
      notes: parsed.data.notes,
      processedAt: new Date(),
    },
  });

  await dlqJob.remove();

  return NextResponse.json({
    replayedJobId: replayedJob.id,
    sourceDlqJobId: jobId,
  });
}
