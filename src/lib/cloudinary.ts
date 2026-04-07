import { createHash } from "node:crypto";

import { MediaAssetType, MediaVisibility } from "@prisma/client";

import { env } from "@/lib/env";

const KYC_ASSET_TYPES = new Set<MediaAssetType>([
  MediaAssetType.GSTIN_DOC,
  MediaAssetType.PAN_DOC,
  MediaAssetType.TRADE_LICENSE_DOC,
  MediaAssetType.ADDRESS_PROOF_DOC,
]);

const ASSET_RULES: Record<
  MediaAssetType,
  {
    mimeTypes: string[];
    maxBytes: number;
  }
> = {
  [MediaAssetType.PROPERTY_LOGO]: {
    mimeTypes: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
    maxBytes: 5 * 1024 * 1024,
  },
  [MediaAssetType.PROPERTY_IMAGE]: {
    mimeTypes: ["image/png", "image/jpeg", "image/webp"],
    maxBytes: 10 * 1024 * 1024,
  },
  [MediaAssetType.GSTIN_DOC]: {
    mimeTypes: ["application/pdf", "image/png", "image/jpeg"],
    maxBytes: 12 * 1024 * 1024,
  },
  [MediaAssetType.PAN_DOC]: {
    mimeTypes: ["application/pdf", "image/png", "image/jpeg"],
    maxBytes: 12 * 1024 * 1024,
  },
  [MediaAssetType.TRADE_LICENSE_DOC]: {
    mimeTypes: ["application/pdf", "image/png", "image/jpeg"],
    maxBytes: 12 * 1024 * 1024,
  },
  [MediaAssetType.ADDRESS_PROOF_DOC]: {
    mimeTypes: ["application/pdf", "image/png", "image/jpeg"],
    maxBytes: 12 * 1024 * 1024,
  },
};

export type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

type CloudinaryResourceType = "image" | "raw" | "video";
type CloudinaryDeliveryType = "upload" | "authenticated" | "private";

export function parseCloudinaryUrl(url = env.CLOUDINARY_URL): CloudinaryConfig {
  if (!url) {
    throw new Error("CLOUDINARY_URL is required");
  }

  const parsed = new URL(url);
  if (parsed.protocol !== "cloudinary:") {
    throw new Error("Invalid CLOUDINARY_URL protocol");
  }

  const cloudName = parsed.hostname;
  const apiKey = decodeURIComponent(parsed.username);
  const apiSecret = decodeURIComponent(parsed.password);

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("CLOUDINARY_URL missing required credentials");
  }

  return {
    cloudName,
    apiKey,
    apiSecret,
  };
}

export function resolveAssetVisibility(assetType: MediaAssetType): MediaVisibility {
  return KYC_ASSET_TYPES.has(assetType) ? MediaVisibility.PRIVATE : MediaVisibility.PUBLIC;
}

export function validateUploadConstraints(input: {
  assetType: MediaAssetType;
  mimeType: string;
  bytes: number;
}) {
  const rule = ASSET_RULES[input.assetType];

  if (!rule) {
    throw new Error("Unsupported asset type");
  }

  if (!rule.mimeTypes.includes(input.mimeType)) {
    throw new Error(`Unsupported mimeType for ${input.assetType}`);
  }

  if (input.bytes <= 0 || input.bytes > rule.maxBytes) {
    throw new Error(`File size exceeds limit for ${input.assetType}`);
  }
}

function signCloudinaryParams(params: Record<string, string>, apiSecret: string) {
  const toSign = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return createHash("sha1")
    .update(`${toSign}${apiSecret}`)
    .digest("hex");
}

