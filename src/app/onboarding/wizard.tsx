"use client";

import { MediaAssetType, OnboardingStatus } from "@prisma/client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";

type OnboardingWizardProps = {
  user: {
    id: string;
    name: string;
    email: string;
    status: OnboardingStatus;
  };
};

type OnboardingStatusResponse = {
  ownerOnboarding?: {
    id: string;
    status: OnboardingStatus;
    rejectionReason?: string | null;
    reviewedAt?: string | null;
  };
  hasOwnerProfile: boolean;
  hasProperty: boolean;
  missingKycAssets: string[];
};

type UploadPhase = "queued" | "signing" | "uploading" | "committing" | "done" | "error";

type UploadQueueItem = {
  id: string;
  file: File;
  previewUrl: string;
  assetType: MediaAssetType;
  phase: UploadPhase;
  progress: number;
  error?: string;
  committedAssetId?: string;
  isDeleting?: boolean;
};

type UploadedAsset = {
  id: string;
  assetType: MediaAssetType;
  cloudinaryPublicId: string;
  secureUrl: string;
  fileName: string;
};

type SignedUploadPayload = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  uploadUrl: string;
  deliveryType: "upload" | "authenticated";
};

type CloudinaryUploadResponse = {
  public_id: string;
  secure_url: string;
  version: number;
  bytes: number;
};

type CommitUploadResponse = {
  id: string;
  assetType: MediaAssetType;
  cloudinaryPublicId: string;
  secureUrl: string;
};

type ApiErrorShape = {
  error?:
    | string
    | {
        formErrors?: string[];
        fieldErrors?: Record<string, string[] | undefined>;
      };
};

const initialOwnerProfile = {
  legalBusinessName: "",
  gstin: "",
  pan: "",
  contactPhone: "",
  addressLine1: "",
  city: "",
  state: "",
  country: "India",
  postalCode: "",
};

const initialProperty = {
  legalPropertyName: "",
  displayName: "",
  description: "",
  addressLine1: "",
  city: "",
  state: "",
  country: "India",
  postalCode: "",
  contactEmail: "",
  contactPhone: "",
};

function makeId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toAssetLabel(assetType: MediaAssetType | string) {
  return assetType
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parseCloudinaryError(responseText: string) {
  try {
    const parsed = JSON.parse(responseText) as { error?: { message?: string } };
    if (parsed.error?.message) {
      return parsed.error.message;
    }
  } catch {
    return "Cloudinary upload failed";
  }
  return "Cloudinary upload failed";
}

function extractApiErrorMessage(data: unknown, fallback: string) {
  if (!data || typeof data !== "object") {
    return fallback;
  }

  const payload = data as ApiErrorShape;
  if (typeof payload.error === "string" && payload.error.trim()) {
    return payload.error;
  }

  if (payload.error && typeof payload.error === "object") {
    if (Array.isArray(payload.error.formErrors) && payload.error.formErrors.length > 0) {
      return payload.error.formErrors[0];
    }

    if (payload.error.fieldErrors && typeof payload.error.fieldErrors === "object") {
      for (const messages of Object.values(payload.error.fieldErrors)) {
        if (Array.isArray(messages) && messages.length > 0) {
          return messages[0];
        }
      }
    }
  }

  return fallback;
}

function uploadToCloudinary(
  file: File,
  signedPayload: SignedUploadPayload,
  onProgress: (progress: number) => void,
) {
  return new Promise<CloudinaryUploadResponse>((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("api_key", signedPayload.apiKey);
    formData.append("timestamp", String(signedPayload.timestamp));
    formData.append("signature", signedPayload.signature);
    formData.append("folder", signedPayload.folder);

    if (signedPayload.deliveryType === "authenticated") {
      formData.append("type", "authenticated");
    }

    const xhr = new XMLHttpRequest();
    xhr.open("POST", signedPayload.uploadUrl);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const progress = Math.round((event.loaded / event.total) * 100);
      onProgress(progress);
    };

    xhr.onerror = () => reject(new Error("Network error while uploading to Cloudinary"));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const parsed = JSON.parse(xhr.responseText) as CloudinaryUploadResponse;
          resolve(parsed);
        } catch {
          reject(new Error("Invalid Cloudinary upload response"));
        }
        return;
      }
      reject(new Error(parseCloudinaryError(xhr.responseText)));
    };

    xhr.send(formData);
  });
}

