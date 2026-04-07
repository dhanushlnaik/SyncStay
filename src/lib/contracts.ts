import {
  BookingSourceType,
  MediaAssetType,
  NotificationType,
  OnboardingStatus,
  PlatformType,
  SyncActionType,
  UserRole,
} from "@prisma/client";
import { z } from "zod";

const optionalEmailSchema = z.preprocess((value) => {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }
  return value;
}, z.string().email().optional());

export const inventoryBulkUpdateSchema = z.object({
  hotelId: z.string().min(1),
  updates: z.array(
    z.object({
      roomTypeId: z.string().min(1),
      date: z.coerce.date(),
      availableRooms: z.number().int().min(0).optional(),
      totalRooms: z.number().int().min(1).optional(),
      baseRate: z.number().positive().optional(),
      minStay: z.number().int().min(1).optional(),
      maxStay: z.number().int().min(1).nullable().optional(),
      stopSell: z.boolean().optional(),
    }),
  ),
});

export const bookingCreateSchema = z.object({
  hotelId: z.string().min(1),
  roomTypeId: z.string().min(1),
  platformConfigId: z.string().optional(),
  externalBookingId: z.string().optional(),
  bookingSource: z.nativeEnum(BookingSourceType),
  guestName: z.string().min(1),
  guestEmail: z.string().email().optional(),
  guestPhone: z.string().optional(),
  checkInDate: z.coerce.date(),
  checkOutDate: z.coerce.date(),
  roomsBooked: z.number().int().min(1).default(1),
  adults: z.number().int().min(1).default(2),
  children: z.number().int().min(0).default(0),
  totalAmount: z.number().positive().optional(),
});

export const syncUpdateSchema = z.object({
  hotelId: z.string().min(1),
  action: z.nativeEnum(SyncActionType),
  bookingId: z.string().optional(),
  roomTypeId: z.string().optional(),
  platformIds: z.array(z.string()).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export const channelUpdateSchema = z.object({
  isEnabled: z.boolean().optional(),
  status: z.enum(["CONNECTED", "DISCONNECTED", "ERROR", "PENDING"]).optional(),
  endpointUrl: z.string().url().nullable().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export const simulationBookingSchema = bookingCreateSchema.extend({
  autoSync: z.boolean().default(true),
});

export const streamEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("booking.created"),
    payload: z.record(z.string(), z.unknown()),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("inventory.updated"),
    payload: z.record(z.string(), z.unknown()),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("sync.log.created"),
    payload: z.record(z.string(), z.unknown()),
    timestamp: z.string(),
  }),
  z.object({
    type: z.literal("sync.job.status"),
    payload: z.record(z.string(), z.unknown()),
    timestamp: z.string(),
  }),
]);

export const channelPathSchema = z.object({
  id: z.string().min(1),
});

export const platformSchema = z.nativeEnum(PlatformType);

export const ownerOnboardingSchema = z.object({
  legalBusinessName: z.string().min(2),
  gstin: z.string().min(8),
  pan: z.string().min(6),
  contactPhone: z.string().min(8),
  addressLine1: z.string().min(3),
  addressLine2: z.string().optional(),
  city: z.string().min(2),
  state: z.string().min(2),
  country: z.string().min(2).default("India"),
  postalCode: z.string().min(4),
  kycAssetIds: z.array(z.string().min(1)).optional(),
});

export const propertyOnboardingSchema = z.object({
  hotelId: z.string().min(1).optional(),
  legalPropertyName: z.string().min(2),
  displayName: z.string().min(2),
  description: z.string().optional(),
  addressLine1: z.string().min(3),
  addressLine2: z.string().optional(),
  city: z.string().min(2),
  state: z.string().min(2),
  country: z.string().min(2).default("India"),
  postalCode: z.string().min(4),
  contactEmail: optionalEmailSchema,
  contactPhone: z.string().optional(),
  mediaAssetIds: z.array(z.string().min(1)).optional(),
});

export const onboardingSubmitSchema = z.object({
  confirmSubmission: z.boolean().default(true),
});

export const uploadSignSchema = z.object({
  assetType: z.nativeEnum(MediaAssetType),
  hotelId: z.string().min(1).optional(),
  ownerId: z.string().min(1).optional(),
  mimeType: z.string().min(3),
  bytes: z.number().int().positive(),
});

export const uploadCommitSchema = z.object({
  assetType: z.nativeEnum(MediaAssetType),
  ownerId: z.string().min(1).optional(),
  hotelId: z.string().min(1).optional(),
  propertyRegistrationId: z.string().min(1).optional(),
  cloudinaryPublicId: z.string().min(1),
  secureUrl: z.string().url(),
  version: z.number().int().optional(),
  bytes: z.number().int().positive().optional(),
  mimeType: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const adminDecisionSchema = z.object({
  rejectionReason: z.string().min(5).optional(),
});

export const adminUserRoleUpdateSchema = z.object({
  role: z.nativeEnum(UserRole),
  isActive: z.boolean().optional(),
});

export const adminUserApprovalUpdateSchema = z.object({
  status: z.nativeEnum(OnboardingStatus),
  rejectionReason: z.string().min(5).optional(),
});

export const reconcileTriggerSchema = z.object({
  hotelId: z.string().min(1),
});

export const notificationQuerySchema = z.object({
  type: z.nativeEnum(NotificationType).optional(),
  unreadOnly: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((value) => value === "true"),
});

export const replayRequestSchema = z.object({
  notes: z.string().optional(),
});

export const onboardingStatusSchema = z.nativeEnum(OnboardingStatus);
