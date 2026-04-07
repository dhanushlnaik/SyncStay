import { UserRole } from "@prisma/client";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { requireSession } from "@/lib/session";

import { AdminOnboardingQueue } from "./queue-client";

export default async function AdminOnboardingPage() {
  const authResult = await requireSession();
  if ("error" in authResult) {
    return null;
  }

  if (authResult.domainUser.role !== UserRole.MASTER_ADMIN) {
    return (
      <Card>
        <CardTitle>Access Restricted</CardTitle>
        <CardDescription>Only master admins can review onboarding applications.</CardDescription>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-serif text-3xl text-[var(--text-primary)]">Onboarding Review Queue</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Approve or reject owner onboarding requests with audit trail.
        </p>
      </div>
      <AdminOnboardingQueue />
    </div>
  );
}
