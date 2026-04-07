import { NextRequest, NextResponse } from "next/server";

import { canAccessHotel } from "@/lib/authorization";
import { getUserScopedHotel } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const authResult = await requireSession();
  if ("error" in authResult) {
    return authResult.error;
  }

  const hotelIdQuery = request.nextUrl.searchParams.get("hotelId");
  const days = Number(request.nextUrl.searchParams.get("days") ?? 30);

  let hotelId = hotelIdQuery;

  if (!hotelId) {
    const scopedHotel = await getUserScopedHotel(authResult.domainUser.id);
    if (!scopedHotel) {
      return NextResponse.json({ error: "No hotel assigned" }, { status: 404 });
    }
    hotelId = scopedHotel.id;
  }

  const access = await canAccessHotel(authResult.domainUser, hotelId);
  if (!access) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const start = new Date();
  const end = new Date(start);
  end.setDate(end.getDate() + days);

  const inventory = await prisma.inventory.findMany({
    where: {
      hotelId,
      date: {
        gte: start,
        lt: end,
      },
    },
    include: {
      roomType: true,
    },
    orderBy: [{ date: "asc" }, { roomType: { name: "asc" } }],
  });

  return NextResponse.json({ hotelId, items: inventory });
}
