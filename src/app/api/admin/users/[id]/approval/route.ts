import { OnboardingStatus, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { updateUserApprovalStatusByAdmin } from "@/lib/admin-users";
import { adminUserApprovalUpdateSchema } from "@/lib/contracts";
import { requireSession } from "@/lib/session";

export async function PATCH(
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

  const { id } = await context.params;
  const parsedBody = adminUserApprovalUpdateSchema.safeParse(await request.json());
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid approval update payload" }, { status: 400 });
  }

  if (
    parsedBody.data.status === OnboardingStatus.REJECTED &&
    !parsedBody.data.rejectionReason?.trim()
  ) {
    return NextResponse.json({ error: "rejectionReason is required" }, { status: 400 });
  }

  try {
    const updated = await updateUserApprovalStatusByAdmin({
      actorId: authResult.domainUser.id,
      targetUserId: id,
      status: parsedBody.data.status,
      rejectionReason: parsedBody.data.rejectionReason,
    });

    return NextResponse.json({ updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update owner approval" },
      { status: 400 },
    );
  }
}
