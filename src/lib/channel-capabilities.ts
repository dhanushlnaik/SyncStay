import { PlatformType, SyncActionType } from "@prisma/client";

type ChannelCapability = {
  inventory: boolean;
  rate: boolean;
  booking: boolean;
  fullSync: boolean;
};

export const CHANNEL_CAPABILITIES: Record<PlatformType, ChannelCapability> = {
  MAKEMYTRIP: { inventory: true, rate: true, booking: true, fullSync: true },
  AGODA: { inventory: true, rate: true, booking: true, fullSync: true },
  GOIBIBO: { inventory: true, rate: true, booking: true, fullSync: true },
  AIRBNB: { inventory: true, rate: false, booking: true, fullSync: true },
  BOOKING_COM: { inventory: true, rate: true, booking: true, fullSync: true },
  EXPEDIA: { inventory: true, rate: true, booking: true, fullSync: true },
  CLEARTRIP: { inventory: true, rate: false, booking: true, fullSync: true },
};

function actionCategory(action: SyncActionType): keyof ChannelCapability {
  if (action === SyncActionType.RATE_UPDATE) {
    return "rate";
  }
  if (action === SyncActionType.BOOKING_CREATE || action === SyncActionType.BOOKING_CANCEL) {
    return "booking";
  }
  if (action === SyncActionType.FULL_SYNC) {
    return "fullSync";
  }
  return "inventory";
}

function hasValue(input: unknown) {
  if (input === null || input === undefined) {
    return false;
  }
  if (typeof input === "string") {
    return input.trim().length > 0;
  }
  if (Array.isArray(input)) {
    return input.length > 0;
  }
  return true;
}

export function supportsSyncAction(platform: PlatformType, action: SyncActionType) {
  const capability = CHANNEL_CAPABILITIES[platform];
  return capability[actionCategory(action)];
}

type SyncValidationInput = {
  platform: PlatformType;
  action: SyncActionType;
  bookingId?: string;
  roomTypeId?: string;
  payload?: Record<string, unknown>;
};

export function validateSyncPayloadForPlatform(input: SyncValidationInput) {
  const errors: string[] = [];

  if (!supportsSyncAction(input.platform, input.action)) {
    errors.push(`Action ${input.action} is not supported on ${input.platform}`);
    return {
      ok: false,
      errors,
    };
  }

  const payload = input.payload ?? {};
  const bookingId = input.bookingId ?? (payload.bookingId as string | undefined);
  const roomTypeId = input.roomTypeId ?? (payload.roomTypeId as string | undefined);

  if (input.action === SyncActionType.BOOKING_CREATE || input.action === SyncActionType.BOOKING_CANCEL) {
    if (!hasValue(bookingId)) {
      errors.push("bookingId is required for booking sync actions");
    }
  }

  if (input.action === SyncActionType.INVENTORY_UPDATE) {
    if (!Array.isArray(payload.updates) || payload.updates.length === 0) {
      errors.push("payload.updates must be a non-empty array for INVENTORY_UPDATE");
    }
  }

  if (input.action === SyncActionType.RATE_UPDATE) {
    const hasRates = Array.isArray(payload.rates) && payload.rates.length > 0;
    const hasRatePlanId = hasValue(payload.ratePlanId);
    if (!hasRates && !hasRatePlanId) {
      errors.push("payload.rates or payload.ratePlanId is required for RATE_UPDATE");
    }
  }

  if (input.action === SyncActionType.ROOM_TYPE_UPDATE && !hasValue(roomTypeId)) {
    errors.push("roomTypeId is required for ROOM_TYPE_UPDATE");
  }

  if (input.action === SyncActionType.RESTRICTION_UPDATE && !hasValue(roomTypeId)) {
    errors.push("roomTypeId is required for RESTRICTION_UPDATE");
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function getPlatformCapabilityLabels(platform: PlatformType) {
  const capability = CHANNEL_CAPABILITIES[platform];
  const labels = [];

  if (capability.inventory) labels.push("Inventory");
  if (capability.rate) labels.push("Rate");
  if (capability.booking) labels.push("Booking");
  if (capability.fullSync) labels.push("Full Sync");

  return labels;
}
