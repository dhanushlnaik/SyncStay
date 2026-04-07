import {
  HotelRegistrationStatus,
  NotificationType,
  OnboardingStatus,
  Prisma,
  UserRole,
} from "@prisma/client";

import { createUserNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

function mapHotelRegistrationStatus(status: OnboardingStatus): HotelRegistrationStatus {
  if (status === OnboardingStatus.APPROVED) {
    return HotelRegistrationStatus.ACTIVE;
  }
  if (status === OnboardingStatus.REJECTED) {
    return HotelRegistrationStatus.REJECTED;
  }
  return HotelRegistrationStatus.PENDING_REVIEW;
}

async function assertMasterAdmin(actorId: string) {
  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { id: true, role: true },
  });

  if (!actor || actor.role !== UserRole.MASTER_ADMIN) {
    throw new Error("Only MASTER_ADMIN can perform this action");
  }
}

export async function getAdminUsersOverview(search?: string) {
  const where: Prisma.UserWhereInput = search?.trim()
    ? {
        OR: [
          { name: { contains: search.trim(), mode: "insensitive" } },
          { email: { contains: search.trim(), mode: "insensitive" } },
        ],
      }
    : {};

  const [users, auditLogs] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        ownerApprovalStatus: true,
        createdAt: true,
        updatedAt: true,
        authUser: {
          select: {
            id: true,
            emailVerified: true,
            role: true,
            isActive: true,
          },
        },
        ownerOnboarding: {
          select: {
            id: true,
            status: true,
            submittedAt: true,
            reviewedAt: true,
            rejectionReason: true,
            reviewedBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        _count: {
          select: {
            ownedHotels: true,
            propertyRegistrations: true,
          },
        },
      },
      orderBy: [{ role: "asc" }, { createdAt: "desc" }],
      take: 250,
    }),
    prisma.approvalAuditLog.findMany({
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
      take: 120,
    }),
  ]);

  return {
    users,
    auditLogs,
  };
}

export async function updateUserRoleByAdmin(input: {
  actorId: string;
  targetUserId: string;
  role: UserRole;
  isActive?: boolean;
}) {
  await assertMasterAdmin(input.actorId);

  const result = await prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { id: input.targetUserId },
      include: {
        authUser: {
          select: {
            id: true,
            role: true,
            isActive: true,
          },
        },
      },
    });

    if (!target) {
      throw new Error("Target user not found");
    }

    if (target.role === UserRole.MASTER_ADMIN && input.role !== UserRole.MASTER_ADMIN) {
      const activeAdminCount = await tx.user.count({
        where: {
          role: UserRole.MASTER_ADMIN,
          isActive: true,
          id: {
            not: target.id,
          },
        },
      });

      if (activeAdminCount === 0) {
        throw new Error("Cannot demote the last active MASTER_ADMIN");
      }
    }

    const nextUser = await tx.user.update({
      where: { id: target.id },
      data: {
        role: input.role,
        isActive: input.isActive ?? undefined,
        ownerApprovalStatus:
          input.role === UserRole.MASTER_ADMIN ? OnboardingStatus.APPROVED : undefined,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        ownerApprovalStatus: true,
      },
    });

    if (target.authUserId) {
      await tx.authUser.update({
        where: { id: target.authUserId },
        data: {
          role: input.role,
          isActive: input.isActive ?? undefined,
          emailVerified:
            input.role === UserRole.MASTER_ADMIN ? true : undefined,
        },
      });
    }

    await tx.approvalAuditLog.create({
      data: {
        actorId: input.actorId,
        entityType: "user",
        entityId: target.id,
        action: "role_updated",
        beforeState: {
          role: target.role,
          isActive: target.isActive,
        } as Prisma.InputJsonValue,
        afterState: {
          role: nextUser.role,
          isActive: nextUser.isActive,
        } as Prisma.InputJsonValue,
      },
    });

    return nextUser;
  });

  return result;
}

export async function updateUserApprovalStatusByAdmin(input: {
  actorId: string;
  targetUserId: string;
  status: OnboardingStatus;
  rejectionReason?: string;
}) {
  await assertMasterAdmin(input.actorId);

  if (input.status === OnboardingStatus.REJECTED && !input.rejectionReason?.trim()) {
    throw new Error("Rejection reason is required");
  }

  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { id: input.targetUserId },
      include: {
        ownerOnboarding: true,
      },
    });

    if (!target) {
      throw new Error("Target user not found");
    }

    if (target.role === UserRole.MASTER_ADMIN && input.status !== OnboardingStatus.APPROVED) {
      throw new Error("MASTER_ADMIN must remain in APPROVED state");
    }

    const beforeState = {
      ownerApprovalStatus: target.ownerApprovalStatus,
      ownerOnboarding: target.ownerOnboarding,
    };

    const submittedAt =
      input.status === OnboardingStatus.DRAFT
        ? null
        : target.ownerOnboarding?.submittedAt ?? now;
    const reviewedAt =
      input.status === OnboardingStatus.APPROVED || input.status === OnboardingStatus.REJECTED
        ? now
        : null;
    const reviewedById =
      input.status === OnboardingStatus.APPROVED || input.status === OnboardingStatus.REJECTED
        ? input.actorId
        : null;

    const onboarding = await tx.ownerOnboarding.upsert({
      where: { userId: target.id },
      update: {
        status: input.status,
        submittedAt,
        reviewedAt,
        reviewedById,
        rejectionReason:
          input.status === OnboardingStatus.REJECTED ? input.rejectionReason?.trim() ?? null : null,
      },
      create: {
        userId: target.id,
        status: input.status,
        submittedAt,
        reviewedAt,
        reviewedById,
        rejectionReason:
          input.status === OnboardingStatus.REJECTED ? input.rejectionReason?.trim() ?? null : null,
      },
    });

    const user = await tx.user.update({
      where: { id: target.id },
      data: {
        ownerApprovalStatus: input.status,
      },
      select: {
        id: true,
        name: true,
        email: true,
        ownerApprovalStatus: true,
      },
    });

    await tx.propertyRegistration.updateMany({
      where: { ownerId: target.id },
      data: {
        status: input.status,
      },
    });

    await tx.hotel.updateMany({
      where: { ownerId: target.id },
      data: {
        registrationStatus: mapHotelRegistrationStatus(input.status),
      },
    });

    await tx.approvalAuditLog.create({
      data: {
        actorId: input.actorId,
        entityType: "owner_onboarding",
        entityId: onboarding.id,
        action: "status_updated",
        beforeState: beforeState as Prisma.InputJsonValue,
        afterState: {
          ownerApprovalStatus: user.ownerApprovalStatus,
          ownerOnboarding: onboarding,
        } as Prisma.InputJsonValue,
      },
    });

    return {
      user,
      onboarding,
    };
  });

  if (input.status === OnboardingStatus.APPROVED) {
    await createUserNotification({
      userId: input.targetUserId,
      type: NotificationType.ONBOARDING_APPROVED,
      title: "Your SyncStay onboarding is approved",
      body: "You now have full access to dashboard and channel operations.",
      sendEmail: true,
    });
  }

  if (input.status === OnboardingStatus.REJECTED) {
    await createUserNotification({
      userId: input.targetUserId,
      type: NotificationType.ONBOARDING_REJECTED,
      title: "Your SyncStay onboarding needs updates",
      body: `Onboarding was rejected with reason: ${input.rejectionReason?.trim()}`,
      sendEmail: true,
    });
  }

  return result;
}
