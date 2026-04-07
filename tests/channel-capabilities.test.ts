import { PlatformType, SyncActionType } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  getPlatformCapabilityLabels,
  supportsSyncAction,
  validateSyncPayloadForPlatform,
} from "@/lib/channel-capabilities";

describe("channel capabilities", () => {
  it("returns labels for channel capabilities", () => {
    const labels = getPlatformCapabilityLabels(PlatformType.BOOKING_COM);
    expect(labels).toContain("Inventory");
    expect(labels).toContain("Rate");
    expect(labels).toContain("Booking");
  });

  it("enforces unsupported action by platform", () => {
    expect(supportsSyncAction(PlatformType.AIRBNB, SyncActionType.RATE_UPDATE)).toBe(false);
  });

  it("validates required booking payload fields", () => {
    const invalid = validateSyncPayloadForPlatform({
      platform: PlatformType.BOOKING_COM,
      action: SyncActionType.BOOKING_CREATE,
      payload: {},
    });
    expect(invalid.ok).toBe(false);
    expect(invalid.errors[0]).toContain("bookingId");

    const valid = validateSyncPayloadForPlatform({
      platform: PlatformType.BOOKING_COM,
      action: SyncActionType.BOOKING_CREATE,
      payload: { bookingId: "b_123" },
    });
    expect(valid.ok).toBe(true);
  });

  it("validates required inventory updates payload", () => {
    const invalid = validateSyncPayloadForPlatform({
      platform: PlatformType.EXPEDIA,
      action: SyncActionType.INVENTORY_UPDATE,
      payload: {},
    });
    expect(invalid.ok).toBe(false);

    const valid = validateSyncPayloadForPlatform({
      platform: PlatformType.EXPEDIA,
      action: SyncActionType.INVENTORY_UPDATE,
      payload: { updates: [{ roomTypeId: "rt_1", date: "2026-04-08", availableRooms: 7 }] },
    });
    expect(valid.ok).toBe(true);
  });
});
