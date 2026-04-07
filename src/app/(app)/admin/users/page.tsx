import { UserRole } from "@prisma/client";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getAdminUsersOverview } from "@/lib/admin-users";
import { requireSession } from "@/lib/session";

import { AdminUsersConsole } from "./users-client";

export default async function AdminUsersPage() {
  const authResult = await requireSession();
  if ("error" in authResult) {
    return null;
  }

  if (authResult.domainUser.role !== UserRole.MASTER_ADMIN) {
    return (
      <Card>
        <CardTitle>Access Restricted</CardTitle>
        <CardDescription>Only master admins can manage user roles and owner approvals.</CardDescription>
      </Card>
    );
  }

  const adminData = await getAdminUsersOverview();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-serif text-3xl text-[var(--text-primary)]">Admin User Operations</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Promote, approve, and monitor owner lifecycle decisions with audit visibility.
        </p>
      </div>
      <AdminUsersConsole initialUsers={adminData.users} initialAuditLogs={adminData.auditLogs} />
    </div>
  );
}
