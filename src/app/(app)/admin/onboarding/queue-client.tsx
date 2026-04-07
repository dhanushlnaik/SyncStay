"use client";

import { MediaAssetType, OnboardingStatus } from "@prisma/client";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";

type QueueItem = {
  id: string;
  status: OnboardingStatus;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  user: {
    id: string;
    name: string;
    email: string;
  };
};

type ReviewMediaAsset = {
  id: string;
  assetType: MediaAssetType;
  secureUrl: string;
  mimeType?: string | null;
  createdAt: string;
};

type ReviewProperty = {
  id: string;
  displayName: string;
  legalPropertyName: string;
  city: string;
  state: string;
  country: string;
  status: OnboardingStatus;
  contactEmail?: string | null;
  contactPhone?: string | null;
  hotel: {
    id: string;
    registrationStatus: string;
    timezone: string;
    currency: string;
  };
  mediaAssets: ReviewMediaAsset[];
};

type ReviewDetails = {
  onboarding: {
    id: string;
    status: OnboardingStatus;
    submittedAt?: string | null;
    reviewedAt?: string | null;
    rejectionReason?: string | null;
    user: {
      id: string;
      name: string;
      email: string;
      ownerApprovalStatus: OnboardingStatus;
      ownerProfile?: {
        legalBusinessName: string;
        gstin: string;
        pan: string;
        contactPhone: string;
        addressLine1: string;
        addressLine2?: string | null;
        city: string;
        state: string;
        country: string;
        postalCode: string;
      } | null;
      mediaAssets: ReviewMediaAsset[];
      propertyRegistrations: ReviewProperty[];
    };
    reviewedBy?: {
      id: string;
      name: string;
      email: string;
    } | null;
  };
  auditLogs: {
    id: string;
    action: string;
    createdAt: string;
    actor?: {
      id: string;
      name: string;
      email: string;
    } | null;
  }[];
};

function statusVariant(status: OnboardingStatus) {
  if (status === OnboardingStatus.APPROVED) return "success";
  if (status === OnboardingStatus.REJECTED) return "destructive";
  if (status === OnboardingStatus.UNDER_REVIEW) return "warning";
  return "accent";
}

function isPdfAsset(asset: ReviewMediaAsset) {
  if (asset.mimeType?.toLowerCase().includes("pdf")) {
    return true;
  }

  return asset.secureUrl.toLowerCase().includes(".pdf");
}

function KycAssetCard({ asset }: { asset: ReviewMediaAsset }) {
  return (
    <Card className="space-y-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-[var(--text-primary)]">{asset.assetType}</p>
        <a
          href={asset.secureUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-[var(--accent)] underline-offset-2 hover:underline"
        >
          Open
        </a>
      </div>
      {isPdfAsset(asset) ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3 text-xs text-[var(--text-secondary)]">
          PDF document preview
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={asset.secureUrl}
          alt={asset.assetType}
          className="h-28 w-full rounded-lg border border-[var(--border)] object-cover"
          loading="lazy"
        />
      )}
      <p className="text-[11px] text-[var(--text-muted)]">{new Date(asset.createdAt).toLocaleString()}</p>
    </Card>
  );
}

