import { NextResponse } from "next/server";

import { getOnboardingStatus } from "@/lib/onboarding";
import { requireSession } from "@/lib/session";

export async function GET() {
  const authResult = await requireSession({
    allowUnapproved: true,
  });

  if ("error" in authResult) {
    return authResult.error;
  }

  const status = await getOnboardingStatus(authResult.domainUser.id);

  return NextResponse.json({
    userId: authResult.domainUser.id,
    approvalStatus: authResult.domainUser.ownerApprovalStatus,
    ...status,
  });
}
