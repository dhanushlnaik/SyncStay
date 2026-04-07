import { NextRequest, NextResponse } from "next/server";

import { canAccessHotel } from "@/lib/authorization";
import { getSyncDlqQueue } from "@/lib/queue";
import { requireSession } from "@/lib/session";
import type { SyncDlqJobPayload } from "@/types/jobs";

type JobShape = {
  id: string | null;
  name: string;
  data: SyncDlqJobPayload;
  failedReason?: string;
  attemptsMade: number;
  timestamp: number;
};

export async function GET(request: NextRequest) {
  const authResult = await requireSession();
  if ("error" in authResult) {
    return authResult.error;
  }

  const hotelIdFilter = request.nextUrl.searchParams.get("hotelId");
  const queue = getSyncDlqQueue();
  const jobs = await queue.getJobs(["waiting", "active", "completed", "failed"], 0, 100, false);

  const allowedJobs: JobShape[] = [];

  for (const job of jobs) {
    const data = job.data as SyncDlqJobPayload;
    const access = await canAccessHotel(authResult.domainUser, data.hotelId);
    if (!access) {
      continue;
    }
    if (hotelIdFilter && data.hotelId !== hotelIdFilter) {
      continue;
    }

    allowedJobs.push({
      id: job.id?.toString() ?? null,
      name: job.name,
      data,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
    });
  }

  return NextResponse.json({
    items: allowedJobs,
    count: allowedJobs.length,
  });
}
