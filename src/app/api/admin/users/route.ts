import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { getAdminUsersOverview } from "@/lib/admin-users";
import { requireSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const authResult = await requireSession();
  if ("error" in authResult) {
    return authResult.error;
  }

  if (authResult.domainUser.role !== UserRole.MASTER_ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const query = request.nextUrl.searchParams.get("q") ?? undefined;
  const result = await getAdminUsersOverview(query);
  return NextResponse.json(result);
}
