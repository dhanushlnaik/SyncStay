import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";

import { getOnboardingQueue } from "@/lib/onboarding";
import { requireSession } from "@/lib/session";

export async function GET() {
  const authResult = await requireSession();
  if ("error" in authResult) {
    return authResult.error;
  }

  if (authResult.domainUser.role !== UserRole.MASTER_ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const queue = await getOnboardingQueue();
  return NextResponse.json({ items: queue });
}
