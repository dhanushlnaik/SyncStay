import { randomUUID } from "node:crypto";

import { BookingStatus, Prisma, SyncActionType, UserRole } from "@prisma/client";

import { eachStayDate } from "@/lib/dates";
import { publishEvent } from "@/lib/events";
import { prisma } from "@/lib/prisma";
import { enqueueSyncForHotel } from "@/lib/queue";

function ensureStayRange(checkInDate: Date, checkOutDate: Date) {
  if (checkInDate >= checkOutDate) {
    throw new Error("checkOutDate must be after checkInDate");
  }
}

export async function applyInventoryBulkUpdate(input: {
  hotelId: string;
  actorRole: UserRole;
  correlationId?: string;
  idempotencyKey?: string;
  updates: Array<{
    roomTypeId: string;
    date: Date;
    availableRooms?: number;
    totalRooms?: number;
    baseRate?: number;
    minStay?: number;
    maxStay?: number | null;
    stopSell?: boolean;
  }>;
}) {
  if (input.updates.length === 0) {
    return { updated: 0 };
  }

  if (input.actorRole !== UserRole.MASTER_ADMIN && input.actorRole !== UserRole.OWNER) {
    throw new Error("Forbidden inventory mutation");
  }

  const correlationId = input.correlationId ?? randomUUID();

  await prisma.$transaction(async (tx) => {
    for (const update of input.updates) {
      await tx.inventory.updateMany({
        where: {
          hotelId: input.hotelId,
          roomTypeId: update.roomTypeId,
          date: update.date,
        },
        data: {
          ...(update.availableRooms !== undefined ? { availableRooms: update.availableRooms } : {}),
          ...(update.totalRooms !== undefined ? { totalRooms: update.totalRooms } : {}),
          ...(update.baseRate !== undefined
            ? { baseRate: new Prisma.Decimal(update.baseRate) }
            : {}),
          ...(update.minStay !== undefined ? { minStay: update.minStay } : {}),
          ...(update.maxStay !== undefined ? { maxStay: update.maxStay } : {}),
          ...(update.stopSell !== undefined ? { stopSell: update.stopSell } : {}),
        },
      });

      await tx.inventoryEvent.create({
        data: {
          hotelId: input.hotelId,
          roomTypeId: update.roomTypeId,
          action: "INVENTORY_UPDATED",
          payload: {
            date: update.date.toISOString(),
            update,
            correlationId,
          },
        },
      });
    }
  });

  await enqueueSyncForHotel({
    hotelId: input.hotelId,
    action: SyncActionType.INVENTORY_UPDATE,
    correlationId,
    idempotencyKey: input.idempotencyKey,
    payload: {
      updates: input.updates.map((u) => ({
        ...u,
        date: u.date.toISOString(),
      })),
      correlationId,
    },
  });

  publishEvent({
    type: "inventory.updated",
    timestamp: new Date().toISOString(),
    payload: {
      hotelId: input.hotelId,
      updates: input.updates.length,
      correlationId,
    },
  });

  return { updated: input.updates.length, correlationId };
}