function upsertAssetByType(prev: UploadedAsset[], nextAsset: UploadedAsset) {
  const existingIndex = prev.findIndex((asset) => asset.assetType === nextAsset.assetType);
  if (existingIndex < 0) {
    return [...prev, nextAsset];
  }
  const next = [...prev];
  next[existingIndex] = nextAsset;
  return next;
}

function uploadStatusLabel(item: UploadQueueItem) {
  if (item.phase === "queued") return "Queued";
  if (item.phase === "signing") return "Signing";
  if (item.phase === "uploading") return `Uploading ${item.progress}%`;
  if (item.phase === "committing") return "Committing";
  if (item.phase === "done") return "Uploaded";
  return item.error ?? "Failed";
}

function uploadStatusVariant(item: UploadQueueItem): "neutral" | "accent" | "success" | "destructive" {
  if (item.phase === "done") return "success";
  if (item.phase === "error") return "destructive";
  if (item.phase === "queued") return "neutral";
  return "accent";
}

function FileDropzone({
  title,
  subtitle,
  accept,
  multiple,
  onFiles,
  disabled,
}: {
  title: string;
  subtitle: string;
  accept: string;
  multiple: boolean;
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleFiles(files: File[]) {
    if (disabled || files.length === 0) return;
    onFiles(files);
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        handleFiles(Array.from(event.dataTransfer.files));
      }}
      className={`rounded-2xl border border-dashed p-4 transition ${
        isDragging ? "border-[var(--accent)] bg-[var(--accent-soft)]/40" : "border-[var(--border)] bg-white/70"
      }`}
    >
      <p className="text-sm font-medium text-[var(--text-primary)]">{title}</p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">{subtitle}</p>
      <div className="mt-3">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(event) => {
            handleFiles(Array.from(event.target.files ?? []));
            event.currentTarget.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          Select File{multiple ? "s" : ""}
        </Button>
      </div>
    </div>
  );
}

function UploadPreview({ item }: { item: UploadQueueItem }) {
  if (item.file.type.startsWith("image/")) {
    return (
      <Image
        src={item.previewUrl}
        alt={item.file.name}
        width={64}
        height={64}
        unoptimized
        className="h-16 w-16 rounded-lg border border-[var(--border)] object-cover"
      />
    );
  }

  if (item.file.type === "application/pdf") {
    return (
      <iframe
        src={`${item.previewUrl}#toolbar=0&navpanes=0&scrollbar=0`}
        title={item.file.name}
        className="h-16 w-16 rounded-lg border border-[var(--border)] bg-white"
      />
    );
  }

  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] text-[10px] text-[var(--text-muted)]">
      FILE
    </div>
  );
}

