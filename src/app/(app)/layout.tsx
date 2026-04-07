import { redirect } from "next/navigation";
import { OnboardingStatus, UserRole } from "@prisma/client";

import { AppShell } from "@/components/layout/app-shell";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession();

  if (!session) {
    redirect("/auth/sign-in");
  }

  if (!session.user.emailVerified) {
    redirect("/auth/verify-email");
  }

  const domainUser = await prisma.user.findFirst({
    where: { authUserId: session.user.id },
  });

  if (!domainUser) {
    redirect("/auth/sign-in");
  }

  const approvalStatus = (domainUser as { ownerApprovalStatus?: OnboardingStatus }).ownerApprovalStatus;

  if (
    domainUser.role !== UserRole.MASTER_ADMIN &&
    approvalStatus &&
    approvalStatus !== OnboardingStatus.APPROVED
  ) {
    if (
      approvalStatus === OnboardingStatus.SUBMITTED ||
      approvalStatus === OnboardingStatus.UNDER_REVIEW
    ) {
      redirect("/onboarding/pending");
    }
    redirect("/onboarding");
  }

  return <AppShell ownerName={session.user.name}>{children}</AppShell>;
}
