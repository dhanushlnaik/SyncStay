import { BookingSourceType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { canAccessHotel } from "@/lib/authorization";
import { simulationBookingSchema } from "@/lib/contracts";
import { createBookingWithConflictHandling } from "@/lib/inventory-service";
import { requireSession } from "@/lib/session";

const sources = Object.values(BookingSourceType).filter((source) => source !== BookingSourceType.INTERNAL);

export async function POST(request: NextRequest) {
  const authResult = await requireSession();
  if ("error" in authResult) {
    return authResult.error;
  }

  const body = await request.json();
  const parsed = simulationBookingSchema.safeParse({
    ...body,
    bookingSource: body.bookingSource ?? sources[Math.floor(Math.random() * sources.length)],
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const access = await canAccessHotel(authResult.domainUser, parsed.data.hotelId);
  if (!access) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await createBookingWithConflictHandling({
    ...parsed.data,
    createdById: authResult.domainUser.id,
  });

  return NextResponse.json(
    {
      mode: "simulation",
      ...result,
    },
    { status: result.accepted ? 201 : 409 },
  );
}
