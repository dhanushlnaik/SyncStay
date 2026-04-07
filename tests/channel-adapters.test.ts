import { PlatformType, SyncActionType } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  dispatchSyncActionToAdapter,
  getChannelAdapter,
} from "@/lib/channel-adapters";
import { SimulatedChannelAdapter } from "@/lib/channel-adapters/simulated-adapter";
import { ChannelAdapterError } from "@/lib/channel-adapters/types";
import type { SyncJobPayload } from "@/types/jobs";

function buildPayload(input: Partial<SyncJobPayload> = {}): SyncJobPayload {
  return {
    hotelId: "hotel_1",
    platformConfigId: "platform_cfg_1",
    platform: PlatformType.BOOKING_COM,
    action: SyncActionType.INVENTORY_UPDATE,
    correlationId: "corr_123",
    payload: {},
    ...input,
  };
}

function mockRandomForSuccessFlow() {
  let count = 0;
  return vi.spyOn(Math, "random").mockImplementation(() => {
    count += 1;
    return count % 2 === 1 ? 0.01 : 0.99;
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("channel adapter contracts", () => {
  it("returns registered adapter for each OTA platform", () => {
    for (const platform of Object.values(PlatformType)) {
      const adapter = getChannelAdapter(platform);
      expect(adapter).toBeDefined();
      expect(adapter.platform).toBe(platform);
    }
  });

  it("dispatches sync actions to the expected adapter operation", async () => {
    const adapter = {
      platform: PlatformType.EXPEDIA,
      pushInventory: vi.fn().mockResolvedValue({
        accepted: true,
        providerReference: "inventory-ack",
        operation: "inventory",
        platform: PlatformType.EXPEDIA,
        latencyMs: 1,
      }),
      pushRate: vi.fn().mockResolvedValue({
        accepted: true,
        providerReference: "rate-ack",
        operation: "rate",
        platform: PlatformType.EXPEDIA,
        latencyMs: 1,
      }),
      pushBooking: vi.fn().mockResolvedValue({
        accepted: true,
        providerReference: "booking-ack",
        operation: "booking",
        platform: PlatformType.EXPEDIA,
        latencyMs: 1,
      }),
      healthCheck: vi.fn(),
    };

    await dispatchSyncActionToAdapter(
      adapter,
      buildPayload({ action: SyncActionType.RATE_UPDATE, platform: PlatformType.EXPEDIA }),
    );
    expect(adapter.pushRate).toHaveBeenCalledTimes(1);

    await dispatchSyncActionToAdapter(
      adapter,
      buildPayload({
        action: SyncActionType.BOOKING_CREATE,
        platform: PlatformType.EXPEDIA,
        bookingId: "booking_1",
      }),
    );
    expect(adapter.pushBooking).toHaveBeenCalledTimes(1);

    await dispatchSyncActionToAdapter(
      adapter,
      buildPayload({ action: SyncActionType.FULL_SYNC, platform: PlatformType.EXPEDIA }),
    );
    expect(adapter.pushInventory).toHaveBeenCalledTimes(1);
  });

  it("succeeds for each platform in simulated adapter success path", async () => {
    mockRandomForSuccessFlow();

    for (const platform of Object.values(PlatformType)) {
      const adapter = new SimulatedChannelAdapter(platform);
      const result = await adapter.pushInventory(
        buildPayload({
          platform,
          action: SyncActionType.INVENTORY_UPDATE,
          payload: {
            updates: [{ roomTypeId: "rt1", date: "2026-04-08", availableRooms: 6 }],
          },
        }),
      );

      expect(result.accepted).toBe(true);
      expect(result.platform).toBe(platform);
      expect(result.operation).toBe("inventory");
      expect(result.providerReference).toContain(platform);
      expect(result.latencyMs).toBeGreaterThan(0);
    }
  });

  it("returns transient retriable error for forced simulated failure", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.01);
    const adapter = new SimulatedChannelAdapter(PlatformType.AIRBNB);

    await expect(
      adapter.pushBooking(
        buildPayload({
          platform: PlatformType.AIRBNB,
          action: SyncActionType.BOOKING_CREATE,
          bookingId: "booking_2",
          payload: { bookingId: "booking_2", simulateFailure: true },
        }),
      ),
    ).rejects.toMatchObject({
      name: "ChannelAdapterError",
      code: "TRANSIENT_CHANNEL_ERROR",
      retriable: true,
    } satisfies Partial<ChannelAdapterError>);
  });

  it("returns permanent non-retriable error when nonRetriable flag is set", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.01);
    const adapter = new SimulatedChannelAdapter(PlatformType.CLEARTRIP);

    await expect(
      adapter.pushRate(
        buildPayload({
          platform: PlatformType.CLEARTRIP,
          action: SyncActionType.RATE_UPDATE,
          payload: { ratePlanId: "rp_1", simulateFailure: true, nonRetriable: true },
        }),
      ),
    ).rejects.toMatchObject({
      name: "ChannelAdapterError",
      code: "PERMANENT_CHANNEL_ERROR",
      retriable: false,
    } satisfies Partial<ChannelAdapterError>);
  });

  it("fails health checks gracefully with valid contract shape", async () => {
    let count = 0;
    vi.spyOn(Math, "random").mockImplementation(() => {
      count += 1;
      return count % 2 === 1 ? 0.01 : 0.01;
    });
    const adapter = new SimulatedChannelAdapter(PlatformType.MAKEMYTRIP);

    const health = await adapter.healthCheck({
      hotelId: "hotel_1",
      platformConfigId: "cfg_1",
    });

    expect(health.platform).toBe(PlatformType.MAKEMYTRIP);
    expect(typeof health.ok).toBe("boolean");
    expect(health.ok).toBe(false);
    expect(health.latencyMs).toBeGreaterThan(0);
    expect(health.message).toBeTruthy();
  });
});
