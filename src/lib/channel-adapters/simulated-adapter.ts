import { PlatformType } from "@prisma/client";

import {
  ChannelAdapter,
  ChannelAdapterError,
  ChannelHealthResult,
  ChannelPushInput,
  ChannelSyncResult,
} from "@/lib/channel-adapters/types";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomLatency() {
  return Math.floor(280 + Math.random() * 1200);
}

function randomFailure() {
  return Math.random() <= 0.15;
}

function extractForcedFailureFlag(input: ChannelPushInput) {
  if (!input.payload || typeof input.payload !== "object") {
    return false;
  }

  const marker = (input.payload as { simulateFailure?: unknown }).simulateFailure;
  return marker === true;
}

function extractNonRetriableFlag(input: ChannelPushInput) {
  if (!input.payload || typeof input.payload !== "object") {
    return false;
  }

  const marker = (input.payload as { nonRetriable?: unknown }).nonRetriable;
  return marker === true;
}

export class SimulatedChannelAdapter implements ChannelAdapter {
  platform: PlatformType;

  constructor(platform: PlatformType) {
    this.platform = platform;
  }

  private async perform(
    input: ChannelPushInput,
    operation: ChannelSyncResult["operation"],
  ): Promise<ChannelSyncResult> {
    const latencyMs = randomLatency();
    await sleep(latencyMs);

    if (extractForcedFailureFlag(input) || randomFailure()) {
      throw new ChannelAdapterError(`Simulated ${this.platform} ${operation} sync failure`, {
        code: extractNonRetriableFlag(input) ? "PERMANENT_CHANNEL_ERROR" : "TRANSIENT_CHANNEL_ERROR",
        retriable: !extractNonRetriableFlag(input),
      });
    }

    return {
      accepted: true,
      providerReference: `${this.platform}-${operation.toUpperCase()}-ACK-${Date.now()}`,
      operation,
      platform: this.platform,
      latencyMs,
      metadata: {
        simulated: true,
        action: input.action,
        correlationId: input.correlationId,
      },
    };
  }

  async pushInventory(input: ChannelPushInput) {
    return this.perform(input, "inventory");
  }

  async pushRate(input: ChannelPushInput) {
    return this.perform(input, "rate");
  }

  async pushBooking(input: ChannelPushInput) {
    return this.perform(input, "booking");
  }

  async healthCheck(): Promise<ChannelHealthResult> {
    const latencyMs = Math.floor(80 + Math.random() * 340);
    await sleep(latencyMs);

    const ok = Math.random() > 0.05;

    return {
      ok,
      platform: this.platform,
      latencyMs,
      message: ok ? "Simulated channel is reachable" : "Simulated channel is temporarily unavailable",
    };
  }
}
