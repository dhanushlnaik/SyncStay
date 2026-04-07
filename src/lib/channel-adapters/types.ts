import { PlatformType, SyncActionType } from "@prisma/client";

import type { SyncJobPayload } from "@/types/jobs";

export type ChannelPushInput = SyncJobPayload;

export type ChannelSyncResult = {
  accepted: boolean;
  providerReference: string;
  operation: "inventory" | "rate" | "booking";
  platform: PlatformType;
  latencyMs: number;
  metadata?: Record<string, string | number | boolean | null>;
};

export type ChannelHealthResult = {
  ok: boolean;
  platform: PlatformType;
  latencyMs: number;
  message?: string;
};

export class ChannelAdapterError extends Error {
  code: string;
  retriable: boolean;

  constructor(message: string, options?: { code?: string; retriable?: boolean }) {
    super(message);
    this.name = "ChannelAdapterError";
    this.code = options?.code ?? "CHANNEL_ADAPTER_ERROR";
    this.retriable = options?.retriable ?? true;
  }
}

export interface ChannelAdapter {
  platform: PlatformType;
  pushInventory(input: ChannelPushInput): Promise<ChannelSyncResult>;
  pushRate(input: ChannelPushInput): Promise<ChannelSyncResult>;
  pushBooking(input: ChannelPushInput): Promise<ChannelSyncResult>;
  healthCheck(input: { hotelId: string; platformConfigId: string }): Promise<ChannelHealthResult>;
}

export function actionToOperation(action: SyncActionType) {
  if (action === SyncActionType.RATE_UPDATE) {
    return "rate";
  }
  if (action === SyncActionType.BOOKING_CREATE || action === SyncActionType.BOOKING_CANCEL) {
    return "booking";
  }
  return "inventory";
}
