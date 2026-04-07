import { NextRequest, NextResponse } from "next/server";

import { notificationQuerySchema } from "@/lib/contracts";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const authResult = await requireSession({
    allowUnapproved: true,
  });
  if ("error" in authResult) {
    return authResult.error;
  }

  const parsed = notificationQuerySchema.safeParse({
    type: request.nextUrl.searchParams.get("type") ?? undefined,
    unreadOnly: request.nextUrl.searchParams.get("unreadOnly") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const notifications = await prisma.notification.findMany({
    where: {
      userId: authResult.domainUser.id,
      ...(parsed.data.type ? { type: parsed.data.type } : {}),
      ...(parsed.data.unreadOnly ? { readAt: null } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ items: notifications });
}
