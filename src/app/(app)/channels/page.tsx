import { formatDistanceToNow } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription } from "@/components/ui/card";
import { PLATFORM_LABELS } from "@/lib/constants";
import { getChannelHealth, getUserScopedHotel } from "@/lib/queries";
import { requireSession } from "@/lib/session";

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

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {channels.map((channel) => (
        <Card key={channel.id} className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-serif text-2xl text-[var(--text-primary)]">{PLATFORM_LABELS[channel.platform]}</p>
            <Badge
              variant={
                channel.status === "CONNECTED"
                  ? "success"
                  : channel.status === "ERROR"
                    ? "destructive"
                    : "warning"
              }
            >
              {channel.status}
            </Badge>
          </div>

          <CardDescription>
            {channel.lastSyncedAt
              ? `Last synced ${formatDistanceToNow(channel.lastSyncedAt, { addSuffix: true })}`
              : "Not synced yet"}
          </CardDescription>

          <div className="space-y-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-secondary)]">Mappings</span>
              <span>{channel.roomMappings.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-secondary)]">Failures (24h)</span>
              <span>{channel.failuresLast24h}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-secondary)]">Enabled</span>
              <span>{channel.isEnabled ? "Yes" : "No"}</span>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Capabilities</p>
            <div className="flex flex-wrap gap-1">
              {channel.capabilityLabels.map((label: string) => (
                <Badge key={`${channel.id}-${label}`} variant="neutral">
                  {label}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              Test Sync
            </Button>
            <Button size="sm">Open Details</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
