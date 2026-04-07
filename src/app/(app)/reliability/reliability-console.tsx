"use client";

import { useEffect, useState } from "react";
import { useCallback } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/lib/toast";

type ReliabilityConsoleProps = {
  hotelId: string;
};

type ReconciliationRun = {
  id: string;
  status: string;
  createdAt: string;
  finishedAt?: string | null;
  totalChecked: number;
  issuesFound: number;
};

type DlqItem = {
  id: string | null;
  name: string;
  data: {
    hotelId: string;
    platform: string;
    action: string;
    errorMessage?: string;
    payload?: Record<string, unknown>;
    correlationId?: string;
    idempotencyKey?: string;
  };
  failedReason?: string;
  attemptsMade: number;
  timestamp: number;
};

type ReplayHistoryItem = {
  id: string;
  jobId: string;
  status: string;
  notes?: string | null;
  createdAt: string;
  processedAt?: string | null;
  requestedBy?: {
    name: string;
    email: string;
  } | null;
};

type MetricsPayload = {
  metrics: {
    total: number;
    successful: number;
    retried: number;
    successRate: number;
    retryRate: number;
    p95LatencyMs: number;
  };
  schedule: {
    enabled: boolean;
    intervalMinutes: number;
    lastScheduledRun?: {
      id: string;
      createdAt: string;
      status: string;
      issuesFound: number;
    } | null;
  };
};

