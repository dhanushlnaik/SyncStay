import { SimulationPanel } from "@/components/simulation/simulation-panel";
import { getUserScopedHotel } from "@/lib/queries";
import { requireSession } from "@/lib/session";

export default async function SimulationPage() {
  const authResult = await requireSession();
  if ("error" in authResult) {
    return null;
  }

  const hotel = await getUserScopedHotel(authResult.domainUser.id);
  if (!hotel) {
    return <div>No hotel assigned</div>;
  }

  return (
    <SimulationPanel
      hotelId={hotel.id}
      roomTypes={hotel.roomTypes.map((roomType) => ({ id: roomType.id, name: roomType.name }))}
    />
  );
}
