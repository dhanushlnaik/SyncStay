import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";

import { getOnboardingReviewDetails } from "@/lib/onboarding";
import { requireSession } from "@/lib/session";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  const authResult = await requireSession();
  if ("error" in authResult) {
    return authResult.error;
  }

  if (authResult.domainUser.role !== UserRole.MASTER_ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const details = await getOnboardingReviewDetails(id);

  if (!details) {
    return NextResponse.json({ error: "Onboarding record not found" }, { status: 404 });
  }

  return NextResponse.json(details);
}
