export type InventorySnapshot = {
  date: Date;
  availableRooms: number;
};

export function findBlockingInventoryDay(
  inventory: InventorySnapshot[],
  requestedRooms: number,
): InventorySnapshot | null {
  if (requestedRooms <= 0) {
    return null;
  }

  return inventory.find((row) => row.availableRooms < requestedRooms) ?? null;
}

export function projectInventoryAfterBooking(
  inventory: InventorySnapshot[],
  requestedRooms: number,
): InventorySnapshot[] {
  return inventory.map((row) => ({
    ...row,
    availableRooms: row.availableRooms - requestedRooms,
  }));
}
