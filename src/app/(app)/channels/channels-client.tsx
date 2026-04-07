"use client";

import { PlatformConnectionStatus } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PLATFORM_LABELS } from "@/lib/constants";
import { toast } from "@/lib/toast";

type ChannelRow = {
  id: string;
  platform: keyof typeof PLATFORM_LABELS;
  status: PlatformConnectionStatus;
  isEnabled: boolean;
  roomMappings: Array<{ id: string }>;
  failuresLast24h: number;
  capabilityLabels: string[];
  lastSyncedAt?: string | Date | null;
  lastErrorMessage?: string | null;
  endpointUrl?: string | null;
  externalHotelId?: string | null;
  apiKey?: string | null;
  testHistory: Array<{
    id: string;
    status: string;
    createdAt: string | Date;
    errorMessage: string | null;
    latencyMs: number | null;
  }>;
};

type ChannelDraft = {
  endpointUrl: string;
  externalHotelId: string;
  apiKey: string;
  apiSecret: string;
};

type ChannelsClientProps = {
  initialChannels: ChannelRow[];
};

function statusBadgeVariant(status: PlatformConnectionStatus) {
  if (status === "CONNECTED") {
    return "success";
  }
  if (status === "ERROR") {
    return "destructive";
  }
  return "warning";
}

function toDraft(channel: ChannelRow): ChannelDraft {
  return {
    endpointUrl: channel.endpointUrl ?? "",
    externalHotelId: channel.externalHotelId ?? "",
    apiKey: channel.apiKey ?? "",
    apiSecret: "",
  };
}

function testStatusVariant(status: string) {
  if (status === "SUCCESS") {
    return "success";
  }
  if (status === "FAILED") {
    return "destructive";
  }
  if (status === "PROCESSING") {
    return "warning";
  }
  return "neutral";
}

