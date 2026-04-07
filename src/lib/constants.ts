import { BookingSourceType, PlatformType, UserRole } from "@prisma/client";

export const APP_NAME = "SyncStay";

export const PLATFORM_LABELS: Record<PlatformType, string> = {
  MAKEMYTRIP: "MakeMyTrip",
  AGODA: "Agoda",
  GOIBIBO: "Goibibo",
  AIRBNB: "Airbnb",
  BOOKING_COM: "Booking.com",
  EXPEDIA: "Expedia",
  CLEARTRIP: "Cleartrip",
};

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  MASTER_ADMIN: "Master Admin",
  OWNER: "Hotel Owner",
  STAFF: "Staff",
};

export const BOOKING_SOURCE_TO_PLATFORM: Partial<Record<BookingSourceType, PlatformType>> = {
  MAKEMYTRIP: PlatformType.MAKEMYTRIP,
  AGODA: PlatformType.AGODA,
  GOIBIBO: PlatformType.GOIBIBO,
  AIRBNB: PlatformType.AIRBNB,
  BOOKING_COM: PlatformType.BOOKING_COM,
  EXPEDIA: PlatformType.EXPEDIA,
  CLEARTRIP: PlatformType.CLEARTRIP,
};
