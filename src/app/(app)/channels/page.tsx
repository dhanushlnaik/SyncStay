import { getChannelHealth, getUserScopedHotel } from "@/lib/queries";
import { requireSession } from "@/lib/session";

import { ChannelsClient } from "./channels-client";

export default async function ChannelsPage() {
  const authResult = await requireSession();
  if ("error" in authResult) {
    return null;
  }

  const hotel = await getUserScopedHotel(authResult.domainUser.id);
  if (!hotel) {
    return <div>No hotel assigned</div>;
  }

  const channels = await getChannelHealth(hotel.id);

  return <ChannelsClient initialChannels={channels} />;
}
