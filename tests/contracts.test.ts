import { describe, expect, it } from "vitest";

import { bookingCreateSchema, inventoryBulkUpdateSchema } from "../src/lib/contracts";

describe("api contracts", () => {
  it("accepts valid booking payload", () => {
    const parsed = bookingCreateSchema.safeParse({
      hotelId: "h1",
      roomTypeId: "rt1",
      bookingSource: "BOOKING_COM",
      guestName: "Riya",
      checkInDate: "2026-04-10",
      checkOutDate: "2026-04-12",
      roomsBooked: 1,
      adults: 2,
      children: 0,
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects invalid inventory patch payload", () => {
    const parsed = inventoryBulkUpdateSchema.safeParse({
      hotelId: "",
      updates: [{ roomTypeId: "rt1", date: "2026-04-10", availableRooms: -1 }],
    });

    expect(parsed.success).toBe(false);
  });
});
