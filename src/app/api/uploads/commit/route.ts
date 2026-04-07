import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { canAccessHotel } from "@/lib/authorization";
import { resolveAssetVisibility } from "@/lib/cloudinary";
import { uploadCommitSchema } from "@/lib/contracts";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  const rateLimitDecision = consumeRateLimit({
    scope: "upload:commit",
    identifier: getRateLimitIdentifier(request),
    limit: 120,
    windowMs: 10 * 60 * 1000,
  });

  if (!rateLimitDecision.allowed) {
    return NextResponse.json(
      { error: "Too many upload commit requests. Please retry shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": `${Math.ceil(rateLimitDecision.retryAfterMs / 1000)}`,
        },
      },
    );
  }

  const authResult = await requireSession({
    allowUnapproved: true,
  });

  if ("error" in authResult) {
    return authResult.error;
  }

  const body = await request.json();
  const parsed = uploadCommitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const ownerId = parsed.data.ownerId ?? authResult.domainUser.id;
  if (ownerId !== authResult.domainUser.id) {
    return NextResponse.json({ error: "Invalid owner scope" }, { status: 403 });
  }

  if (parsed.data.hotelId) {
    const access = await canAccessHotel(authResult.domainUser, parsed.data.hotelId);
    if (!access) {
      return NextResponse.json({ error: "Forbidden hotel scope" }, { status: 403 });
    }
  }

  const asset = await prisma.mediaAsset.upsert({
    where: {
      cloudinaryPublicId: parsed.data.cloudinaryPublicId,
    },
    update: {
      ownerId,
      hotelId: parsed.data.hotelId,
      propertyRegistrationId: parsed.data.propertyRegistrationId,
      assetType: parsed.data.assetType,
      visibility: resolveAssetVisibility(parsed.data.assetType),
      secureUrl: parsed.data.secureUrl,
      version: parsed.data.version,
      bytes: parsed.data.bytes,
      mimeType: parsed.data.mimeType,
      metadata: parsed.data.metadata as Prisma.InputJsonValue | undefined,
    },
    create: {
      ownerId,
      hotelId: parsed.data.hotelId,
      propertyRegistrationId: parsed.data.propertyRegistrationId,
      assetType: parsed.data.assetType,
      visibility: resolveAssetVisibility(parsed.data.assetType),
      cloudinaryPublicId: parsed.data.cloudinaryPublicId,
      secureUrl: parsed.data.secureUrl,
      version: parsed.data.version,
      bytes: parsed.data.bytes,
      mimeType: parsed.data.mimeType,
      metadata: parsed.data.metadata as Prisma.InputJsonValue | undefined,
    },
  });

  return NextResponse.json(asset, { status: 201 });
}
