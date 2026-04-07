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
import { getInventoryMatrix, getUserScopedHotel } from "@/lib/queries";
import { requireSession } from "@/lib/session";

export default async function InventoryPage() {
  const authResult = await requireSession();
  if ("error" in authResult) {
    return null;
  }

  const hotel = await getUserScopedHotel(authResult.domainUser.id);
  if (!hotel) {
    return <div>No hotel assigned</div>;
  }

  const rows = await getInventoryMatrix(hotel.id, 14);

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Inventory Table View</CardTitle>
        <CardDescription className="mb-4">14-day inventory window by room type and date</CardDescription>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Room Type</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Available</TableHead>
              <TableHead>Booked</TableHead>
              <TableHead>Base Rate</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.roomType.name}</TableCell>
                <TableCell>{format(row.date, "dd MMM yyyy")}</TableCell>
                <TableCell>{row.totalRooms}</TableCell>
                <TableCell>{row.availableRooms}</TableCell>
                <TableCell>{row.soldRooms}</TableCell>
                <TableCell>{row.baseRate ? `INR ${Number(row.baseRate).toLocaleString("en-IN")}` : "-"}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      row.availableRooms === 0 ? "destructive" : row.availableRooms <= 2 ? "warning" : "success"
                    }
                  >
                    {row.availableRooms === 0 ? "Sold Out" : row.availableRooms <= 2 ? "Low" : "Healthy"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card>
        <CardTitle>Calendar Matrix View</CardTitle>
        <CardDescription className="mb-4">Dates as columns, room types as rows</CardDescription>
        <div className="overflow-x-auto">
          <div className="inline-grid min-w-full grid-cols-[220px_repeat(14,minmax(60px,1fr))] gap-1 text-xs">
            <div className="font-medium text-[var(--text-secondary)]">Room Type</div>
            {Array.from({ length: 14 }).map((_, index) => {
              const date = new Date();
              date.setDate(date.getDate() + index);
              return (
                <div key={index} className="text-center font-medium text-[var(--text-secondary)]">
                  {format(date, "dd MMM")}
                </div>
              );
            })}

            {hotel.roomTypes.map((roomType) => {
              const byDate = rows.filter((row) => row.roomTypeId === roomType.id);
              return (
                <div key={roomType.id} className="contents">
                  <div className="py-2 pr-2 font-medium text-[var(--text-primary)]">
                    {roomType.name}
                  </div>
                  {Array.from({ length: 14 }).map((_, index) => {
                    const date = new Date();
                    date.setDate(date.getDate() + index);
                    const target = byDate.find(
                      (item) => item.date.toISOString().slice(0, 10) === date.toISOString().slice(0, 10),
                    );
                    const available = target?.availableRooms ?? 0;

                    return (
                      <div
                        key={`${roomType.id}-${index}`}
                        className={`rounded-lg p-2 text-center ${
                          available === 0
                            ? "bg-[var(--error-soft)] text-[var(--error)]"
                            : available <= 2
                              ? "bg-[var(--warning-soft)] text-[var(--warning)]"
                              : "bg-[var(--success-soft)] text-[var(--success)]"
                        }`}
                      >
                        {available}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}
