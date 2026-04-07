import { Prisma, UserRole } from "@prisma/client";
import { subDays } from "date-fns";

import { getPlatformCapabilityLabels } from "@/lib/channel-capabilities";
import { prisma } from "@/lib/prisma";

export async function getUserScopedHotel(domainUserId: string) {
  const currentUser = await prisma.user.findUnique({
    where: { id: domainUserId },
    select: { role: true },
  });

  if (currentUser?.role === UserRole.MASTER_ADMIN) {
    return prisma.hotel.findFirst({
      include: {
        roomTypes: true,
        platformConfigs: true,
      },
      orderBy: { createdAt: "asc" },
    });
  }

  return prisma.hotel.findFirst({
    where: {
      OR: [{ ownerId: domainUserId }, { users: { some: { userId: domainUserId } } }],
    },
    include: {
      roomTypes: true,
      platformConfigs: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function getDashboardStats(hotelId: string) {
  const today = new Date();
  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [inventoryToday, bookingsToday, bookingsMonth, channels] = await Promise.all([
    prisma.inventory.aggregate({
      where: {
        hotelId,
        date: {
          gte: dayStart,
          lt: dayEnd,
        },
      },
      _sum: {
        totalRooms: true,
        availableRooms: true,
        soldRooms: true,
      },
    }),
    prisma.booking.count({
      where: {
        hotelId,
        createdAt: {
          gte: dayStart,
          lt: dayEnd,
        },
      },
    }),
    prisma.booking.aggregate({
      where: {
        hotelId,
        createdAt: { gte: monthStart },
      },
      _sum: { totalAmount: true },
    }),
    prisma.hotelPlatformConfig.findMany({ where: { hotelId } }),
  ]);

  const totalRooms = inventoryToday._sum.totalRooms ?? 0;
  const soldRooms = inventoryToday._sum.soldRooms ?? 0;

  return {
    totalRooms,
    availableRooms: inventoryToday._sum.availableRooms ?? 0,
    occupancyPct: totalRooms === 0 ? 0 : Math.round((soldRooms / totalRooms) * 100),
    bookingsToday,
    revenueMonth: Number(bookingsMonth._sum.totalAmount ?? 0),
    channelsHealthy: channels.filter((c) => c.status === "CONNECTED" && c.isEnabled).length,
    channelsTotal: channels.length,
  };
}

export async function getRecentBookings(hotelId: string, limit = 20) {
  return prisma.booking.findMany({
    where: { hotelId },
    include: {
      roomType: true,
      platformConfig: true,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getSyncLogs(hotelId: string, limit = 50) {
  return prisma.syncLog.findMany({
    where: { hotelId },
    include: {
      hotelPlatformConfig: true,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getInventoryMatrix(hotelId: string, days = 14) {
  const start = new Date();
  const end = new Date(start);
  end.setDate(end.getDate() + days);

  return prisma.inventory.findMany({
    where: {
      hotelId,
      date: {
        gte: start,
        lt: end,
      },
    },
    include: {
      roomType: true,
    },
    orderBy: [{ roomType: { name: "asc" } }, { date: "asc" }],
  });
}

export async function getBookingTrends(hotelId: string) {
  const start = subDays(new Date(), 14);

  return prisma.booking.groupBy({
    by: ["bookingSource"],
    where: {
      hotelId,
      createdAt: { gte: start },
    },
    _count: {
      _all: true,
    },
  });
}

export async function getChannelHealth(hotelId: string) {
  const [configs, failures, testLogs] = await Promise.all([
    prisma.hotelPlatformConfig.findMany({
      where: { hotelId },
      include: { roomMappings: true },
      orderBy: { platform: "asc" },
    }),
    prisma.syncLog.groupBy({
      by: ["hotelPlatformConfigId"],
      where: {
        hotelId,
        status: "FAILED",
        createdAt: { gte: subDays(new Date(), 1) },
      },
      _count: {
        _all: true,
      },
    }),
    prisma.syncLog.findMany({
      where: {
        hotelId,
        action: "FULL_SYNC",
        correlationId: {
          startsWith: "healthcheck:",
        },
      },
      select: {
        id: true,
        hotelPlatformConfigId: true,
        status: true,
        createdAt: true,
        errorMessage: true,
        responsePayload: true,
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
  ]);

  const failMap = new Map(
    failures
      .filter((item) => item.hotelPlatformConfigId)
      .map((item) => [item.hotelPlatformConfigId as string, item._count._all]),
  );

  const historyByChannel = new Map<
    string,
    Array<{
      id: string;
      status: string;
      createdAt: Date;
      errorMessage: string | null;
      latencyMs: number | null;
    }>
  >();

  for (const row of testLogs) {
    if (!row.hotelPlatformConfigId) {
      continue;
    }
    const current = historyByChannel.get(row.hotelPlatformConfigId) ?? [];
    if (current.length >= 5) {
      continue;
    }
    const latencyCandidate =
      row.responsePayload && typeof row.responsePayload === "object"
        ? (row.responsePayload as { latencyMs?: unknown }).latencyMs
        : null;
    current.push({
      id: row.id,
      status: row.status,
      createdAt: row.createdAt,
      errorMessage: row.errorMessage,
      latencyMs:
        typeof latencyCandidate === "number" && Number.isFinite(latencyCandidate)
          ? latencyCandidate
          : null,
    });
    historyByChannel.set(row.hotelPlatformConfigId, current);
  }

  return configs.map((config) => ({
    ...config,
    failuresLast24h: failMap.get(config.id) ?? 0,
    capabilityLabels: getPlatformCapabilityLabels(config.platform),
    testHistory: historyByChannel.get(config.id) ?? [],
  }));
}

export async function getSyncActivity(hotelId: string) {
  const rows = await prisma.syncLog.groupBy({
    by: ["status"],
    where: {
      hotelId,
      createdAt: {
        gte: subDays(new Date(), 1),
      },
    },
    _count: {
      _all: true,
    },
  });

  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = row._count._all;
    return acc;
  }, {});
}

export type InventoryItem = Prisma.InventoryGetPayload<{
  include: { roomType: true };
}>;