function inferCloudinaryTargetFromSecureUrl(
  secureUrl: string,
  cloudName: string,
): { resourceType: CloudinaryResourceType; deliveryType: CloudinaryDeliveryType } | null {
  try {
    const parsed = new URL(secureUrl);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const cloudIndex = parts.findIndex((part) => part === cloudName);
    const start = cloudIndex >= 0 ? cloudIndex + 1 : 0;
    const resourceType = parts[start];
    const deliveryType = parts[start + 1];

    const validResourceTypes = new Set<CloudinaryResourceType>(["image", "raw", "video"]);
    const validDeliveryTypes = new Set<CloudinaryDeliveryType>([
      "upload",
      "authenticated",
      "private",
    ]);

    if (
      validResourceTypes.has(resourceType as CloudinaryResourceType) &&
      validDeliveryTypes.has(deliveryType as CloudinaryDeliveryType)
    ) {
      return {
        resourceType: resourceType as CloudinaryResourceType,
        deliveryType: deliveryType as CloudinaryDeliveryType,
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function buildSignedUploadPayload(input: {
  hotelId?: string;
  ownerId?: string;
  assetType: MediaAssetType;
}) {
  const { cloudName, apiKey, apiSecret } = parseCloudinaryUrl();
  const now = Math.floor(Date.now() / 1000);

  const scopeId = input.hotelId ?? input.ownerId;
  if (!scopeId) {
    throw new Error("hotelId or ownerId is required");
  }

  const scopeType = input.hotelId ? "hotel" : "owner";
  const folder =
    scopeType === "hotel"
      ? `syncstay/${process.env.NODE_ENV ?? "development"}/${scopeId}/media`
      : `syncstay/${process.env.NODE_ENV ?? "development"}/${scopeId}/kyc`;

  const params: Record<string, string> = {
    folder,
    timestamp: String(now),
  };

  const visibility = resolveAssetVisibility(input.assetType);
  if (visibility === MediaVisibility.PRIVATE) {
    params.type = "authenticated";
  }

  const signature = signCloudinaryParams(params, apiSecret);

  return {
    cloudName,
    apiKey,
    timestamp: now,
    signature,
    folder,
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
    deliveryType: visibility === MediaVisibility.PRIVATE ? "authenticated" : "upload",
  };
}

async function destroyCloudinaryAssetAttempt(input: {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  publicId: string;
  resourceType: CloudinaryResourceType;
  deliveryType: CloudinaryDeliveryType;
}) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signatureParams: Record<string, string> = {
    public_id: input.publicId,
    timestamp: String(timestamp),
    invalidate: "true",
  };

  if (input.deliveryType !== "upload") {
    signatureParams.type = input.deliveryType;
  }

  const signature = signCloudinaryParams(signatureParams, input.apiSecret);
  const bodyParams = new URLSearchParams({
    public_id: input.publicId,
    api_key: input.apiKey,
    timestamp: String(timestamp),
    invalidate: "true",
    signature,
  });

  if (input.deliveryType !== "upload") {
    bodyParams.set("type", input.deliveryType);
  }

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${input.cloudName}/${input.resourceType}/destroy`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: bodyParams.toString(),
    },
  );

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Cloudinary destroy failed (${response.status}): ${text}`);
  }

  let parsed: { result?: string; error?: { message?: string } } = {};
  try {
    parsed = JSON.parse(text) as { result?: string; error?: { message?: string } };
  } catch {
    throw new Error("Cloudinary destroy returned invalid JSON");
  }

  if (parsed.error?.message) {
    throw new Error(parsed.error.message);
  }

  if (parsed.result === "ok" || parsed.result === "not found") {
    return;
  }

  throw new Error(`Unexpected Cloudinary destroy result: ${parsed.result ?? "unknown"}`);
}

export async function destroyCloudinaryAsset(input: {
  publicId: string;
  secureUrl?: string | null;
  visibility?: MediaVisibility;
}) {
  const { cloudName, apiKey, apiSecret } = parseCloudinaryUrl();
  const attempts: Array<{ resourceType: CloudinaryResourceType; deliveryType: CloudinaryDeliveryType }> =
    [];
  const seen = new Set<string>();

  function addAttempt(resourceType: CloudinaryResourceType, deliveryType: CloudinaryDeliveryType) {
    const key = `${resourceType}:${deliveryType}`;
    if (seen.has(key)) return;
    seen.add(key);
    attempts.push({ resourceType, deliveryType });
  }

  const inferred = input.secureUrl ? inferCloudinaryTargetFromSecureUrl(input.secureUrl, cloudName) : null;
  if (inferred) {
    addAttempt(inferred.resourceType, inferred.deliveryType);
  }

  if (input.visibility === MediaVisibility.PRIVATE) {
    addAttempt("raw", "authenticated");
    addAttempt("image", "authenticated");
    addAttempt("raw", "private");
    addAttempt("image", "private");
  } else {
    addAttempt("image", "upload");
    addAttempt("raw", "upload");
  }

  if (attempts.length === 0) {
    addAttempt("image", "upload");
  }

  let lastError: Error | null = null;
  for (const attempt of attempts) {
    try {
      await destroyCloudinaryAssetAttempt({
        cloudName,
        apiKey,
        apiSecret,
        publicId: input.publicId,
        resourceType: attempt.resourceType,
        deliveryType: attempt.deliveryType,
      });
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown Cloudinary destroy error");
    }
  }

  throw lastError ?? new Error("Unable to destroy Cloudinary asset");
}
