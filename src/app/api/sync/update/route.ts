import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { canAccessHotel } from "@/lib/authorization";
import { syncUpdateSchema } from "@/lib/contracts";
import { withIdempotency } from "@/lib/idempotency";
import { enqueueSyncForHotel } from "@/lib/queue";
import { requireSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  const authResult = await requireSession();
  if ("error" in authResult) {
    return authResult.error;
  }

  const body = await request.json();
  const parsed = syncUpdateSchema.safeParse(body);

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
    route: "/api/sync/update",
    method: "POST",
    payload: parsed.data,
    execute: async () => {
      const correlationId = randomUUID();
      const result = await enqueueSyncForHotel({
        ...parsed.data,
        correlationId,
        idempotencyKey: request.headers.get("idempotency-key") ?? undefined,
      });

      return NextResponse.json(result);
    },
  });
}
