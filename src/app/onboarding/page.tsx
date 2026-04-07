import { OnboardingStatus, UserRole } from "@prisma/client";
import { redirect } from "next/navigation";

import { getOnboardingStatus } from "@/lib/onboarding";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";

import { OnboardingWizard } from "./wizard";

export default async function OnboardingPage() {
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
  const onboardingStatus = await getOnboardingStatus(domainUser.id);
  const lifecycleStatus = onboardingStatus.ownerOnboarding?.status ?? approvalStatus ?? OnboardingStatus.DRAFT;

  if (
    domainUser.role === UserRole.MASTER_ADMIN ||
    lifecycleStatus === OnboardingStatus.APPROVED
  ) {
    redirect("/dashboard");
  }

  if (
    lifecycleStatus === OnboardingStatus.SUBMITTED ||
    lifecycleStatus === OnboardingStatus.UNDER_REVIEW
  ) {
    redirect("/onboarding/pending");
  }

  return (
    <OnboardingWizard
      user={{
        id: domainUser.id,
        name: domainUser.name,
        email: domainUser.email,
        status: lifecycleStatus,
      }}
    />
  );
}
