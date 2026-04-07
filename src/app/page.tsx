import { redirect } from "next/navigation";
import { OnboardingStatus, UserRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";

export default async function HomePage() {
  const session = await getServerSession();

  if (session) {
    if (!session.user.emailVerified) {
      redirect("/auth/verify-email");
    }

    const domainUser = await prisma.user.findFirst({
      where: { authUserId: session.user.id },
    });

    const approvalStatus = (domainUser as { ownerApprovalStatus?: OnboardingStatus } | null)
      ?.ownerApprovalStatus;

    if (
      domainUser &&
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

    redirect("/dashboard");
  }

  redirect("/auth/sign-in");
}
