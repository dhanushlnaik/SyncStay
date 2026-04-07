import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { updateUserRoleByAdmin } from "@/lib/admin-users";
import { adminUserRoleUpdateSchema } from "@/lib/contracts";
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
  const parsedBody = adminUserRoleUpdateSchema.safeParse(await request.json());
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid role update payload" }, { status: 400 });
  }

  try {
    const updated = await updateUserRoleByAdmin({
      actorId: authResult.domainUser.id,
      targetUserId: id,
      role: parsedBody.data.role,
      isActive: parsedBody.data.isActive,
    });

    return NextResponse.json({ updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update role" },
      { status: 400 },
    );
  }
}
