import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { canAccessHotel } from "@/lib/authorization";
import { bookingCreateSchema } from "@/lib/contracts";
import { withIdempotency } from "@/lib/idempotency";
import { createBookingWithConflictHandling } from "@/lib/inventory-service";
import { getRecentBookings, getUserScopedHotel } from "@/lib/queries";
import { requireSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const authResult = await requireSession();
  if ("error" in authResult) {
    return authResult.error;
  }

  const hotelIdQuery = request.nextUrl.searchParams.get("hotelId");
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

  const bookings = await getRecentBookings(hotelId, 100);

  return NextResponse.json({ hotelId, items: bookings });
}

export async function POST(request: NextRequest) {
  const authResult = await requireSession();
  if ("error" in authResult) {
    return authResult.error;
  }

  const body = await request.json();
  const parsed = bookingCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const access = await canAccessHotel(authResult.domainUser, parsed.data.hotelId);
  if (!access) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return withIdempotency({
    request,
    userId: authResult.domainUser.id,
    route: "/api/bookings",
    method: "POST",
    payload: parsed.data,
    execute: async () => {
      const correlationId = randomUUID();
      const result = await createBookingWithConflictHandling({
        ...parsed.data,
        createdById: authResult.domainUser.id,
        correlationId,
        idempotencyKey: request.headers.get("idempotency-key") ?? undefined,
      });

      return NextResponse.json(result, { status: result.accepted ? 201 : 409 });
    },
  });
}
