import { format } from "date-fns";

import { KpiCard } from "@/components/dashboard/kpi-card";
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
import {
  getBookingTrends,
  getDashboardStats,
  getRecentBookings,
  getSyncActivity,
  getUserScopedHotel,
} from "@/lib/queries";
import { requireSession } from "@/lib/session";

export default async function DashboardPage() {
  const authResult = await requireSession();
  if ("error" in authResult) {
    return null;
  }

  const hotel = await getUserScopedHotel(authResult.domainUser.id);
  if (!hotel) {
    return <div className="text-sm text-[var(--text-secondary)]">No hotel assigned to this account.</div>;
  }

  const [stats, recentBookings, trends, syncActivity] = await Promise.all([
    getDashboardStats(hotel.id),
    getRecentBookings(hotel.id, 8),
    getBookingTrends(hotel.id),
    getSyncActivity(hotel.id),
  ]);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Occupancy Today"
          value={`${stats.occupancyPct}%`}
          meta={`${stats.totalRooms - stats.availableRooms}/${stats.totalRooms} sold`}
        />
        <KpiCard
          title="Available Rooms"
          value={stats.availableRooms.toString()}
          meta="Real-time from inventory calendar"
        />
        <KpiCard
          title="Bookings Today"
          value={stats.bookingsToday.toString()}
          meta="Across OTA + internal sources"
        />
        <KpiCard
          title="Monthly Revenue"
          value={`INR ${Math.round(stats.revenueMonth).toLocaleString("en-IN")}`}
          meta={`${stats.channelsHealthy}/${stats.channelsTotal} channels healthy`}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardTitle>Recent Bookings</CardTitle>
          <CardDescription className="mb-4">Last 8 bookings entering the sync layer</CardDescription>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Guest</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Check In</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentBookings.map((booking) => (
                <TableRow key={booking.id}>
                  <TableCell>{booking.guestName}</TableCell>
                  <TableCell>{booking.roomType.name}</TableCell>
                  <TableCell>{PLATFORM_LABELS[booking.platformConfig?.platform ?? "BOOKING_COM"]}</TableCell>
                  <TableCell>{format(booking.checkInDate, "dd MMM")}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        booking.status === "CONFIRMED"
                          ? "success"
                          : booking.status === "REJECTED"
                            ? "destructive"
                            : "warning"
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

        <div className="space-y-4">
          <Card>
            <CardTitle>Sync Activity (24h)</CardTitle>
            <CardDescription className="mb-3">Operational reliability snapshot</CardDescription>
            <div className="space-y-2 text-sm">
              {Object.entries(syncActivity).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between rounded-xl bg-[var(--surface-soft)] px-3 py-2">
                  <span className="text-[var(--text-secondary)]">{status}</span>
                  <span className="font-medium text-[var(--text-primary)]">{count}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardTitle>Booking Mix (14d)</CardTitle>
            <CardDescription className="mb-3">Source distribution for recent demand</CardDescription>
            <div className="space-y-2">
              {trends.map((trend) => (
                <div key={trend.bookingSource} className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text-secondary)]">{trend.bookingSource}</span>
                  <span className="font-medium">{trend._count._all}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
