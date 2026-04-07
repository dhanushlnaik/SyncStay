import { createHash } from "node:crypto";

import { IdempotencyStatus, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export function getIdempotencyKeyFromRequest(request: NextRequest) {
  return request.headers.get("idempotency-key")?.trim() ?? "";
}

function stableHash(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export async function withIdempotency(options: {
  request: NextRequest;
  userId: string;
  route: string;
  method: string;
  payload: unknown;
  execute: () => Promise<NextResponse>;
}) {
  const key = getIdempotencyKeyFromRequest(options.request);
  if (!key) {
    return NextResponse.json(
      {
        error: "Missing Idempotency-Key header",
      },
      { status: 400 },
    );
  }

  const requestHash = stableHash(options.payload);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const existing = await prisma.idempotencyKey.findUnique({
    where: {
      key_userId: {
        key,
        userId: options.userId,
      },
    },
  });

  if (existing) {
    if (existing.requestHash !== requestHash) {
      return NextResponse.json(
        {
          error: "Idempotency key reuse with different payload",
        },
        { status: 409 },
      );
    }

    if (existing.status === IdempotencyStatus.COMPLETED) {
      return NextResponse.json(existing.responseBody ?? {}, {
        status: existing.responseCode ?? 200,
      });
    }

    if (existing.status === IdempotencyStatus.PROCESSING) {
      return NextResponse.json(
        {
          error: "Request with this idempotency key is already processing",
        },
        { status: 409 },
      );
    }
  } else {
    await prisma.idempotencyKey.create({
      data: {
        key,
        userId: options.userId,
        route: options.route,
        method: options.method,
        requestHash,
        status: IdempotencyStatus.PROCESSING,
        expiresAt,
      },
    });
  }

  try {
    const response = await options.execute();
    const rawBody = (await response.clone().json().catch(() => ({}))) as Prisma.JsonValue;
    const responseBody = (rawBody ?? Prisma.JsonNull) as Prisma.InputJsonValue;

    await prisma.idempotencyKey.update({
      where: {
        key_userId: {
          key,
          userId: options.userId,
        },
      },
      data: {
        status: IdempotencyStatus.COMPLETED,
        responseCode: response.status,
        responseBody,
        expiresAt,
      },
    });

    return response;
  } catch (error) {
    await prisma.idempotencyKey.updateMany({
      where: {
        key,
        userId: options.userId,
      },
      data: {
        status: IdempotencyStatus.FAILED,
        responseCode: 500,
        responseBody: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
        expiresAt,
      },
    });

    throw error;
  }
}