export function OnboardingWizard({ user }: OnboardingWizardProps) {
  const router = useRouter();
  const [status, setStatus] = useState<OnboardingStatusResponse | null>(null);
  const [ownerProfile, setOwnerProfile] = useState(initialOwnerProfile);
  const [property, setProperty] = useState(initialProperty);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const previewUrlsRef = useRef<Set<string>>(new Set());

  const [kycType, setKycType] = useState<MediaAssetType>(MediaAssetType.GSTIN_DOC);
  const [kycQueue, setKycQueue] = useState<UploadQueueItem[]>([]);
  const [kycAssets, setKycAssets] = useState<UploadedAsset[]>([]);

  const [mediaType, setMediaType] = useState<MediaAssetType>(MediaAssetType.PROPERTY_IMAGE);
  const [mediaQueue, setMediaQueue] = useState<UploadQueueItem[]>([]);
  const [mediaAssets, setMediaAssets] = useState<UploadedAsset[]>([]);

  function registerPreviewUrl(url: string) {
    previewUrlsRef.current.add(url);
  }

  function revokePreviewUrl(url: string) {
    if (url.startsWith("blob:")) {
      URL.revokeObjectURL(url);
    }
    previewUrlsRef.current.delete(url);
  }

  useEffect(() => {
    const urlsRef = previewUrlsRef;
    return () => {
      urlsRef.current.forEach((url) => {
        if (url.startsWith("blob:")) {
          URL.revokeObjectURL(url);
        }
      });
      urlsRef.current.clear();
    };
  }, []);

  async function refreshStatus() {
    const response = await fetch("/api/onboarding/status");
    const data = (await response.json()) as OnboardingStatusResponse;
    setStatus(data);
  }

  useEffect(() => {
    void refreshStatus();
  }, []);

  async function runAction(action: string, fn: () => Promise<void>) {
    setLoadingAction(action);
    try {
      await fn();
      await refreshStatus();
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : "Request failed");
    } finally {
      setLoadingAction(null);
    }
  }

  function updateQueueItem(target: "kyc" | "media", itemId: string, patch: Partial<UploadQueueItem>) {
    const setQueue = target === "kyc" ? setKycQueue : setMediaQueue;
    setQueue((prev) => prev.map((item) => (item.id === itemId ? { ...item, ...patch } : item)));
  }

  async function deleteUploadedAsset(assetId: string) {
    const response = await fetch(`/api/uploads/${assetId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? "Failed to delete uploaded asset");
    }
  }

  async function startUpload(target: "kyc" | "media", item: UploadQueueItem) {
    try {
      if (!item.file.type) {
        throw new Error("Unable to detect file type. Use PNG/JPG/WEBP/PDF files.");
      }

      updateQueueItem(target, item.id, {
        phase: "signing",
        progress: 5,
        error: undefined,
      });

      const signResponse = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerId: user.id,
          assetType: item.assetType,
          mimeType: item.file.type,
          bytes: item.file.size,
        }),
      });

      if (!signResponse.ok) {
        const data = (await signResponse.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to sign upload request");
      }

      const signedPayload = (await signResponse.json()) as SignedUploadPayload;

      updateQueueItem(target, item.id, {
        phase: "uploading",
        progress: 8,
      });

      const cloudinary = await uploadToCloudinary(item.file, signedPayload, (progress) => {
        updateQueueItem(target, item.id, {
          phase: "uploading",
          progress,
        });
      });

      updateQueueItem(target, item.id, {
        phase: "committing",
        progress: 100,
      });

      const commitResponse = await fetch("/api/uploads/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerId: user.id,
          assetType: item.assetType,
          cloudinaryPublicId: cloudinary.public_id,
          secureUrl: cloudinary.secure_url,
          version: cloudinary.version,
          bytes: cloudinary.bytes,
          mimeType: item.file.type,
          metadata: {
            originalFileName: item.file.name,
            source: "onboarding-direct-upload",
          },
        }),
      });

      if (!commitResponse.ok) {
        const data = (await commitResponse.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to commit uploaded asset");
      }

      const asset = (await commitResponse.json()) as CommitUploadResponse;
      const uploadedAsset: UploadedAsset = {
        id: asset.id,
        assetType: asset.assetType,
        cloudinaryPublicId: asset.cloudinaryPublicId,
        secureUrl: asset.secureUrl,
        fileName: item.file.name,
      };

      if (target === "kyc") {
        setKycAssets((prev) => upsertAssetByType(prev, uploadedAsset));
      } else {
        setMediaAssets((prev) => {
          const existingIndex = prev.findIndex((value) => value.id === uploadedAsset.id);
          if (existingIndex < 0) {
            return [...prev, uploadedAsset];
          }
          const next = [...prev];
          next[existingIndex] = uploadedAsset;
          return next;
        });
      }

      updateQueueItem(target, item.id, {
        phase: "done",
        progress: 100,
        committedAssetId: uploadedAsset.id,
      });
    } catch (uploadError) {
      updateQueueItem(target, item.id, {
        phase: "error",
        error: uploadError instanceof Error ? uploadError.message : "Upload failed",
      });
    }
  }

  async function removeUpload(target: "kyc" | "media", item: UploadQueueItem) {
    if (item.isDeleting) return;

    updateQueueItem(target, item.id, { isDeleting: true });

    try {
      if (item.committedAssetId) {
        await deleteUploadedAsset(item.committedAssetId);
      }
    } catch (removeError) {
      updateQueueItem(target, item.id, { isDeleting: false });
      toast.error(removeError instanceof Error ? removeError.message : "Failed to remove file");
      return;
    }

    revokePreviewUrl(item.previewUrl);

    if (target === "kyc") {
      setKycQueue((prev) => prev.filter((value) => value.id !== item.id));
      if (item.committedAssetId) {
        setKycAssets((prev) => prev.filter((value) => value.id !== item.committedAssetId));
      }
      return;
    }

    setMediaQueue((prev) => prev.filter((value) => value.id !== item.id));
    if (item.committedAssetId) {
      setMediaAssets((prev) => prev.filter((value) => value.id !== item.committedAssetId));
    }
  }

  function enqueueKyc(files: File[]) {
    if (files.length === 0) return;
    const file = files[0];
    const url = URL.createObjectURL(file);
    registerPreviewUrl(url);

    const replacing = kycQueue.filter((value) => value.assetType === kycType);
    replacing.forEach((item) => {
      revokePreviewUrl(item.previewUrl);
      if (item.committedAssetId) {
        void deleteUploadedAsset(item.committedAssetId).catch(() => undefined);
      }
    });

    const removedAssetIds = new Set(
      replacing
        .map((item) => item.committedAssetId)
        .filter((value): value is string => Boolean(value)),
    );

    const item: UploadQueueItem = {
      id: makeId(),
      file,
      previewUrl: url,
      assetType: kycType,
      phase: "queued",
      progress: 0,
    };

    setKycAssets((prev) =>
      prev.filter((asset) => asset.assetType !== kycType && !removedAssetIds.has(asset.id)),
    );
    setKycQueue((prev) => [...prev.filter((value) => value.assetType !== kycType), item]);
    void startUpload("kyc", item);
  }

  function enqueueMedia(files: File[]) {
    if (files.length === 0) return;

    const items: UploadQueueItem[] = files.map((file) => {
      const url = URL.createObjectURL(file);
      registerPreviewUrl(url);
      return {
        id: makeId(),
        file,
        previewUrl: url,
        assetType: mediaType,
        phase: "queued",
        progress: 0,
      };
    });

    setMediaQueue((prev) => [...prev, ...items]);
    items.forEach((item) => {
      void startUpload("media", item);
    });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-4 px-4 py-8">
      <Card className="space-y-3">
        <div>
          <p className="font-serif text-3xl text-[var(--text-primary)]">SyncStay Onboarding</p>
          <CardDescription>
            Complete owner and property registration to unlock dashboard access.
          </CardDescription>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="warning">Status: {status?.ownerOnboarding?.status ?? user.status}</Badge>
          <span className="text-xs text-[var(--text-muted)]">
            Account: {user.name} ({user.email})
          </span>
        </div>

        {status?.ownerOnboarding?.rejectionReason ? (
          <p className="rounded-xl border border-[var(--error)]/30 bg-[var(--error-soft)] px-3 py-2 text-sm text-[var(--error)]">
            Rejected: {status.ownerOnboarding.rejectionReason}
          </p>
        ) : null}

      </Card>

      <Card className="space-y-3">
        <CardTitle>1. Owner Profile + KYC</CardTitle>
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            placeholder="Legal business name"
            value={ownerProfile.legalBusinessName}
            onChange={(event) =>
              setOwnerProfile((prev) => ({ ...prev, legalBusinessName: event.target.value }))
            }
          />
          <Input
            placeholder="GSTIN"
            value={ownerProfile.gstin}
            onChange={(event) => setOwnerProfile((prev) => ({ ...prev, gstin: event.target.value }))}
          />
          <Input
            placeholder="PAN"
            value={ownerProfile.pan}
            onChange={(event) => setOwnerProfile((prev) => ({ ...prev, pan: event.target.value }))}
          />
          <Input
            placeholder="Contact phone"
            value={ownerProfile.contactPhone}
            onChange={(event) =>
              setOwnerProfile((prev) => ({ ...prev, contactPhone: event.target.value }))
            }
          />
          <Input
            placeholder="Address line 1"
            value={ownerProfile.addressLine1}
            onChange={(event) =>
              setOwnerProfile((prev) => ({ ...prev, addressLine1: event.target.value }))
            }
          />
          <Input
            placeholder="City"
            value={ownerProfile.city}
            onChange={(event) => setOwnerProfile((prev) => ({ ...prev, city: event.target.value }))}
          />
          <Input
            placeholder="State"
            value={ownerProfile.state}
            onChange={(event) => setOwnerProfile((prev) => ({ ...prev, state: event.target.value }))}
          />
          <Input
            placeholder="Postal code"
            value={ownerProfile.postalCode}
            onChange={(event) =>
              setOwnerProfile((prev) => ({ ...prev, postalCode: event.target.value }))
            }
          />
        </div>

        <div className="grid gap-2 md:grid-cols-[1fr_2fr]">
          <select
            className="h-10 rounded-xl border border-[var(--border)] bg-white px-3 text-sm"
            value={kycType}
            onChange={(event) => setKycType(event.target.value as MediaAssetType)}
          >
            <option value="GSTIN_DOC">GSTIN Doc</option>
            <option value="PAN_DOC">PAN Doc</option>
            <option value="TRADE_LICENSE_DOC">Trade License</option>
            <option value="ADDRESS_PROOF_DOC">Address Proof</option>
          </select>
          <FileDropzone
            title={`Drop ${toAssetLabel(kycType)} here`}
            subtitle="One file per KYC type. New upload for the same type replaces the previous one."
            accept=".pdf,image/png,image/jpeg"
            multiple={false}
            onFiles={enqueueKyc}
            disabled={loadingAction === "owner" || loadingAction === "submit"}
          />
        </div>

        {kycQueue.length > 0 ? (
          <div className="space-y-2">
            {kycQueue.map((item) => (
              <div key={item.id} className="space-y-2 rounded-xl border border-[var(--border)] bg-white/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <UploadPreview item={item} />
                    <div className="flex flex-col gap-1">
                      <span className="max-w-[14rem] truncate text-sm text-[var(--text-primary)]">{item.file.name}</span>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="neutral">{toAssetLabel(item.assetType)}</Badge>
                        <Badge variant={uploadStatusVariant(item)}>{uploadStatusLabel(item)}</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.phase === "error" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={item.isDeleting}
                        onClick={() => void startUpload("kyc", { ...item, phase: "queued", progress: 0 })}
                      >
                        Retry
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={item.isDeleting || ["signing", "uploading", "committing"].includes(item.phase)}
                      onClick={() => void removeUpload("kyc", item)}
                    >
                      {item.isDeleting ? "Removing..." : "Remove"}
                    </Button>
                  </div>
                </div>
                {item.file.type === "application/pdf" ? (
                  <a
                    href={item.previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[var(--accent)] underline-offset-2 hover:underline"
                  >
                    Open PDF Preview
                  </a>
                ) : null}
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--border)]">
                  <div
                    className={`h-full transition-all duration-200 ${
                      item.phase === "error" ? "bg-[var(--error)]" : "bg-[var(--accent)]"
                    }`}
                    style={{ width: `${Math.max(3, Math.min(100, item.progress))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <Button
          onClick={() =>
            void runAction("owner", async () => {
              const response = await fetch("/api/onboarding/owner", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ...ownerProfile,
                  kycAssetIds: kycAssets.map((asset) => asset.id),
                }),
              });
              if (!response.ok) {
                const data = (await response.json().catch(() => null)) as unknown;
                throw new Error(extractApiErrorMessage(data, "Unable to save owner profile"));
              }
              toast.success("Owner profile saved.");
            })
          }
          disabled={loadingAction === "owner"}
        >
          Save Owner Profile
        </Button>

        {status?.missingKycAssets?.length ? (
          <p className="text-xs text-[var(--warning)]">
            Missing KYC docs: {status.missingKycAssets.join(", ")}
          </p>
        ) : null}
      </Card>

      <Card className="space-y-3">
        <CardTitle>2. Property Registration</CardTitle>
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            placeholder="Legal property name"
            value={property.legalPropertyName}
            onChange={(event) =>
              setProperty((prev) => ({ ...prev, legalPropertyName: event.target.value }))
            }
          />
          <Input
            placeholder="Display name"
            value={property.displayName}
            onChange={(event) => setProperty((prev) => ({ ...prev, displayName: event.target.value }))}
          />
          <Input
            placeholder="Address line 1"
            value={property.addressLine1}
            onChange={(event) => setProperty((prev) => ({ ...prev, addressLine1: event.target.value }))}
          />
          <Input
            placeholder="City"
            value={property.city}
            onChange={(event) => setProperty((prev) => ({ ...prev, city: event.target.value }))}
          />
          <Input
            placeholder="State"
            value={property.state}
            onChange={(event) => setProperty((prev) => ({ ...prev, state: event.target.value }))}
          />
          <Input
            placeholder="Postal code"
            value={property.postalCode}
            onChange={(event) => setProperty((prev) => ({ ...prev, postalCode: event.target.value }))}
          />
          <Input
            placeholder="Property contact email"
            value={property.contactEmail}
            onChange={(event) => setProperty((prev) => ({ ...prev, contactEmail: event.target.value }))}
          />
          <Input
            placeholder="Property contact phone"
            value={property.contactPhone}
            onChange={(event) => setProperty((prev) => ({ ...prev, contactPhone: event.target.value }))}
          />
        </div>

        <div className="grid gap-2 md:grid-cols-[1fr_2fr]">
          <select
            className="h-10 rounded-xl border border-[var(--border)] bg-white px-3 text-sm"
            value={mediaType}
            onChange={(event) => setMediaType(event.target.value as MediaAssetType)}
          >
            <option value="PROPERTY_IMAGE">Property Image</option>
            <option value="PROPERTY_LOGO">Property Logo</option>
          </select>
          <FileDropzone
            title={`Drop ${toAssetLabel(mediaType)} files`}
            subtitle="Supports multi-file drag and drop."
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            multiple
            onFiles={enqueueMedia}
            disabled={loadingAction === "property" || loadingAction === "submit"}
          />
        </div>

        {mediaQueue.length > 0 ? (
          <div className="space-y-2">
            {mediaQueue.map((item) => (
              <div key={item.id} className="space-y-2 rounded-xl border border-[var(--border)] bg-white/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <UploadPreview item={item} />
                    <div className="flex flex-col gap-1">
                      <span className="max-w-[14rem] truncate text-sm text-[var(--text-primary)]">{item.file.name}</span>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="neutral">{toAssetLabel(item.assetType)}</Badge>
                        <Badge variant={uploadStatusVariant(item)}>{uploadStatusLabel(item)}</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.phase === "error" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={item.isDeleting}
                        onClick={() => void startUpload("media", { ...item, phase: "queued", progress: 0 })}
                      >
                        Retry
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={item.isDeleting || ["signing", "uploading", "committing"].includes(item.phase)}
                      onClick={() => void removeUpload("media", item)}
                    >
                      {item.isDeleting ? "Removing..." : "Remove"}
                    </Button>
                  </div>
                </div>
                {item.file.type === "application/pdf" ? (
                  <a
                    href={item.previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[var(--accent)] underline-offset-2 hover:underline"
                  >
                    Open PDF Preview
                  </a>
                ) : null}
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--border)]">
                  <div
                    className={`h-full transition-all duration-200 ${
                      item.phase === "error" ? "bg-[var(--error)]" : "bg-[var(--accent)]"
                    }`}
                    style={{ width: `${Math.max(3, Math.min(100, item.progress))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <Button
          onClick={() =>
            void runAction("property", async () => {
              const response = await fetch("/api/onboarding/property", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ...property,
                  mediaAssetIds: mediaAssets.map((asset) => asset.id),
                }),
              });
              if (!response.ok) {
                const data = (await response.json().catch(() => null)) as unknown;
                throw new Error(extractApiErrorMessage(data, "Unable to save property"));
              }
              toast.success("Property registration saved.");
            })
          }
          disabled={loadingAction === "property"}
        >
          Save Property
        </Button>
      </Card>

      <Card className="space-y-3">
        <CardTitle>3. Submit For Review</CardTitle>
        <CardDescription>
          Once submitted, a master admin reviews and approves your onboarding.
        </CardDescription>

        <div className="flex flex-wrap gap-2">
          <Button
            disabled={loadingAction === "submit"}
            onClick={() =>
              void runAction("submit", async () => {
                const response = await fetch("/api/onboarding/submit", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ confirmSubmission: true }),
                });
                const data = (await response.json()) as { error?: string };
                if (!response.ok) {
                  throw new Error(data.error ?? "Unable to submit onboarding");
                }
                toast.success("Submitted successfully. Waiting for admin review.");
                router.push("/onboarding/pending");
              })
            }
          >
            Submit Onboarding
          </Button>

          <Button variant="outline" onClick={() => void refreshStatus()}>
            Refresh Status
          </Button>

          <Button variant="ghost" onClick={() => router.push("/auth/sign-in?verifyRequired=1")}>
            Back to Sign In
          </Button>
        </div>

        {status?.ownerOnboarding?.status === OnboardingStatus.APPROVED ? (
          <Button onClick={() => router.push("/dashboard")}>Go to Dashboard</Button>
        ) : null}
      </Card>
    </main>
  );
}
