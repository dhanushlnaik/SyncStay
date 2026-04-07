import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { adminDecisionSchema } from "@/lib/contracts";
import { rejectOwnerOnboarding } from "@/lib/onboarding";
import { requireSession } from "@/lib/session";

export async function POST(
  request: NextRequest,
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

  const body = await request.json();
  const parsedBody = adminDecisionSchema.safeParse(body);
  if (!parsedBody.success || !parsedBody.data.rejectionReason) {
    return NextResponse.json({ error: "rejectionReason is required" }, { status: 400 });
  }

  const { id } = await context.params;

  try {
    const result = await rejectOwnerOnboarding({
      onboardingId: id,
      actorId: authResult.domainUser.id,
      rejectionReason: parsedBody.data.rejectionReason,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to reject onboarding" },
      { status: 400 },
    );
  }
}
