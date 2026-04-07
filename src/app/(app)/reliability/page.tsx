import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getUserScopedHotel } from "@/lib/queries";
import { requireSession } from "@/lib/session";

import { ReliabilityConsole } from "./reliability-console";

export default async function ReliabilityPage() {
  const authResult = await requireSession();
  if ("error" in authResult) {
    return null;
  }

  const hotel = await getUserScopedHotel(authResult.domainUser.id);
  if (!hotel) {
    return <Card>No hotel assigned</Card>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Reliability Console</CardTitle>
        <CardDescription>
          Reconciliation runs, DLQ visibility, and replay controls for sync operations.
        </CardDescription>
      </Card>
      <ReliabilityConsole hotelId={hotel.id} />
    </div>
  );
}