export function ChannelsClient({ initialChannels }: ChannelsClientProps) {
  const [channels, setChannels] = useState(initialChannels);
  const [drafts, setDrafts] = useState<Record<string, ChannelDraft>>(
    Object.fromEntries(initialChannels.map((channel) => [channel.id, toDraft(channel)])),
  );
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const stats = useMemo(() => {
    const connected = channels.filter((item) => item.status === "CONNECTED").length;
    const error = channels.filter((item) => item.status === "ERROR").length;
    return { connected, error, total: channels.length };
  }, [channels]);

  function setDraftValue(channelId: string, field: keyof ChannelDraft, value: string) {
    setDrafts((prev) => ({
      ...prev,
      [channelId]: {
        ...(prev[channelId] ?? { endpointUrl: "", externalHotelId: "", apiKey: "", apiSecret: "" }),
        [field]: value,
      },
    }));
  }

  async function saveChannel(channelId: string) {
    const draft = drafts[channelId];
    if (!draft) {
      return;
    }

    setLoadingKey(`save:${channelId}`);

    const body: {
      endpointUrl?: string | null;
      externalHotelId?: string | null;
      apiKey?: string | null;
      apiSecret?: string | null;
    } = {
      endpointUrl: draft.endpointUrl.trim() ? draft.endpointUrl.trim() : null,
      externalHotelId: draft.externalHotelId.trim() ? draft.externalHotelId.trim() : null,
      apiKey: draft.apiKey.trim() ? draft.apiKey.trim() : null,
    };

    if (draft.apiSecret.trim()) {
      body.apiSecret = draft.apiSecret.trim();
    }

    const response = await fetch(`/api/channels/${channelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as ChannelRow & { error?: string };
    if (!response.ok) {
      toast.error(data.error ?? "Failed to save channel credentials");
      setLoadingKey(null);
      return;
    }

    setChannels((prev) => prev.map((channel) => (channel.id === channelId ? { ...channel, ...data } : channel)));
    setDrafts((prev) => ({
      ...prev,
      [channelId]: {
        ...(prev[channelId] ?? toDraft(data)),
        apiSecret: "",
      },
    }));
    toast.success("Sandbox credentials saved");
    setLoadingKey(null);
  }

  async function testConnection(channelId: string) {
    setLoadingKey(`test:${channelId}`);
    const response = await fetch(`/api/channels/${channelId}/test-connection`, {
      method: "POST",
    });

    const data = (await response.json()) as {
      ok?: boolean;
      error?: string;
      latencyMs?: number;
      message?: string;
      channel?: ChannelRow;
      testLog?: {
        id: string;
        status: string;
        createdAt: string | Date;
        errorMessage: string | null;
        latencyMs: number | null;
      };
    };

    if (!response.ok) {
      toast.error(data.error ?? "Connection test failed");
      if (data.channel) {
        setChannels((prev) =>
          prev.map((channel) =>
            channel.id === channelId
              ? {
                  ...channel,
                  ...data.channel,
                  testHistory: data.testLog
                    ? [data.testLog, ...(channel.testHistory ?? [])].slice(0, 5)
                    : channel.testHistory,
                }
              : channel,
          ),
        );
      }
      setLoadingKey(null);
      return;
    }

    if (data.channel) {
      setChannels((prev) =>
        prev.map((channel) =>
          channel.id === channelId
            ? {
                ...channel,
                ...data.channel,
                testHistory: data.testLog
                  ? [data.testLog, ...(channel.testHistory ?? [])].slice(0, 5)
                  : channel.testHistory,
              }
            : channel,
        ),
      );
    }

    if (data.ok) {
      toast.success("Connection successful", data.latencyMs ? `${data.latencyMs}ms` : undefined);
    } else {
      toast.error("Connection failed", data.message);
    }
    setLoadingKey(null);
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[var(--text-secondary)]">
          Connected {stats.connected}/{stats.total} • Error {stats.error}
        </p>
        <p className="text-xs text-[var(--text-muted)]">
          Configure sandbox endpoint + credentials and run live test checks.
        </p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {channels.map((channel) => {
          const draft = drafts[channel.id] ?? toDraft(channel);

          return (
            <Card key={channel.id} className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-serif text-2xl text-[var(--text-primary)]">
                  {PLATFORM_LABELS[channel.platform]}
                </p>
                <Badge variant={statusBadgeVariant(channel.status)}>{channel.status}</Badge>
              </div>

              <CardDescription>
                {channel.lastSyncedAt
                  ? `Last synced ${formatDistanceToNow(new Date(channel.lastSyncedAt), { addSuffix: true })}`
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
                  {channel.capabilityLabels.map((label) => (
                    <Badge key={`${channel.id}-${label}`} variant="neutral">
                      {label}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Input
                  placeholder="Sandbox endpoint URL"
                  value={draft.endpointUrl}
                  onChange={(event) => setDraftValue(channel.id, "endpointUrl", event.target.value)}
                />
                <Input
                  placeholder="External hotel ID"
                  value={draft.externalHotelId}
                  onChange={(event) => setDraftValue(channel.id, "externalHotelId", event.target.value)}
                />
                <Input
                  placeholder="Sandbox API key"
                  value={draft.apiKey}
                  onChange={(event) => setDraftValue(channel.id, "apiKey", event.target.value)}
                />
                <Input
                  type="password"
                  placeholder="Sandbox API secret (leave blank to keep)"
                  value={draft.apiSecret}
                  onChange={(event) => setDraftValue(channel.id, "apiSecret", event.target.value)}
                />
              </div>

              {channel.lastErrorMessage ? (
                <p className="text-xs text-[var(--error)]">{channel.lastErrorMessage}</p>
              ) : null}

              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
                  Last Connection Tests
                </p>
                {channel.testHistory.length === 0 ? (
                  <p className="text-xs text-[var(--text-secondary)]">No connection test history yet.</p>
                ) : (
                  <div className="space-y-1">
                    {channel.testHistory.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-2 py-1.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[11px] text-[var(--text-secondary)]">
                            {new Date(entry.createdAt).toLocaleString()}
                          </p>
                          <p className="truncate text-[11px] text-[var(--text-muted)]">
                            {entry.latencyMs !== null ? `${entry.latencyMs}ms` : entry.errorMessage ?? "n/a"}
                          </p>
                        </div>
                        <Badge variant={testStatusVariant(entry.status)}>{entry.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loadingKey === `save:${channel.id}`}
                  onClick={() => void saveChannel(channel.id)}
                >
                  {loadingKey === `save:${channel.id}` ? "Saving..." : "Save Credentials"}
                </Button>
                <Button
                  size="sm"
                  disabled={loadingKey === `test:${channel.id}`}
                  onClick={() => void testConnection(channel.id)}
                >
                  {loadingKey === `test:${channel.id}` ? "Testing..." : "Test Connection"}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
