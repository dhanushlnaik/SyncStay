import { NextRequest, NextResponse } from "next/server";

import { canAccessHotel } from "@/lib/authorization";
import { reconcileTriggerSchema } from "@/lib/contracts";
import { runReconciliation } from "@/lib/reconciliation";
import { requireSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  const authResult = await requireSession();
  if ("error" in authResult) {
    return authResult.error;
  }

  const body = await request.json();
  const parsed = reconcileTriggerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const access = await canAccessHotel(authResult.domainUser, parsed.data.hotelId);
  if (!access) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const run = await runReconciliation({
    hotelId: parsed.data.hotelId,
    triggeredById: authResult.domainUser.id,
  });

  return NextResponse.json(run, { status: 201 });
}
