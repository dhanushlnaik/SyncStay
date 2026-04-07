import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { canAccessHotel, canMutateInventory } from "@/lib/authorization";
import { inventoryBulkUpdateSchema } from "@/lib/contracts";
import { withIdempotency } from "@/lib/idempotency";
import { applyInventoryBulkUpdate } from "@/lib/inventory-service";
import { requireSession } from "@/lib/session";

export async function PATCH(request: NextRequest) {
  const authResult = await requireSession();
  if ("error" in authResult) {
    return authResult.error;
  }

  if (!canMutateInventory(authResult.domainUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = inventoryBulkUpdateSchema.safeParse(body);

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
    route: "/api/inventory/bulk",
    method: "PATCH",
    payload: parsed.data,
    execute: async () => {
      const correlationId = randomUUID();
      const result = await applyInventoryBulkUpdate({
        hotelId: parsed.data.hotelId,
        actorRole: authResult.domainUser.role,
        correlationId,
        idempotencyKey: request.headers.get("idempotency-key") ?? undefined,
        updates: parsed.data.updates,
      });

      return NextResponse.json(result);
    },
  });
}
