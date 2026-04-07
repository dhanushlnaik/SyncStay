import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";

import { destroyCloudinaryAsset } from "@/lib/cloudinary";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function DELETE(
  _request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  const authResult = await requireSession({
    allowUnapproved: true,
  });

  if ("error" in authResult) {
    return authResult.error;
  }

  const { id } = await context.params;

  const asset = await prisma.mediaAsset.findUnique({
    where: { id },
    select: {
      id: true,
      ownerId: true,
      cloudinaryPublicId: true,
      secureUrl: true,
      visibility: true,
    },
  });

  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  const isAdmin = authResult.domainUser.role === UserRole.MASTER_ADMIN;
  if (!isAdmin && asset.ownerId !== authResult.domainUser.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await destroyCloudinaryAsset({
    publicId: asset.cloudinaryPublicId,
    secureUrl: asset.secureUrl,
    visibility: asset.visibility,
  });

  await prisma.mediaAsset.delete({
    where: { id: asset.id },
  });

  return NextResponse.json({ success: true });
}
