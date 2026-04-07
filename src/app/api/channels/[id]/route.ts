import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { canAccessHotel } from "@/lib/authorization";
import { channelPathSchema, channelUpdateSchema } from "@/lib/contracts";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function PATCH(
  request: NextRequest,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  const authResult = await requireSession();
  if ("error" in authResult) {
    return authResult.error;
  }

  const params = await context.params;
  const parsedParams = channelPathSchema.safeParse(params);

  if (!parsedParams.success) {
    return NextResponse.json({ error: parsedParams.error.flatten() }, { status: 400 });
  }

  const body = await request.json();
  const parsedBody = channelUpdateSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json({ error: parsedBody.error.flatten() }, { status: 400 });
  }

  const channel = await prisma.hotelPlatformConfig.findUnique({
    where: { id: parsedParams.data.id },
  });

  if (!channel) {
    return NextResponse.json({ error: "Channel config not found" }, { status: 404 });
  }

  const access = await canAccessHotel(authResult.domainUser, channel.hotelId);
  if (!access) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.hotelPlatformConfig.update({
    where: {
      id: channel.id,
    },
    data: {
      ...(parsedBody.data.isEnabled !== undefined ? { isEnabled: parsedBody.data.isEnabled } : {}),
      ...(parsedBody.data.status !== undefined ? { status: parsedBody.data.status } : {}),
      ...(parsedBody.data.endpointUrl !== undefined
        ? { endpointUrl: parsedBody.data.endpointUrl }
        : {}),
      ...(parsedBody.data.externalHotelId !== undefined
        ? { externalHotelId: parsedBody.data.externalHotelId }
        : {}),
      ...(parsedBody.data.apiKey !== undefined ? { apiKey: parsedBody.data.apiKey } : {}),
      ...(parsedBody.data.apiSecret !== undefined ? { apiSecret: parsedBody.data.apiSecret } : {}),
      ...(parsedBody.data.settings !== undefined
        ? { settings: parsedBody.data.settings as Prisma.InputJsonValue }
        : {}),
    },
  });

  return NextResponse.json(updated);
}