export function AdminOnboardingQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [reasonMap, setReasonMap] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailsById, setDetailsById] = useState<Record<string, ReviewDetails>>({});
  const [detailsLoadingId, setDetailsLoadingId] = useState<string | null>(null);

  async function fetchQueueData() {
    const response = await fetch("/api/admin/onboarding/queue");
    const data = (await response.json()) as { items?: QueueItem[]; error?: string };
    return { ok: response.ok, data };
  }

  async function load() {
    const result = await fetchQueueData();
    if (!result.ok) {
      setError(result.data.error ?? "Failed to load queue");
      return;
    }

    const rows = result.data.items ?? [];
    setError(null);
    setItems(rows);
    if (expandedId && !rows.some((row) => row.id === expandedId)) {
      setExpandedId(null);
    }
  }

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const result = await fetchQueueData();
      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setError(result.data.error ?? "Failed to load queue");
        return;
      }

      setError(null);
      setItems(result.data.items ?? []);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function loadReviewDetails(id: string) {
    if (detailsById[id]) {
      setExpandedId((prev) => (prev === id ? null : id));
      return;
    }

    setDetailsLoadingId(id);
    const response = await fetch(`/api/admin/onboarding/${id}`);
    const data = (await response.json()) as ReviewDetails & { error?: string };

    if (!response.ok) {
      setError(data.error ?? "Failed to load onboarding details");
      setDetailsLoadingId(null);
      return;
    }

    setDetailsById((prev) => ({
      ...prev,
      [id]: data,
    }));
    setExpandedId((prev) => (prev === id ? null : id));
    setDetailsLoadingId(null);
  }

  async function approve(id: string) {
    setActionId(id);
    const response = await fetch(`/api/admin/onboarding/${id}/approve`, { method: "POST" });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Approval failed");
      setActionId(null);
      return;
    }
    toast.success("Onboarding approved");
    await load();
    setActionId(null);
  }

  async function reject(id: string) {
    setActionId(id);
    const reason = reasonMap[id];
    const response = await fetch(`/api/admin/onboarding/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rejectionReason: reason,
      }),
    });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Rejection failed");
      setActionId(null);
      return;
    }
    toast.success("Onboarding rejected");
    await load();
    setActionId(null);
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-[var(--error)]">{error}</p> : null}
      {items.length === 0 ? (
        <Card className="text-sm text-[var(--text-secondary)]">No onboarding requests in queue.</Card>
      ) : null}

      {items.map((item) => {
        const details = detailsById[item.id];
        const isExpanded = expandedId === item.id;

        return (
          <Card key={item.id} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {item.user.name} ({item.user.email})
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  Submitted: {item.submittedAt ? new Date(item.submittedAt).toLocaleString() : "Not submitted"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={detailsLoadingId === item.id}
                  onClick={() => void loadReviewDetails(item.id)}
                >
                  {detailsLoadingId === item.id ? "Loading..." : isExpanded ? "Hide Review" : "Review"}
                </Button>
              </div>
            </div>

            {isExpanded && details ? (
              <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <Card className="space-y-2 p-4">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Owner Profile</p>
                    {details.onboarding.user.ownerProfile ? (
                      <div className="space-y-1 text-sm text-[var(--text-secondary)]">
                        <p>{details.onboarding.user.ownerProfile.legalBusinessName}</p>
                        <p>GSTIN: {details.onboarding.user.ownerProfile.gstin}</p>
                        <p>PAN: {details.onboarding.user.ownerProfile.pan}</p>
                        <p>Phone: {details.onboarding.user.ownerProfile.contactPhone}</p>
                        <p>
                          {details.onboarding.user.ownerProfile.addressLine1}
                          {details.onboarding.user.ownerProfile.addressLine2
                            ? `, ${details.onboarding.user.ownerProfile.addressLine2}`
                            : ""}
                        </p>
                        <p>
                          {details.onboarding.user.ownerProfile.city},{" "}
                          {details.onboarding.user.ownerProfile.state},{" "}
                          {details.onboarding.user.ownerProfile.country}{" "}
                          {details.onboarding.user.ownerProfile.postalCode}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-[var(--text-secondary)]">Owner profile not submitted.</p>
                    )}
                  </Card>

                  <Card className="space-y-2 p-4">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">KYC Documents</p>
                    {details.onboarding.user.mediaAssets.length === 0 ? (
                      <p className="text-sm text-[var(--text-secondary)]">No KYC files uploaded.</p>
                    ) : (
                      <div className="grid gap-2 md:grid-cols-2">
                        {details.onboarding.user.mediaAssets.map((asset) => (
                          <KycAssetCard key={asset.id} asset={asset} />
                        ))}
                      </div>
                    )}
                  </Card>
                </div>

                <Card className="space-y-2 p-4">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Properties</p>
                  {details.onboarding.user.propertyRegistrations.length === 0 ? (
                    <p className="text-sm text-[var(--text-secondary)]">No properties submitted.</p>
                  ) : (
                    <div className="space-y-2">
                      {details.onboarding.user.propertyRegistrations.map((property) => (
                        <div
                          key={property.id}
                          className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)]/65 p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium text-[var(--text-primary)]">
                              {property.displayName}
                            </p>
                            <Badge variant={statusVariant(property.status)}>{property.status}</Badge>
                          </div>
                          <p className="text-xs text-[var(--text-muted)]">
                            {property.city}, {property.state}, {property.country}
                          </p>
                          <p className="mt-1 text-xs text-[var(--text-secondary)]">
                            Contact: {property.contactEmail ?? "n/a"} / {property.contactPhone ?? "n/a"}
                          </p>
                          {property.mediaAssets.length > 0 ? (
                            <div className="mt-2 grid gap-2 md:grid-cols-3">
                              {property.mediaAssets.map((asset) => (
                                <KycAssetCard key={asset.id} asset={asset} />
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <Card className="space-y-2 p-4">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Audit Timeline</p>
                  {details.auditLogs.length === 0 ? (
                    <p className="text-sm text-[var(--text-secondary)]">No audit events yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {details.auditLogs.map((log) => (
                        <div
                          key={log.id}
                          className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)]/65 p-2"
                        >
                          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">
                            {log.action}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {new Date(log.createdAt).toLocaleString()} • {log.actor?.name ?? "System"}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <Input
                  placeholder="Rejection reason (required for reject)"
                  value={reasonMap[item.id] ?? details.onboarding.rejectionReason ?? ""}
                  onChange={(event) =>
                    setReasonMap((prev) => ({
                      ...prev,
                      [item.id]: event.target.value,
                    }))
                  }
                />

                <div className="flex flex-wrap gap-2">
                  <Button disabled={actionId === item.id} onClick={() => void approve(item.id)}>
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    disabled={actionId === item.id || !(reasonMap[item.id] ?? "").trim()}
                    onClick={() => void reject(item.id)}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}
