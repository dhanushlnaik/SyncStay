import { SyncActionType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { canAccessHotel } from "@/lib/authorization";
import { withIdempotency } from "@/lib/idempotency";
import { enqueueSyncForHotel } from "@/lib/queue";
import { requireSession } from "@/lib/session";

const schema = z.object({
  hotelId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const authResult = await requireSession();
  if ("error" in authResult) {
    return authResult.error;
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const access = await canAccessHotel(authResult.domainUser, parsed.data.hotelId);
  if (!access) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return withIdempotency({
    request,
    userId: authResult.domainUser.id,
    route: "/api/sync/full",
    method: "POST",
    payload: parsed.data,
    execute: async () => {
      const correlationId = randomUUID();
      const result = await enqueueSyncForHotel({
        hotelId: parsed.data.hotelId,
        action: SyncActionType.FULL_SYNC,
        correlationId,
        idempotencyKey: request.headers.get("idempotency-key") ?? undefined,
        payload: {
          trigger: "manual_full_sync",
        },
      });

      return NextResponse.json(result);
    },
  });
}
