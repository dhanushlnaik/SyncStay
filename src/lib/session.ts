import { OnboardingStatus, UserRole } from "@prisma/client";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type SessionPayload = {
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
    token: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified?: boolean;
    role?: string;
    isActive?: boolean;
  };
};

export async function getServerSession() {
  const requestHeaders = await headers();
  const rawSession = await auth.api.getSession({
    headers: new Headers(requestHeaders),
  });

  if (!rawSession) {
    return null;
  }

  const session = rawSession as SessionPayload;
  if (typeof session.user.emailVerified !== "boolean") {
    const authUser = await prisma.authUser.findUnique({
      where: { id: session.user.id },
      select: { emailVerified: true },
    });
    session.user.emailVerified = authUser?.emailVerified ?? false;
  }

  return session;
}

type RequireSessionOptions = {
  allowUnverified?: boolean;
  allowUnapproved?: boolean;
};

export async function requireSession(options: RequireSessionOptions = {}) {
  const session = await getServerSession();

  if (!session) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    } as const;
  }

  const domainUser = await prisma.user.findFirst({
    where: { authUserId: session.user.id },
  });

  if (!domainUser) {
    return {
      error: NextResponse.json(
        { error: "Domain user missing. Please contact support." },
        { status: 403 },
      ),
    } as const;
  }

  if (!options.allowUnverified && !session.user.emailVerified) {
    return {
      error: NextResponse.json(
        {
          error: "Email not verified",
          code: "EMAIL_NOT_VERIFIED",
        },
        { status: 403 },
      ),
    } as const;
  }

  const approvalStatus = (domainUser as { ownerApprovalStatus?: OnboardingStatus }).ownerApprovalStatus;

  if (
    !options.allowUnapproved &&
    domainUser.role !== UserRole.MASTER_ADMIN &&
    approvalStatus &&
    approvalStatus !== OnboardingStatus.APPROVED
  ) {
    return {
      error: NextResponse.json(
        {
          error: "Owner onboarding approval pending",
          code: "OWNER_NOT_APPROVED",
          status: approvalStatus,
        },
        { status: 403 },
      ),
    } as const;
  }

  return {
    session,
    domainUser,
  } as const;
}

export function hasRole(role: UserRole | string | undefined, allowed: UserRole[]) {
  if (!role) {
    return false;
  }

  return allowed.includes(role as UserRole);
}
