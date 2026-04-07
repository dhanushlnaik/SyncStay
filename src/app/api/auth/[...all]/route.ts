import { toNextJsHandler } from "better-auth/next-js";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { consumeRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit";

const handlers = toNextJsHandler(auth);

function limited(scope: string, limit: number, windowMs: number) {
  return (request: Request) => {
    const identifier = getRateLimitIdentifier(request);
    const decision = consumeRateLimit({
      scope,
      identifier,
      limit,
      windowMs,
    });

    if (!decision.allowed) {
      return NextResponse.json(
        {
          error: "Too many requests. Please retry shortly.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": `${Math.ceil(decision.retryAfterMs / 1000)}`,
          },
        },
      );
    }

    return null;
  };
}

const limitRead = limited("auth:read", 120, 60_000);
const limitWrite = limited("auth:write", 30, 60_000);

export async function GET(request: Request) {
  const blocked = limitRead(request);
  if (blocked) {
    return blocked;
  }
  return handlers.GET(request);
}

export async function POST(request: Request) {
  const blocked = limitWrite(request);
  if (blocked) {
    return blocked;
  }
  return handlers.POST(request);
}

export async function PUT(request: Request) {
  const blocked = limitWrite(request);
  if (blocked) {
    return blocked;
  }
  return handlers.PUT(request);
}

export async function PATCH(request: Request) {
  const blocked = limitWrite(request);
  if (blocked) {
    return blocked;
  }
  return handlers.PATCH(request);
}

export async function DELETE(request: Request) {
  const blocked = limitWrite(request);
  if (blocked) {
    return blocked;
  }
  return handlers.DELETE(request);
}
