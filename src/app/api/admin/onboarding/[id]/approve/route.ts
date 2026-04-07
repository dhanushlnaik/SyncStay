import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";

import { approveOwnerOnboarding } from "@/lib/onboarding";
import { requireSession } from "@/lib/session";

export async function POST(
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

  try {
    const result = await approveOwnerOnboarding({
      onboardingId: id,
      actorId: authResult.domainUser.id,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to approve onboarding" },
      { status: 400 },
    );
  }
}