export function ReliabilityConsole({ hotelId }: ReliabilityConsoleProps) {
  const [runs, setRuns] = useState<ReconciliationRun[]>([]);
  const [dlqItems, setDlqItems] = useState<DlqItem[]>([]);
  const [replayHistory, setReplayHistory] = useState<ReplayHistoryItem[]>([]);
  const [metrics, setMetrics] = useState<MetricsPayload["metrics"] | null>(null);
  const [schedule, setSchedule] = useState<MetricsPayload["schedule"] | null>(null);
  const [expandedPayloadJobId, setExpandedPayloadJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchConsoleData = useCallback(async () => {
    const [runsResponse, dlqResponse, metricsResponse, replayHistoryResponse] = await Promise.all([
      fetch(`/api/sync/reconcile/runs?hotelId=${hotelId}`),
      fetch(`/api/sync/dlq?hotelId=${hotelId}`),
      fetch(`/api/sync/metrics?hotelId=${hotelId}`),
      fetch(`/api/sync/replay/history?hotelId=${hotelId}`),
    ]);

    const runsData = (await runsResponse.json()) as { items?: ReconciliationRun[]; error?: string };
    const dlqData = (await dlqResponse.json()) as { items?: DlqItem[]; error?: string };
    const metricsData = (await metricsResponse.json()) as (MetricsPayload & { error?: string });
    const replayData = (await replayHistoryResponse.json()) as {
      items?: ReplayHistoryItem[];
      error?: string;
    };

    return {
      runsOk: runsResponse.ok,
      dlqOk: dlqResponse.ok,
      metricsOk: metricsResponse.ok,
      replayOk: replayHistoryResponse.ok,
      runsData,
      dlqData,
      metricsData,
      replayData,
    };
  }, [hotelId]);

  async function refresh() {
    const result = await fetchConsoleData();
    if (!result.runsOk) {
      setError(result.runsData.error ?? "Failed loading reconciliation runs");
      return;
    }
    if (!result.dlqOk) {
      setError(result.dlqData.error ?? "Failed loading DLQ");
      return;
    }
    if (!result.metricsOk) {
      setError(result.metricsData.error ?? "Failed loading reliability metrics");
      return;
    }
    if (!result.replayOk) {
      setError(result.replayData.error ?? "Failed loading replay history");
      return;
    }

    setError(null);
    setRuns(result.runsData.items ?? []);
    setDlqItems(result.dlqData.items ?? []);
    setMetrics(result.metricsData.metrics);
    setSchedule(result.metricsData.schedule);
    setReplayHistory(result.replayData.items ?? []);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await fetchConsoleData();
      if (cancelled) {
        return;
      }
      if (!result.runsOk) {
        setError(result.runsData.error ?? "Failed loading reconciliation runs");
        return;
      }
      if (!result.dlqOk) {
        setError(result.dlqData.error ?? "Failed loading DLQ");
        return;
      }
      if (!result.metricsOk) {
        setError(result.metricsData.error ?? "Failed loading reliability metrics");
        return;
      }
      if (!result.replayOk) {
        setError(result.replayData.error ?? "Failed loading replay history");
        return;
      }

      setError(null);
      setRuns(result.runsData.items ?? []);
      setDlqItems(result.dlqData.items ?? []);
      setMetrics(result.metricsData.metrics);
      setSchedule(result.metricsData.schedule);
      setReplayHistory(result.replayData.items ?? []);
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchConsoleData]);

  async function triggerReconcile() {
    setLoading(true);
    const response = await fetch("/api/sync/reconcile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hotelId }),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Failed to run reconciliation");
      setLoading(false);
      return;
    }

    toast.success("Reconciliation triggered");
    await refresh();
    setLoading(false);
  }

  async function replay(jobId: string) {
    setLoading(true);
    const response = await fetch(`/api/sync/replay/${jobId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: "Replay requested from reliability console" }),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Replay failed");
      setLoading(false);
      return;
    }

    toast.success("Replay queued");
    await refresh();
    setLoading(false);
  }

  const scheduleLabel = schedule?.enabled
    ? `Auto reconciliation every ${schedule.intervalMinutes} min`
    : "Auto reconciliation disabled";

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-[var(--error)]">{error}</p> : null}

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="success">Success Rate: {metrics?.successRate ?? 0}%</Badge>
          <Badge variant={(metrics?.retryRate ?? 0) > 20 ? "warning" : "neutral"}>
            Retry Rate: {metrics?.retryRate ?? 0}%
          </Badge>
          <Badge variant="accent">p95 Latency: {metrics?.p95LatencyMs ?? 0}ms</Badge>
          <Badge variant={dlqItems.length ? "destructive" : "success"}>DLQ Pending: {dlqItems.length}</Badge>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-[var(--text-secondary)]">{scheduleLabel}</p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => void refresh()} disabled={loading}>
              Refresh
            </Button>
            <Button onClick={() => void triggerReconcile()} disabled={loading}>
              Run Reconciliation
            </Button>
          </div>
        </div>
        {schedule?.lastScheduledRun ? (
          <p className="text-xs text-[var(--text-muted)]">
            Last scheduled run: {new Date(schedule.lastScheduledRun.createdAt).toLocaleString()} •{" "}
            {schedule.lastScheduledRun.status} • issues {schedule.lastScheduledRun.issuesFound}
          </p>
        ) : null}
      </Card>

      <Card className="space-y-2">
        <p className="text-sm font-medium text-[var(--text-primary)]">Recent Reconciliation Runs</p>
        {runs.length === 0 ? <p className="text-sm text-[var(--text-secondary)]">No runs yet.</p> : null}
        {runs.map((run) => (
          <div
            key={run.id}
            className="flex flex-wrap items-center justify-between rounded-xl border border-[var(--border)] p-3 text-sm"
          >
            <div>
              <p className="font-medium">{run.status}</p>
              <p className="text-xs text-[var(--text-muted)]">{new Date(run.createdAt).toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p>Checked: {run.totalChecked}</p>
              <p>Issues: {run.issuesFound}</p>
            </div>
          </div>
        ))}
      </Card>

      <Card className="space-y-2">
        <p className="text-sm font-medium text-[var(--text-primary)]">DLQ Jobs</p>
        {dlqItems.length === 0 ? <p className="text-sm text-[var(--text-secondary)]">No DLQ jobs.</p> : null}
        {dlqItems.map((item) => (
          <div
            key={item.id ?? item.name}
            className="space-y-2 rounded-xl border border-[var(--border)] p-3 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">
                  {item.data.platform} • {item.data.action}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  {item.failedReason ?? item.data.errorMessage} • attempts {item.attemptsMade}
                </p>
              </div>
              <div className="flex gap-2">
                {item.id ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={loading}
                    onClick={() =>
                      setExpandedPayloadJobId((prev) => (prev === item.id ? null : (item.id as string)))
                    }
                  >
                    {expandedPayloadJobId === item.id ? "Hide Payload" : "View Payload"}
                  </Button>
                ) : null}
                {item.id ? (
                  <Button size="sm" variant="outline" disabled={loading} onClick={() => void replay(item.id as string)}>
                    Replay
                  </Button>
                ) : null}
              </div>
            </div>
            {expandedPayloadJobId === item.id ? (
              <pre className="max-h-44 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-2 text-xs text-[var(--text-secondary)]">
                {JSON.stringify(item.data, null, 2)}
              </pre>
            ) : null}
          </div>
        ))}
      </Card>

      <Card className="space-y-2">
        <p className="text-sm font-medium text-[var(--text-primary)]">Replay History</p>
        {replayHistory.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">No replay requests yet.</p>
        ) : null}
        {replayHistory.map((entry) => (
          <div
            key={entry.id}
            className="flex flex-wrap items-center justify-between rounded-xl border border-[var(--border)] p-3 text-sm"
          >
            <div>
              <p className="font-medium">{entry.jobId}</p>
              <p className="text-xs text-[var(--text-muted)]">
                {entry.requestedBy?.name ?? "System"} ({entry.requestedBy?.email ?? "n/a"})
              </p>
              {entry.notes ? <p className="text-xs text-[var(--text-secondary)]">{entry.notes}</p> : null}
            </div>
            <div className="text-right">
              <Badge variant={entry.status === "FAILED" ? "destructive" : "accent"}>{entry.status}</Badge>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{new Date(entry.createdAt).toLocaleString()}</p>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
