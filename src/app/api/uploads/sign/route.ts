import { NextRequest, NextResponse } from "next/server";

import { canAccessHotel } from "@/lib/authorization";
import { buildSignedUploadPayload, validateUploadConstraints } from "@/lib/cloudinary";
import { uploadSignSchema } from "@/lib/contracts";
import { consumeRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  const rateLimitDecision = consumeRateLimit({
    scope: "upload:sign",
    identifier: getRateLimitIdentifier(request),
    limit: 60,
    windowMs: 10 * 60 * 1000,
  });

  if (!rateLimitDecision.allowed) {
    return NextResponse.json(
      { error: "Too many upload sign requests. Please retry shortly." },
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
  const parsed = uploadSignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    validateUploadConstraints({
      assetType: parsed.data.assetType,
      mimeType: parsed.data.mimeType,
      bytes: parsed.data.bytes,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid upload constraints" },
      { status: 400 },
    );
  }

  if (parsed.data.ownerId && parsed.data.ownerId !== authResult.domainUser.id) {
    return NextResponse.json({ error: "Invalid owner scope" }, { status: 403 });
  }

  if (parsed.data.hotelId) {
    const access = await canAccessHotel(authResult.domainUser, parsed.data.hotelId);
    if (!access) {
      return NextResponse.json({ error: "Forbidden hotel scope" }, { status: 403 });
    }
  }

  try {
    const signed = buildSignedUploadPayload({
      ownerId: parsed.data.ownerId ?? authResult.domainUser.id,
      hotelId: parsed.data.hotelId,
      assetType: parsed.data.assetType,
    });
    return NextResponse.json(signed);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to sign upload request" },
      { status: 400 },
    );
  }
}
