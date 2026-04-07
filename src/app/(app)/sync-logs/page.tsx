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
import { getSyncLogs, getUserScopedHotel } from "@/lib/queries";
import { requireSession } from "@/lib/session";

export default async function SyncLogsPage() {
  const authResult = await requireSession();
  if ("error" in authResult) {
    return null;
  }

  const hotel = await getUserScopedHotel(authResult.domainUser.id);
  if (!hotel) {
    return <div>No hotel assigned</div>;
  }

  const logs = await getSyncLogs(hotel.id, 150);

  return (
    <Card>
      <CardTitle>Sync Logs</CardTitle>
      <CardDescription className="mb-4">Action-level audit trail across all OTA channels</CardDescription>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Platform</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Correlation</TableHead>
            <TableHead>Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id}>
              <TableCell>{format(log.createdAt, "dd MMM HH:mm:ss")}</TableCell>
              <TableCell>{PLATFORM_LABELS[log.platform]}</TableCell>
              <TableCell>{log.action}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    log.status === "SUCCESS"
                      ? "success"
                      : log.status === "FAILED"
                        ? "destructive"
                        : log.status === "PROCESSING"
                          ? "warning"
                          : "neutral"
                  }
                >
                  {log.status}
                </Badge>
              </TableCell>
              <TableCell>{log.correlationId?.slice(0, 8) ?? "-"}</TableCell>
              <TableCell className="max-w-[320px] truncate text-[var(--text-secondary)]">
                {log.errorMessage ?? JSON.stringify(log.responsePayload ?? log.requestPayload ?? {})}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