export async function createBookingWithConflictHandling(input: {
  hotelId: string;
  roomTypeId: string;
  platformConfigId?: string;
  externalBookingId?: string;
  bookingSource: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  checkInDate: Date;
  checkOutDate: Date;
  roomsBooked: number;
  adults: number;
  children: number;
  totalAmount?: number;
  createdById?: string;
  correlationId?: string;
  idempotencyKey?: string;
}) {
  ensureStayRange(input.checkInDate, input.checkOutDate);

  const stayDates = eachStayDate(input.checkInDate, input.checkOutDate);
  const nights = stayDates.length;
  const correlationId = input.correlationId ?? randomUUID();

  const result = await prisma.$transaction(
    async (tx) => {
      const inventories = await tx.inventory.findMany({
        where: {
          hotelId: input.hotelId,
          roomTypeId: input.roomTypeId,
          date: {
            in: stayDates,
          },
        },
        orderBy: {
          date: "asc",
        },
      });

      if (inventories.length !== stayDates.length) {
        throw new Error("Inventory rows missing for requested stay dates");
      }

      const blockingDay = inventories.find((row) => row.availableRooms < input.roomsBooked);

      if (blockingDay) {
        const rejected = await tx.booking.create({
          data: {
            hotelId: input.hotelId,
            roomTypeId: input.roomTypeId,
            platformConfigId: input.platformConfigId,
            externalBookingId: input.externalBookingId,
            bookingSource: input.bookingSource as never,
            guestName: input.guestName,
            guestEmail: input.guestEmail,
            guestPhone: input.guestPhone,
            checkInDate: input.checkInDate,
            checkOutDate: input.checkOutDate,
            nights,
            roomsBooked: input.roomsBooked,
            adults: input.adults,
            children: input.children,
            totalAmount:
              input.totalAmount !== undefined ? new Prisma.Decimal(input.totalAmount) : undefined,
            status: BookingStatus.REJECTED,
            rejectionReason: `Overbooking prevented on ${blockingDay.date.toISOString().slice(0, 10)}`,
            createdById: input.createdById,
          },
        });

        await tx.bookingEvent.create({
          data: {
            bookingId: rejected.id,
            eventType: "BOOKING_REJECTED_CONFLICT",
            message: "Second booking rejected due to first-booking-wins rule",
            payload: { blockingDate: blockingDay.date.toISOString() },
          },
        });

        return {
          accepted: false,
          booking: rejected,
          reason: rejected.rejectionReason,
          correlationId,
        };
      }

      for (const row of inventories) {
        await tx.inventory.update({
          where: { id: row.id },
          data: {
            availableRooms: row.availableRooms - input.roomsBooked,
            soldRooms: row.soldRooms + input.roomsBooked,
          },
        });
      }

      const booking = await tx.booking.create({
        data: {
          hotelId: input.hotelId,
          roomTypeId: input.roomTypeId,
          platformConfigId: input.platformConfigId,
          externalBookingId: input.externalBookingId,
          bookingSource: input.bookingSource as never,
          guestName: input.guestName,
          guestEmail: input.guestEmail,
          guestPhone: input.guestPhone,
          checkInDate: input.checkInDate,
          checkOutDate: input.checkOutDate,
          nights,
          roomsBooked: input.roomsBooked,
          adults: input.adults,
          children: input.children,
          totalAmount:
            input.totalAmount !== undefined ? new Prisma.Decimal(input.totalAmount) : undefined,
          status: BookingStatus.CONFIRMED,
          createdById: input.createdById,
        },
      });

      await tx.bookingEvent.create({
        data: {
          bookingId: booking.id,
          eventType: "BOOKING_CONFIRMED",
          payload: {
            correlationId,
            stayDates: stayDates.map((d) => d.toISOString()),
          },
        },
      });

      await tx.inventoryEvent.create({
        data: {
          hotelId: input.hotelId,
          roomTypeId: input.roomTypeId,
          action: "INVENTORY_LOCK_AND_DEDUCT",
          payload: {
            bookingId: booking.id,
            roomsBooked: input.roomsBooked,
            stayDates: stayDates.map((d) => d.toISOString()),
            correlationId,
          },
        },
      });

      return {
        accepted: true,
        booking,
        correlationId,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );

  if (result.accepted) {
    await enqueueSyncForHotel({
      hotelId: input.hotelId,
      action: SyncActionType.BOOKING_CREATE,
      bookingId: result.booking.id,
      roomTypeId: input.roomTypeId,
      correlationId: result.correlationId,
      idempotencyKey: input.idempotencyKey,
      payload: {
        bookingId: result.booking.id,
        bookingSource: input.bookingSource,
        checkInDate: input.checkInDate.toISOString(),
        checkOutDate: input.checkOutDate.toISOString(),
        correlationId: result.correlationId,
      },
    });

    publishEvent({
      type: "booking.created",
      timestamp: new Date().toISOString(),
      payload: {
        bookingId: result.booking.id,
        hotelId: input.hotelId,
        roomTypeId: input.roomTypeId,
        correlationId: result.correlationId,
      },
    });
  }

  return result;
}
