import { PlatformType, SyncActionType } from "@prisma/client";

export type SyncJobPayload = {
  hotelId: string;
  platformConfigId: string;
  platform: PlatformType;
  action: SyncActionType;
  bookingId?: string;
  roomTypeId?: string;
  correlationId: string;
  idempotencyKey?: string;
  payload?: Record<string, unknown>;
};

export type SyncDlqJobPayload = SyncJobPayload & {
  failedJobId: string;
  failedAt: string;
  errorMessage?: string;
};
