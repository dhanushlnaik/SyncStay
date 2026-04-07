import { NextRequest, NextResponse } from "next/server";

import { canAccessHotel } from "@/lib/authorization";
import { getInventoryMatrix, getUserScopedHotel } from "@/lib/queries";
import { requireSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const authResult = await requireSession();
  if ("error" in authResult) {
    return authResult.error;
  }

  const hotelIdQuery = request.nextUrl.searchParams.get("hotelId");
  const days = Number(request.nextUrl.searchParams.get("days") ?? 14);

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

  const items = await getInventoryMatrix(hotelId, days);
  return NextResponse.json({ hotelId, days, items });
}
