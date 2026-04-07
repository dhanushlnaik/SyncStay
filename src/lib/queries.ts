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
  const [configs, failures] = await Promise.all([
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
  ]);

  const failMap = new Map(
    failures
      .filter((item) => item.hotelPlatformConfigId)
      .map((item) => [item.hotelPlatformConfigId as string, item._count._all]),
  );

  return configs.map((config) => ({
    ...config,
    failuresLast24h: failMap.get(config.id) ?? 0,
    capabilityLabels: getPlatformCapabilityLabels(config.platform),
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
