import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PLATFORM_LABELS } from "@/lib/constants";
import { getRecentBookings, getUserScopedHotel } from "@/lib/queries";
import { requireSession } from "@/lib/session";

export default async function BookingsPage() {
  const authResult = await requireSession();
  if ("error" in authResult) {
    return null;
  }

  const hotel = await getUserScopedHotel(authResult.domainUser.id);
  if (!hotel) {
    return <div>No hotel assigned</div>;
  }

  const bookings = await getRecentBookings(hotel.id, 120);

  return (
    <Card>
      <CardTitle>Bookings</CardTitle>
      <CardDescription className="mb-4">OTA and internal reservations flowing into the sync layer</CardDescription>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Guest</TableHead>
            <TableHead>Room</TableHead>
            <TableHead>Channel</TableHead>
            <TableHead>Check-in</TableHead>
            <TableHead>Check-out</TableHead>
            <TableHead>Nights</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bookings.map((booking) => (
            <TableRow key={booking.id}>
              <TableCell>{booking.guestName}</TableCell>
              <TableCell>{booking.roomType.name}</TableCell>
              <TableCell>{PLATFORM_LABELS[booking.platformConfig?.platform ?? "BOOKING_COM"]}</TableCell>
              <TableCell>{format(booking.checkInDate, "dd MMM yyyy")}</TableCell>
              <TableCell>{format(booking.checkOutDate, "dd MMM yyyy")}</TableCell>
              <TableCell>{booking.nights}</TableCell>
              <TableCell>
                {booking.totalAmount ? `INR ${Number(booking.totalAmount).toLocaleString("en-IN")}` : "-"}
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    booking.status === "CONFIRMED"
                      ? "success"
                      : booking.status === "REJECTED"
                        ? "destructive"
                        : booking.status === "PENDING"
                          ? "warning"
                          : "neutral"
                  }
                >
                  {booking.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
