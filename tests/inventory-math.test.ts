import { describe, expect, it } from "vitest";

import {
  findBlockingInventoryDay,
  projectInventoryAfterBooking,
} from "../src/lib/inventory-math";

describe("inventory math", () => {
  it("finds the first blocking day when availability is insufficient", () => {
    const result = findBlockingInventoryDay(
      [
        { date: new Date("2026-04-10"), availableRooms: 3 },
        { date: new Date("2026-04-11"), availableRooms: 1 },
      ],
      2,
    );

    expect(result?.date.toISOString().slice(0, 10)).toBe("2026-04-11");
  });

  it("returns null when all dates can satisfy the request", () => {
    const result = findBlockingInventoryDay(
      [
        { date: new Date("2026-04-10"), availableRooms: 4 },
        { date: new Date("2026-04-11"), availableRooms: 2 },
      ],
      2,
    );

    expect(result).toBeNull();
  });

  it("projects inventory after booking across all dates", () => {
    const projected = projectInventoryAfterBooking(
      [
        { date: new Date("2026-04-10"), availableRooms: 4 },
        { date: new Date("2026-04-11"), availableRooms: 3 },
      ],
      2,
    );

    expect(projected.map((row) => row.availableRooms)).toEqual([2, 1]);
  });
});
