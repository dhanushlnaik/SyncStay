import { NextRequest, NextResponse } from "next/server";

import { canAccessHotel } from "@/lib/authorization";
import { subscribeEvents } from "@/lib/events";
import { getUserScopedHotel } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toSseChunk(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(request: NextRequest) {
  const authResult = await requireSession();
  if ("error" in authResult) {
    return authResult.error;
  }

  const hotelIdQuery = request.nextUrl.searchParams.get("hotelId");
  let hotelId = hotelIdQuery;

  if (!hotelId) {
    const scopedHotel = await getUserScopedHotel(authResult.domainUser.id);
    if (!scopedHotel) {
      return NextResponse.json({ error: "No hotel assigned" }, { status: 404 });
    }
    hotelId = scopedHotel.id;
  }

  const access = await canAccessHotel(authResult.domainUser, hotelId);
  if (!access) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let lastSeen = new Date(Date.now() - 30_000);

      const unsubscribe = subscribeEvents((event) => {
        if (closed) {
          return;
        }

        controller.enqueue(encoder.encode(toSseChunk(event.type, event)));
      });

      const ticker = setInterval(async () => {
        if (closed) {
          return;
        }

        const logs = await prisma.syncLog.findMany({
          where: {
            hotelId,
            createdAt: {
              gt: lastSeen,
            },
          },
          orderBy: {
            createdAt: "asc",
          },
          take: 30,
        });

        for (const log of logs) {
          lastSeen = log.createdAt;
          controller.enqueue(
            encoder.encode(
              toSseChunk("sync.log.created", {
                type: "sync.log.created",
                timestamp: log.createdAt.toISOString(),
                payload: {
                  id: log.id,
                  status: log.status,
                  platform: log.platform,
                  action: log.action,
                  correlationId: log.correlationId,
                },
              }),
            ),
          );
        }

        controller.enqueue(
          encoder.encode(
            toSseChunk("heartbeat", {
              type: "heartbeat",
              timestamp: new Date().toISOString(),
              payload: { hotelId },
            }),
          ),
        );
      }, 2_500);

      request.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(ticker);
        unsubscribe();
        controller.close();
      });

      controller.enqueue(
        encoder.encode(
          toSseChunk("connected", {
            type: "connected",
            timestamp: new Date().toISOString(),
            payload: { hotelId },
          }),
        ),
      );
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
