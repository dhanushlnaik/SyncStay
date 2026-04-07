import { PlatformType, SyncActionType } from "@prisma/client";

import { SimulatedChannelAdapter } from "@/lib/channel-adapters/simulated-adapter";
import { ChannelAdapter, ChannelPushInput, ChannelSyncResult } from "@/lib/channel-adapters/types";

const adapterByPlatform: Record<PlatformType, ChannelAdapter> = {
  MAKEMYTRIP: new SimulatedChannelAdapter(PlatformType.MAKEMYTRIP),
  AGODA: new SimulatedChannelAdapter(PlatformType.AGODA),
  GOIBIBO: new SimulatedChannelAdapter(PlatformType.GOIBIBO),
  AIRBNB: new SimulatedChannelAdapter(PlatformType.AIRBNB),
  BOOKING_COM: new SimulatedChannelAdapter(PlatformType.BOOKING_COM),
  EXPEDIA: new SimulatedChannelAdapter(PlatformType.EXPEDIA),
  CLEARTRIP: new SimulatedChannelAdapter(PlatformType.CLEARTRIP),
};

export function getChannelAdapter(platform: PlatformType) {
  return adapterByPlatform[platform];
}

export async function dispatchSyncActionToAdapter(
  adapter: ChannelAdapter,
  input: ChannelPushInput,
): Promise<ChannelSyncResult> {
  if (input.action === SyncActionType.RATE_UPDATE) {
    return adapter.pushRate(input);
  }

  if (input.action === SyncActionType.BOOKING_CREATE || input.action === SyncActionType.BOOKING_CANCEL) {
    return adapter.pushBooking(input);
  }

  return adapter.pushInventory(input);
}
