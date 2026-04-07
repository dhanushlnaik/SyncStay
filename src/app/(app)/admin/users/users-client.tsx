"use client";

import { OnboardingStatus, UserRole } from "@prisma/client";
import { motion } from "framer-motion";
import { Search, ShieldCheck, UserCog, UserRoundCheck } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/lib/toast";

type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  ownerApprovalStatus: OnboardingStatus;
  createdAt: string | Date;
  updatedAt: string | Date;
  authUser: {
    id: string;
    emailVerified: boolean;
    role: string;
    isActive: boolean;
  } | null;
  ownerOnboarding: {
    id: string;
    status: OnboardingStatus;
    submittedAt?: string | Date | null;
    reviewedAt?: string | Date | null;
    rejectionReason?: string | null;
    reviewedBy?: {
      id: string;
      name: string;
      email: string;
    } | null;
  } | null;
  _count: {
    ownedHotels: number;
    propertyRegistrations: number;
  };
};

type AdminAuditLog = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  beforeState?: unknown;
  afterState?: unknown;
  createdAt: string | Date;
  actor?: {
    id: string;
    name: string;
    email: string;
  } | null;
};

type AdminUsersResponse = {
  users?: AdminUserRow[];
  auditLogs?: AdminAuditLog[];
  error?: string;
};

type AdminUsersConsoleProps = {
  initialUsers: AdminUserRow[];
  initialAuditLogs: AdminAuditLog[];
};

const APPROVAL_OPTIONS = [
  OnboardingStatus.DRAFT,
  OnboardingStatus.SUBMITTED,
  OnboardingStatus.UNDER_REVIEW,
  OnboardingStatus.APPROVED,
  OnboardingStatus.REJECTED,
];

function statusBadgeVariant(status: OnboardingStatus) {
  if (status === OnboardingStatus.APPROVED) return "success";
  if (status === OnboardingStatus.REJECTED) return "destructive";
  if (status === OnboardingStatus.UNDER_REVIEW) return "warning";
  if (status === OnboardingStatus.SUBMITTED) return "accent";
  return "neutral";
}

function roleBadgeVariant(role: UserRole) {
  if (role === UserRole.MASTER_ADMIN) return "accent";
  if (role === UserRole.OWNER) return "neutral";
  return "warning";
}

function describeAudit(log: AdminAuditLog) {
  const before = (log.beforeState ?? {}) as { role?: string; ownerApprovalStatus?: string };
  const after = (log.afterState ?? {}) as { role?: string; ownerApprovalStatus?: string };

  if (log.action === "role_updated") {
    return `Role ${before.role ?? "unknown"} -> ${after.role ?? "unknown"}`;
  }
  if (log.action === "status_updated") {
    return `Approval ${before.ownerApprovalStatus ?? "unknown"} -> ${after.ownerApprovalStatus ?? "unknown"}`;
  }
  if (log.action === "submitted" || log.action === "approved" || log.action === "rejected") {
    return `Onboarding ${log.action}`;
  }
  return log.action;
}

function toRoleDrafts(rows: AdminUserRow[]) {
  return Object.fromEntries(rows.map((item) => [item.id, item.role])) as Record<string, UserRole>;
}

function toActiveDrafts(rows: AdminUserRow[]) {
  return Object.fromEntries(rows.map((item) => [item.id, item.isActive])) as Record<string, boolean>;
}

function toApprovalDrafts(rows: AdminUserRow[]) {
  return Object.fromEntries(
    rows.map((item) => [item.id, item.ownerApprovalStatus ?? OnboardingStatus.DRAFT]),
  ) as Record<string, OnboardingStatus>;
}

