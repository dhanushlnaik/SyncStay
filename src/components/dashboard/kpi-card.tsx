import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export function KpiCard({
  title,
  value,
  meta,
}: {
  title: string;
  value: string;
  meta: string;
}) {
  return (
    <Card className="space-y-2">
      <CardDescription>{title}</CardDescription>
      <CardTitle className="text-3xl font-semibold">{value}</CardTitle>
      <p className="text-xs text-[var(--text-muted)]">{meta}</p>
    </Card>
  );
}
