import {
  BookingSourceType,
  BookingStatus,
  HotelRegistrationStatus,
  MediaAssetType,
  MediaVisibility,
  OnboardingStatus,
  PlatformConnectionStatus,
  PlatformType,
  Prisma,
  PrismaClient,
  SyncActionType,
  SyncStatus,
  UserRole,
} from "@prisma/client";
import { addDays, startOfDay } from "date-fns";

const prisma = new PrismaClient();

const ROOM_BLUEPRINTS = [
  { name: "Deluxe King", slug: "deluxe-king", totalRooms: 12, basePrice: 6200 },
  { name: "Executive Suite", slug: "executive-suite", totalRooms: 6, basePrice: 9800 },
  { name: "Premier Twin", slug: "premier-twin", totalRooms: 10, basePrice: 5400 },
];

const MASTER_ADMIN_NAME = process.env.MASTER_ADMIN_NAME?.trim() || "SyncStay Admin";
const MASTER_ADMIN_EMAIL = process.env.MASTER_ADMIN_EMAIL?.trim() || "admin@syncstay.in";

async function main() {
  const adminAuth = await prisma.authUser.upsert({
    where: { email: MASTER_ADMIN_EMAIL },
    update: { role: "MASTER_ADMIN", isActive: true, name: MASTER_ADMIN_NAME },
    create: {
      name: MASTER_ADMIN_NAME,
      email: MASTER_ADMIN_EMAIL,
      role: "MASTER_ADMIN",
      isActive: true,
      emailVerified: true,
    },
  });

  const ownerAuth = await prisma.authUser.upsert({
    where: { email: "owner@lotushaven.in" },
    update: { role: "OWNER", isActive: true, name: "Aarav Mehta" },
    create: {
      name: "Aarav Mehta",
      email: "owner@lotushaven.in",
      role: "OWNER",
      isActive: true,
      emailVerified: true,
    },
  });

  await prisma.user.upsert({
    where: { email: MASTER_ADMIN_EMAIL },
    update: {
      name: MASTER_ADMIN_NAME,
      role: UserRole.MASTER_ADMIN,
      authUserId: adminAuth.id,
      isActive: true,
      ownerApprovalStatus: OnboardingStatus.APPROVED,
    },
    create: {
      name: MASTER_ADMIN_NAME,
      email: MASTER_ADMIN_EMAIL,
      role: UserRole.MASTER_ADMIN,
      authUserId: adminAuth.id,
      isActive: true,
      ownerApprovalStatus: OnboardingStatus.APPROVED,
    },
  });

  const owner = await prisma.user.upsert({
    where: { email: "owner@lotushaven.in" },
    update: {
      name: "Aarav Mehta",
      role: UserRole.OWNER,
      authUserId: ownerAuth.id,
      isActive: true,
      ownerApprovalStatus: OnboardingStatus.APPROVED,
    },
    create: {
      name: "Aarav Mehta",
      email: "owner@lotushaven.in",
      role: UserRole.OWNER,
      authUserId: ownerAuth.id,
      isActive: true,
      ownerApprovalStatus: OnboardingStatus.APPROVED,
    },
  });

  const hotel = await prisma.hotel.upsert({
    where: { slug: "lotus-haven-jaipur" },
    update: {
      name: "Lotus Haven Jaipur",
      ownerId: owner.id,
      city: "Jaipur",
      state: "Rajasthan",
      country: "India",
      timezone: "Asia/Kolkata",
      currency: "INR",
      email: "hello@lotushaven.in",
      phone: "+91-9988776655",
      registrationStatus: HotelRegistrationStatus.ACTIVE,
    },
    create: {
      name: "Lotus Haven Jaipur",
      slug: "lotus-haven-jaipur",
      ownerId: owner.id,
      city: "Jaipur",
      state: "Rajasthan",
      country: "India",
      timezone: "Asia/Kolkata",
      currency: "INR",
      email: "hello@lotushaven.in",
      phone: "+91-9988776655",
      checkInTime: "14:00",
      checkOutTime: "11:00",
      addressLine1: "MI Road",
      postalCode: "302001",
      registrationStatus: HotelRegistrationStatus.ACTIVE,
    },
  });

  await prisma.ownerProfile.upsert({
    where: { userId: owner.id },
    update: {
      legalBusinessName: "Lotus Haven Hospitality LLP",
      gstin: "08ABCDE1234F1Z5",
      pan: "ABCDE1234F",
      contactPhone: "+91-9988776655",
      addressLine1: "MI Road",
      city: "Jaipur",
      state: "Rajasthan",
      country: "India",
      postalCode: "302001",
    },
    create: {
      userId: owner.id,
      legalBusinessName: "Lotus Haven Hospitality LLP",
      gstin: "08ABCDE1234F1Z5",
      pan: "ABCDE1234F",
      contactPhone: "+91-9988776655",
      addressLine1: "MI Road",
      city: "Jaipur",
      state: "Rajasthan",
      country: "India",
      postalCode: "302001",
    },
  });

  await prisma.ownerOnboarding.upsert({
    where: { userId: owner.id },
    update: {
      status: OnboardingStatus.APPROVED,
      submittedAt: new Date(),
      reviewedAt: new Date(),
      reviewedById: null,
    },
    create: {
      userId: owner.id,
      status: OnboardingStatus.APPROVED,
      submittedAt: new Date(),
      reviewedAt: new Date(),
      reviewedById: null,
    },
  });

  await prisma.propertyRegistration.upsert({
    where: { hotelId: hotel.id },
    update: {
      status: OnboardingStatus.APPROVED,
      legalPropertyName: "Lotus Haven Jaipur Pvt Ltd",
      displayName: "Lotus Haven Jaipur",
      slug: "lotus-haven-jaipur",
      addressLine1: "MI Road",
      city: "Jaipur",
      state: "Rajasthan",
      country: "India",
      postalCode: "302001",
      contactEmail: "hello@lotushaven.in",
      contactPhone: "+91-9988776655",
    },
    create: {
      ownerId: owner.id,
      hotelId: hotel.id,
      status: OnboardingStatus.APPROVED,
      legalPropertyName: "Lotus Haven Jaipur Pvt Ltd",
      displayName: "Lotus Haven Jaipur",
      slug: "lotus-haven-jaipur",
      addressLine1: "MI Road",
      city: "Jaipur",
      state: "Rajasthan",
      country: "India",
      postalCode: "302001",
      contactEmail: "hello@lotushaven.in",
      contactPhone: "+91-9988776655",
    },
  });

  const seedMedia = [
    { assetType: MediaAssetType.GSTIN_DOC, visibility: MediaVisibility.PRIVATE, suffix: "gstin" },
    { assetType: MediaAssetType.PAN_DOC, visibility: MediaVisibility.PRIVATE, suffix: "pan" },
    { assetType: MediaAssetType.TRADE_LICENSE_DOC, visibility: MediaVisibility.PRIVATE, suffix: "trade-license" },
    { assetType: MediaAssetType.ADDRESS_PROOF_DOC, visibility: MediaVisibility.PRIVATE, suffix: "address-proof" },
    { assetType: MediaAssetType.PROPERTY_IMAGE, visibility: MediaVisibility.PUBLIC, suffix: "property-image" },
  ];

  for (const media of seedMedia) {
    await prisma.mediaAsset.upsert({
      where: {
        cloudinaryPublicId: `syncstay/seed/${hotel.id}/${media.suffix}`,
      },
      update: {
        ownerId: owner.id,
        hotelId: hotel.id,
        assetType: media.assetType,
        visibility: media.visibility,
      },
      create: {
        ownerId: owner.id,
        hotelId: hotel.id,
        assetType: media.assetType,
        visibility: media.visibility,
        cloudinaryPublicId: `syncstay/seed/${hotel.id}/${media.suffix}`,
        secureUrl: `https://res.cloudinary.com/demo/image/upload/v1/syncstay/seed/${hotel.id}/${media.suffix}.jpg`,
      },
    });
  }

  const roomTypes = [] as Array<{ id: string; totalRooms: number; basePrice: number }>;

  for (const room of ROOM_BLUEPRINTS) {
    const roomType = await prisma.roomType.upsert({
      where: { hotelId_slug: { hotelId: hotel.id, slug: room.slug } },
      update: {
        name: room.name,
        totalRooms: room.totalRooms,
        basePrice: new Prisma.Decimal(room.basePrice),
        isActive: true,
      },
      create: {
        hotelId: hotel.id,
        name: room.name,
        slug: room.slug,
        totalRooms: room.totalRooms,
        basePrice: new Prisma.Decimal(room.basePrice),
        baseOccupancy: 2,
        maxOccupancy: 3,
        isActive: true,
      },
    });

    roomTypes.push({
      id: roomType.id,
      totalRooms: room.totalRooms,
      basePrice: room.basePrice,
    });

    await prisma.ratePlan.upsert({
      where: {
        id: `${roomType.id}-std-plan`,
      },
      update: {
        basePrice: new Prisma.Decimal(room.basePrice),
        minStay: 1,
        isActive: true,
      },
      create: {
        id: `${roomType.id}-std-plan`,
        hotelId: hotel.id,
        roomTypeId: roomType.id,
        name: "Standard Flexible",
        code: "STD-FLEX",
        basePrice: new Prisma.Decimal(room.basePrice),
        minStay: 1,
        isRefundable: true,
      },
    });
  }

  for (const platform of Object.values(PlatformType)) {
    await prisma.hotelPlatformConfig.upsert({
      where: { hotelId_platform: { hotelId: hotel.id, platform } },
      update: {
        status: PlatformConnectionStatus.CONNECTED,
        isEnabled: true,
        endpointUrl: `https://mock.${platform.toLowerCase()}.syncstay.dev`,
        externalHotelId: `${platform}-LOTUS-001`,
      },
      create: {
        hotelId: hotel.id,
        platform,
        status: PlatformConnectionStatus.CONNECTED,
        isEnabled: true,
        endpointUrl: `https://mock.${platform.toLowerCase()}.syncstay.dev`,
        externalHotelId: `${platform}-LOTUS-001`,
      },
    });
  }

  const startDate = startOfDay(new Date());

  for (let day = 0; day < 90; day += 1) {
    const currentDate = addDays(startDate, day);

    for (const roomType of roomTypes) {
      const demandFactor = day % 7 === 5 || day % 7 === 6 ? 0.7 : 0.45;
      const soldRooms = Math.floor(roomType.totalRooms * demandFactor);
      const blockedRooms = day % 17 === 0 ? 1 : 0;
      const availableRooms = Math.max(roomType.totalRooms - soldRooms - blockedRooms, 0);

      await prisma.inventory.upsert({
        where: {
          roomTypeId_date: {
            roomTypeId: roomType.id,
            date: currentDate,
          },
        },
        update: {
          hotelId: hotel.id,
          totalRooms: roomType.totalRooms,
          soldRooms,
          blockedRooms,
          availableRooms,
          baseRate: new Prisma.Decimal(roomType.basePrice),
        },
        create: {
          hotelId: hotel.id,
          roomTypeId: roomType.id,
          date: currentDate,
          totalRooms: roomType.totalRooms,
          soldRooms,
          blockedRooms,
          availableRooms,
          baseRate: new Prisma.Decimal(roomType.basePrice),
          minStay: 1,
        },
      });
    }
  }

  const firstRoom = await prisma.roomType.findFirstOrThrow({ where: { hotelId: hotel.id } });
  const booking = await prisma.booking.create({
    data: {
      hotelId: hotel.id,
      roomTypeId: firstRoom.id,
      bookingSource: BookingSourceType.BOOKING_COM,
      externalBookingId: `SEED-${Date.now()}`,
      guestName: "Riya Kapoor",
      guestEmail: "riya.kapoor@example.com",
      checkInDate: addDays(startDate, 2),
      checkOutDate: addDays(startDate, 4),
      nights: 2,
      roomsBooked: 1,
      totalAmount: new Prisma.Decimal(12400),
      status: BookingStatus.CONFIRMED,
      createdById: owner.id,
    },
  });

  await prisma.bookingEvent.create({
    data: {
      bookingId: booking.id,
      eventType: "BOOKING_CREATED",
      message: "Seed booking for dashboard preview",
    },
  });

  const platforms = await prisma.hotelPlatformConfig.findMany({ where: { hotelId: hotel.id } });

  await prisma.syncLog.createMany({
    data: platforms.map((cfg) => ({
      hotelId: hotel.id,
      bookingId: booking.id,
      hotelPlatformConfigId: cfg.id,
      platform: cfg.platform,
      action: SyncActionType.BOOKING_CREATE,
      status: SyncStatus.SUCCESS,
      correlationId: `seed-${booking.id}`,
      requestPayload: { bookingId: booking.id, roomTypeId: firstRoom.id },
      responsePayload: { accepted: true, providerRef: `${cfg.platform}-ACK-1` },
    })),
  });

  console.log("Seed completed for SyncStay demo dataset.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