export function AdminUsersConsole({ initialUsers, initialAuditLogs }: AdminUsersConsoleProps) {
  const [users, setUsers] = useState<AdminUserRow[]>(initialUsers);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>(initialAuditLogs);
  const [query, setQuery] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, UserRole>>(toRoleDrafts(initialUsers));
  const [activeDrafts, setActiveDrafts] = useState<Record<string, boolean>>(toActiveDrafts(initialUsers));
  const [approvalDrafts, setApprovalDrafts] = useState<Record<string, OnboardingStatus>>(
    toApprovalDrafts(initialUsers),
  );
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});

  const refreshData = useCallback(async () => {
    setLoading(true);

    const search = query.trim();
    const response = await fetch(search ? `/api/admin/users?q=${encodeURIComponent(search)}` : "/api/admin/users");
    const data = (await response.json()) as AdminUsersResponse;

    if (!response.ok) {
      toast.error(data.error ?? "Failed to load admin users");
      setLoading(false);
      return;
    }

    const nextUsers = data.users ?? [];
    setUsers(nextUsers);
    setAuditLogs(data.auditLogs ?? []);
    setRoleDrafts(toRoleDrafts(nextUsers));
    setActiveDrafts(toActiveDrafts(nextUsers));
    setApprovalDrafts(toApprovalDrafts(nextUsers));
    setLoading(false);
  }, [query]);

  async function saveRole(userId: string) {
    const role = roleDrafts[userId];
    const isActive = activeDrafts[userId];

    if (!role) {
      toast.error("Role is required");
      return;
    }

    setActionKey(`role-${userId}`);

    const response = await fetch(`/api/admin/users/${userId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, isActive }),
    });

    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      toast.error(data.error ?? "Failed to update role");
      setActionKey(null);
      return;
    }

    toast.success("Role updated");
    await refreshData();
    setActionKey(null);
  }

  async function saveApproval(userId: string) {
    const status = approvalDrafts[userId];
    const rejectionReason = rejectionReasons[userId]?.trim();

    if (!status) {
      toast.error("Approval status is required");
      return;
    }

    if (status === OnboardingStatus.REJECTED && !rejectionReason) {
      toast.error("Rejection reason is required");
      return;
    }

    setActionKey(`approval-${userId}`);

    const response = await fetch(`/api/admin/users/${userId}/approval`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        rejectionReason,
      }),
    });

    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      toast.error(data.error ?? "Failed to update owner approval");
      setActionKey(null);
      return;
    }

    toast.success("Approval status updated");
    await refreshData();
    setActionKey(null);
  }

  const stats = useMemo(() => {
    const admins = users.filter((user) => user.role === UserRole.MASTER_ADMIN).length;
    const approved = users.filter((user) => user.ownerApprovalStatus === OnboardingStatus.APPROVED).length;
    const pending = users.filter(
      (user) =>
        user.ownerApprovalStatus === OnboardingStatus.SUBMITTED ||
        user.ownerApprovalStatus === OnboardingStatus.UNDER_REVIEW,
    ).length;
    return { admins, approved, pending };
  }, [users]);

  return (
    <div className="space-y-4">
      <motion.div
        className="grid gap-3 md:grid-cols-3"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <Card className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-[var(--accent)]" />
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Active Admins</p>
            <p className="text-xl font-semibold text-[var(--text-primary)]">{stats.admins}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <UserRoundCheck className="h-5 w-5 text-[var(--success)]" />
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Approved Owners</p>
            <p className="text-xl font-semibold text-[var(--text-primary)]">{stats.approved}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <UserCog className="h-5 w-5 text-[var(--warning)]" />
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Pending Reviews</p>
            <p className="text-xl font-semibold text-[var(--text-primary)]">{stats.pending}</p>
          </div>
        </Card>
      </motion.div>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <Input
              className="pl-9"
              value={input}
              placeholder="Search by name or email"
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  setQuery(input.trim());
                }
              }}
            />
          </div>
          <Button variant="outline" onClick={() => setQuery(input.trim())} disabled={loading}>
            Search
          </Button>
          <Button variant="ghost" onClick={() => void refreshData()} disabled={loading}>
            Refresh
          </Button>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Approval</TableHead>
                <TableHead>Verification</TableHead>
                <TableHead>Properties</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <p className="font-medium text-[var(--text-primary)]">{user.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">{user.email}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      Updated {new Date(user.updatedAt).toLocaleString()}
                    </p>
                  </TableCell>

                  <TableCell>
                    <div className="space-y-2">
                      <Badge variant={roleBadgeVariant(user.role)}>{user.role}</Badge>
                      <select
                        className="h-9 min-w-[11rem] rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-[var(--text-primary)]"
                        value={roleDrafts[user.id] ?? user.role}
                        onChange={(event) =>
                          setRoleDrafts((prev) => ({
                            ...prev,
                            [user.id]: event.target.value as UserRole,
                          }))
                        }
                      >
                        <option value={UserRole.MASTER_ADMIN}>MASTER_ADMIN</option>
                        <option value={UserRole.OWNER}>OWNER</option>
                        <option value={UserRole.STAFF}>STAFF</option>
                      </select>
                      <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                        <input
                          type="checkbox"
                          checked={activeDrafts[user.id] ?? user.isActive}
                          onChange={(event) =>
                            setActiveDrafts((prev) => ({
                              ...prev,
                              [user.id]: event.target.checked,
                            }))
                          }
                        />
                        Active account
                      </label>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="space-y-2">
                      <Badge variant={statusBadgeVariant(user.ownerApprovalStatus)}>
                        {user.ownerApprovalStatus}
                      </Badge>
                      <select
                        className="h-9 min-w-[11rem] rounded-xl border border-[var(--border)] bg-white px-3 text-sm text-[var(--text-primary)]"
                        value={approvalDrafts[user.id] ?? user.ownerApprovalStatus}
                        onChange={(event) =>
                          setApprovalDrafts((prev) => ({
                            ...prev,
                            [user.id]: event.target.value as OnboardingStatus,
                          }))
                        }
                        disabled={user.role === UserRole.MASTER_ADMIN}
                      >
                        {APPROVAL_OPTIONS.map((option) => (
                          <option key={`${user.id}-${option}`} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>

                      {(approvalDrafts[user.id] ?? user.ownerApprovalStatus) === OnboardingStatus.REJECTED ? (
                        <Input
                          placeholder="Rejection reason"
                          value={rejectionReasons[user.id] ?? user.ownerOnboarding?.rejectionReason ?? ""}
                          onChange={(event) =>
                            setRejectionReasons((prev) => ({
                              ...prev,
                              [user.id]: event.target.value,
                            }))
                          }
                        />
                      ) : null}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="space-y-1">
                      <Badge variant={user.authUser?.emailVerified ? "success" : "warning"}>
                        {user.authUser?.emailVerified ? "Email Verified" : "Email Unverified"}
                      </Badge>
                      <Badge variant={user.authUser?.isActive ? "neutral" : "destructive"}>
                        {user.authUser?.isActive ? "Auth Active" : "Auth Inactive"}
                      </Badge>
                    </div>
                  </TableCell>

                  <TableCell>
                    <p className="text-sm text-[var(--text-primary)]">{user._count.propertyRegistrations}</p>
                    <p className="text-xs text-[var(--text-muted)]">Hotels: {user._count.ownedHotels}</p>
                  </TableCell>

                  <TableCell>
                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loading || actionKey === `role-${user.id}`}
                        onClick={() => void saveRole(user.id)}
                      >
                        {actionKey === `role-${user.id}` ? "Saving..." : "Save Role"}
                      </Button>
                      <Button
                        size="sm"
                        disabled={
                          loading ||
                          actionKey === `approval-${user.id}` ||
                          user.role === UserRole.MASTER_ADMIN
                        }
                        onClick={() => void saveApproval(user.id)}
                      >
                        {actionKey === `approval-${user.id}` ? "Saving..." : "Save Approval"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {users.length === 0 ? (
            <p className="py-6 text-sm text-[var(--text-secondary)]">No users found for this query.</p>
          ) : null}
        </div>
      </Card>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.06 }}
      >
        <Card className="space-y-3">
          <div>
            <h2 className="font-serif text-2xl text-[var(--text-primary)]">Approval Audit Timeline</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Latest privileged actions across role and approval workflows.
            </p>
          </div>
          <div className="space-y-2">
            {auditLogs.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">No audit actions yet.</p>
            ) : null}
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{describeAudit(log)}</p>
                  <Badge variant="neutral">{log.entityType}</Badge>
                </div>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {log.actor?.name ?? "System"} ({log.actor?.email ?? "n/a"}) •{" "}
                  {new Date(log.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
