import {
  HotelRegistrationStatus,
  MediaAssetType,
  NotificationType,
  OnboardingStatus,
  Prisma,
  UserRole,
} from "@prisma/client";

import { createUserNotification, notifyAdmins } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

const REQUIRED_KYC_ASSET_TYPES: MediaAssetType[] = [
  MediaAssetType.GSTIN_DOC,
  MediaAssetType.PAN_DOC,
  MediaAssetType.TRADE_LICENSE_DOC,
  MediaAssetType.ADDRESS_PROOF_DOC,
];

function toSlug(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 64);
}

async function uniqueHotelSlug(base: string) {
  const cleanBase = toSlug(base) || "property";
  let candidate = cleanBase;
  let suffix = 1;

  while (await prisma.hotel.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    suffix += 1;
    candidate = `${cleanBase}-${suffix}`;
  }

  return candidate;
}

async function uniquePropertySlug(base: string) {
  const cleanBase = toSlug(base) || "property";
  let candidate = cleanBase;
  let suffix = 1;

  while (
    await prisma.propertyRegistration.findUnique({ where: { slug: candidate }, select: { id: true } })
  ) {
    suffix += 1;
    candidate = `${cleanBase}-${suffix}`;
  }

  return candidate;
}

export async function getOnboardingStatus(userId: string) {
  const [ownerProfile, ownerOnboarding, properties, mediaAssets] = await Promise.all([
    prisma.ownerProfile.findUnique({
      where: { userId },
    }),
    prisma.ownerOnboarding.findUnique({
      where: { userId },
      include: {
        reviewedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    }),
    prisma.propertyRegistration.findMany({
      where: { ownerId: userId },
      include: {
        hotel: true,
        mediaAssets: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.mediaAsset.findMany({
      where: {
        ownerId: userId,
        assetType: {
          in: REQUIRED_KYC_ASSET_TYPES,
        },
      },
    }),
  ]);

  const kycSet = new Set(mediaAssets.map((item) => item.assetType));
  const missingKycAssets = REQUIRED_KYC_ASSET_TYPES.filter((item) => !kycSet.has(item));

  return {
    ownerProfile,
    ownerOnboarding,
    properties,
    hasOwnerProfile: Boolean(ownerProfile),
    hasProperty: properties.length > 0,
    missingKycAssets,
  };
}

export async function upsertOwnerProfile(
  userId: string,
  payload: {
    legalBusinessName: string;
    gstin: string;
    pan: string;
    contactPhone: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    kycAssetIds?: string[];
  },
) {
  await prisma.$transaction(async (tx) => {
    await tx.ownerProfile.upsert({
      where: { userId },
      update: {
        legalBusinessName: payload.legalBusinessName,
        gstin: payload.gstin,
        pan: payload.pan,
        contactPhone: payload.contactPhone,
        addressLine1: payload.addressLine1,
        addressLine2: payload.addressLine2,
        city: payload.city,
        state: payload.state,
        country: payload.country,
        postalCode: payload.postalCode,
      },
      create: {
        userId,
        legalBusinessName: payload.legalBusinessName,
        gstin: payload.gstin,
        pan: payload.pan,
        contactPhone: payload.contactPhone,
        addressLine1: payload.addressLine1,
        addressLine2: payload.addressLine2,
        city: payload.city,
        state: payload.state,
        country: payload.country,
        postalCode: payload.postalCode,
      },
    });

    await tx.ownerOnboarding.upsert({
      where: { userId },
      update: {
        status: OnboardingStatus.DRAFT,
      },
      create: {
        userId,
        status: OnboardingStatus.DRAFT,
      },
    });

    if (payload.kycAssetIds?.length) {
      await tx.mediaAsset.updateMany({
        where: {
          id: { in: payload.kycAssetIds },
          ownerId: userId,
        },
        data: {
          ownerId: userId,
        },
      });
    }
  });

  return getOnboardingStatus(userId);
}

export async function upsertPropertyRegistration(
  userId: string,
  payload: {
    hotelId?: string;
    legalPropertyName: string;
    displayName: string;
    description?: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    contactEmail?: string;
    contactPhone?: string;
    mediaAssetIds?: string[];
  },
) {
  const response = await prisma.$transaction(async (tx) => {
    const slugBase = payload.displayName || payload.legalPropertyName;
    const slug =
      payload.hotelId
        ? toSlug(slugBase)
        : await uniqueHotelSlug(`${slugBase}-${Date.now().toString().slice(-4)}`);

    let hotelId = payload.hotelId;

    if (!hotelId) {
      const hotel = await tx.hotel.create({
        data: {
          name: payload.displayName,
          slug,
          description: payload.description,
          ownerId: userId,
          addressLine1: payload.addressLine1,
          addressLine2: payload.addressLine2,
          city: payload.city,
          state: payload.state,
          country: payload.country,
          postalCode: payload.postalCode,
          email: payload.contactEmail,
          phone: payload.contactPhone,
          status: "ACTIVE",
          registrationStatus: HotelRegistrationStatus.PENDING_REVIEW,
        },
      });
      hotelId = hotel.id;
    } else {
      const hotel = await tx.hotel.findFirst({
        where: {
          id: hotelId,
          ownerId: userId,
        },
      });
      if (!hotel) {
        throw new Error("Hotel not found for this owner");
      }
    }

    const propertySlug = await uniquePropertySlug(`${slugBase}-${hotelId.slice(0, 6)}`);

    const property = await tx.propertyRegistration.upsert({
      where: { hotelId },
      update: {
        legalPropertyName: payload.legalPropertyName,
        displayName: payload.displayName,
        description: payload.description,
        addressLine1: payload.addressLine1,
        addressLine2: payload.addressLine2,
        city: payload.city,
        state: payload.state,
        country: payload.country,
        postalCode: payload.postalCode,
        contactEmail: payload.contactEmail,
        contactPhone: payload.contactPhone,
        status: OnboardingStatus.DRAFT,
      },
      create: {
        ownerId: userId,
        hotelId,
        status: OnboardingStatus.DRAFT,
        legalPropertyName: payload.legalPropertyName,
        displayName: payload.displayName,
        slug: propertySlug,
        description: payload.description,
        addressLine1: payload.addressLine1,
        addressLine2: payload.addressLine2,
        city: payload.city,
        state: payload.state,
        country: payload.country,
        postalCode: payload.postalCode,
        contactEmail: payload.contactEmail,
        contactPhone: payload.contactPhone,
      },
    });

    if (payload.mediaAssetIds?.length) {
      await tx.mediaAsset.updateMany({
        where: {
          id: { in: payload.mediaAssetIds },
          ownerId: userId,
        },
        data: {
          hotelId,
          propertyRegistrationId: property.id,
        },
      });
    }

    await tx.ownerOnboarding.upsert({
      where: { userId },
      update: { status: OnboardingStatus.DRAFT },
      create: { userId, status: OnboardingStatus.DRAFT },
    });

    return property;
  });

  return response;
}

export async function submitOwnerOnboarding(userId: string) {
  const status = await getOnboardingStatus(userId);

  if (!status.ownerProfile) {
    throw new Error("Owner profile is required before submission");
  }

  if (status.properties.length === 0) {
    throw new Error("At least one property must be registered");
  }

  if (status.missingKycAssets.length > 0) {
    throw new Error(`Missing KYC documents: ${status.missingKycAssets.join(", ")}`);
  }

  const onboarding = await prisma.$transaction(async (tx) => {
    await tx.propertyRegistration.updateMany({
      where: { ownerId: userId },
      data: { status: OnboardingStatus.SUBMITTED },
    });

    const next = await tx.ownerOnboarding.upsert({
      where: { userId },
      update: {
        status: OnboardingStatus.SUBMITTED,
        submittedAt: new Date(),
        reviewedAt: null,
        reviewedById: null,
        rejectionReason: null,
      },
      create: {
        userId,
        status: OnboardingStatus.SUBMITTED,
        submittedAt: new Date(),
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        ownerApprovalStatus: OnboardingStatus.SUBMITTED,
      },
    });

    await tx.approvalAuditLog.create({
      data: {
        actorId: userId,
        entityType: "owner_onboarding",
        entityId: next.id,
        action: "submitted",
        afterState: next as unknown as Prisma.InputJsonValue,
      },
    });

    return next;
  });

  await notifyAdmins({
    type: NotificationType.ONBOARDING_SUBMITTED,
    title: "New owner onboarding submitted",
    body: "A new owner onboarding application is waiting for review.",
    sendEmail: true,
  });

  return onboarding;
}

export async function approveOwnerOnboarding(input: {
  onboardingId: string;
  actorId: string;
}) {
  const actor = await prisma.user.findUnique({
    where: { id: input.actorId },
    select: { role: true, name: true },
  });

  if (!actor || actor.role !== UserRole.MASTER_ADMIN) {
    throw new Error("Only MASTER_ADMIN can approve onboarding");
  }

  const onboarding = await prisma.ownerOnboarding.findUnique({
    where: { id: input.onboardingId },
  });

  if (!onboarding) {
    throw new Error("Onboarding record not found");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.ownerOnboarding.update({
      where: { id: onboarding.id },
      data: {
        status: OnboardingStatus.APPROVED,
        reviewedAt: new Date(),
        reviewedById: input.actorId,
        rejectionReason: null,
      },
    });

    await tx.user.update({
      where: { id: onboarding.userId },
      data: {
        ownerApprovalStatus: OnboardingStatus.APPROVED,
      },
    });

    const ownerHotels = await tx.hotel.findMany({
      where: { ownerId: onboarding.userId },
      select: { id: true },
    });

    await tx.hotel.updateMany({
      where: {
        id: {
          in: ownerHotels.map((item) => item.id),
        },
      },
      data: {
        registrationStatus: HotelRegistrationStatus.ACTIVE,
      },
    });

    await tx.propertyRegistration.updateMany({
      where: { ownerId: onboarding.userId },
      data: {
        status: OnboardingStatus.APPROVED,
      },
    });

    await tx.approvalAuditLog.create({
      data: {
        actorId: input.actorId,
        entityType: "owner_onboarding",
        entityId: onboarding.id,
        action: "approved",
        beforeState: onboarding as unknown as Prisma.InputJsonValue,
        afterState: next as unknown as Prisma.InputJsonValue,
      },
    });

    return next;
  });

  await createUserNotification({
    userId: onboarding.userId,
    type: NotificationType.ONBOARDING_APPROVED,
    title: "Your SyncStay onboarding is approved",
    body: "You now have full access to dashboard and channel operations.",
    sendEmail: true,
  });

  return updated;
}

export async function rejectOwnerOnboarding(input: {
  onboardingId: string;
  actorId: string;
  rejectionReason: string;
}) {
  const actor = await prisma.user.findUnique({
    where: { id: input.actorId },
    select: { role: true, name: true },
  });

  if (!actor || actor.role !== UserRole.MASTER_ADMIN) {
    throw new Error("Only MASTER_ADMIN can reject onboarding");
  }

  const onboarding = await prisma.ownerOnboarding.findUnique({
    where: { id: input.onboardingId },
  });

  if (!onboarding) {
    throw new Error("Onboarding record not found");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.ownerOnboarding.update({
      where: { id: onboarding.id },
      data: {
        status: OnboardingStatus.REJECTED,
        reviewedAt: new Date(),
        reviewedById: input.actorId,
        rejectionReason: input.rejectionReason,
      },
    });

    await tx.user.update({
      where: { id: onboarding.userId },
      data: {
        ownerApprovalStatus: OnboardingStatus.REJECTED,
      },
    });

    await tx.propertyRegistration.updateMany({
      where: { ownerId: onboarding.userId },
      data: {
        status: OnboardingStatus.REJECTED,
      },
    });

    await tx.approvalAuditLog.create({
      data: {
        actorId: input.actorId,
        entityType: "owner_onboarding",
        entityId: onboarding.id,
        action: "rejected",
        beforeState: onboarding as unknown as Prisma.InputJsonValue,
        afterState: next as unknown as Prisma.InputJsonValue,
      },
    });

    return next;
  });

  await createUserNotification({
    userId: onboarding.userId,
    type: NotificationType.ONBOARDING_REJECTED,
    title: "Your SyncStay onboarding needs updates",
    body: `Onboarding was rejected with reason: ${input.rejectionReason}`,
    sendEmail: true,
  });

  return updated;
}

export async function getOnboardingQueue() {
  return prisma.ownerOnboarding.findMany({
    where: {
      status: {
        in: [OnboardingStatus.SUBMITTED, OnboardingStatus.UNDER_REVIEW, OnboardingStatus.REJECTED],
      },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      reviewedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function getOnboardingReviewDetails(onboardingId: string) {
  const onboarding = await prisma.ownerOnboarding.findUnique({
    where: { id: onboardingId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          ownerApprovalStatus: true,
          ownerProfile: true,
          mediaAssets: {
            where: {
              assetType: {
                in: REQUIRED_KYC_ASSET_TYPES,
              },
            },
            orderBy: { createdAt: "desc" },
          },
          propertyRegistrations: {
            include: {
              hotel: true,
              mediaAssets: {
                orderBy: { createdAt: "desc" },
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      },
      reviewedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!onboarding) {
    return null;
  }

  const auditLogs = await prisma.approvalAuditLog.findMany({
    where: {
      entityType: "owner_onboarding",
      entityId: onboarding.id,
    },
    include: {
      actor: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  return {
    onboarding,
    auditLogs,
  };
}
