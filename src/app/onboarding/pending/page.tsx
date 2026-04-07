import { OnboardingStatus, UserRole } from "@prisma/client";
import { redirect } from "next/navigation";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getOnboardingStatus } from "@/lib/onboarding";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";

import { PendingStatus } from "./pending-status";

export default async function OnboardingPendingPage() {
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
  const submittedAt = onboardingStatus.ownerOnboarding?.submittedAt
    ? onboardingStatus.ownerOnboarding.submittedAt.toISOString()
    : null;

  if (domainUser.role === UserRole.MASTER_ADMIN || lifecycleStatus === OnboardingStatus.APPROVED) {
    redirect("/dashboard");
  }

  if (lifecycleStatus === OnboardingStatus.REJECTED || lifecycleStatus === OnboardingStatus.DRAFT) {
    redirect("/onboarding");
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-12rem] top-[-8rem] h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(78,91,67,0.16),transparent_72%)]" />
        <div className="absolute right-[-10rem] top-16 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(58,49,43,0.12),transparent_72%)]" />
        <div className="absolute bottom-[-12rem] left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(35,48,68,0.08),transparent_72%)]" />
      </div>

      <div className="relative mx-auto grid w-full max-w-5xl gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="space-y-4 border-[var(--accent)]/20 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(246,243,236,0.96))] p-7">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--accent)]/25 bg-[var(--accent-soft)] px-3 py-1 text-xs font-medium text-[var(--accent-strong)]">
            <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-[var(--accent)]" />
            Review Queue Active
          </div>

          <div className="space-y-2">
            <CardTitle className="font-serif text-4xl leading-tight md:text-5xl">Application Under Review</CardTitle>
            <CardDescription className="max-w-2xl text-base leading-relaxed">
              Submitted successfully. Your owner and property onboarding is now with the SyncStay admin team for
              compliance and activation checks.
            </CardDescription>
          </div>

          <PendingStatus initialStatus={lifecycleStatus} submittedAt={submittedAt} />
        </Card>

        <Card className="space-y-3 p-6">
          <CardTitle className="font-serif text-2xl">What Happens Next</CardTitle>
          <CardDescription>Typical review time is short for complete KYC and property details.</CardDescription>

          <div className="space-y-3 text-sm text-[var(--text-secondary)]">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)]/70 px-3 py-2">
              1. Identity and document verification
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)]/70 px-3 py-2">
              2. Property profile quality check
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)]/70 px-3 py-2">
              3. Account activation and dashboard access
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
