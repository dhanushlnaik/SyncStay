import { UserRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function canAccessHotel(domainUser: { id: string; role: UserRole }, hotelId: string) {
  if (domainUser.role === UserRole.MASTER_ADMIN) {
    return true;
  }

  const hotel = await prisma.hotel.findFirst({
    where: {
      id: hotelId,
      OR: [
        { ownerId: domainUser.id },
        {
          users: {
            some: {
              userId: domainUser.id,
            },
          },
        },
      ],
    },
    select: { id: true },
  });

  return Boolean(hotel);
}

export function canMutateInventory(role: UserRole) {
  return role === UserRole.MASTER_ADMIN || role === UserRole.OWNER;
}

export function isMasterAdmin(role: UserRole) {
  return role === UserRole.MASTER_ADMIN;
}
