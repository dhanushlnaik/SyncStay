"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardList,
  ShieldCheck,
  Hotel,
  LayoutDashboard,
  ListTodo,
  ShieldUser,
  Settings,
  Shuffle,
} from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/inventory", label: "Inventory", icon: CalendarDays },
  { href: "/bookings", label: "Bookings", icon: ClipboardList },
  { href: "/channels", label: "Channels", icon: Hotel },
  { href: "/sync-logs", label: "Sync Logs", icon: Activity },
  { href: "/reliability", label: "Reliability", icon: ShieldCheck },
  { href: "/admin/onboarding", label: "Onboarding Queue", icon: ListTodo },
  { href: "/admin/users", label: "Admin Users", icon: ShieldUser },
  { href: "/simulation", label: "Simulation", icon: Shuffle },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-[var(--border)] bg-[var(--surface)]/90 p-4 backdrop-blur lg:flex lg:flex-col">
      <div className="mb-6 flex items-center gap-2 px-2">
        <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--accent)]">
          <ChartNoAxesCombined className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-serif text-xl text-[var(--text-primary)]">SyncStay</p>
          <p className="text-xs text-[var(--text-muted)]">Real-Time Control Layer</p>
        </div>
      </div>

      <div className="mb-4 h-px bg-[linear-gradient(90deg,transparent,rgba(153,69,255,0.4),transparent)]" />

      <div className="flex min-h-0 flex-1 flex-col">
        <nav className="scrollbar-subtle flex-1 space-y-1 overflow-y-auto pr-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
                  isActive
                    ? "border border-[var(--accent)]/30 bg-[linear-gradient(120deg,rgba(153,69,255,0.22),rgba(111,122,255,0.16),rgba(20,241,149,0.08))] text-[var(--text-primary)] shadow-[0_8px_18px_rgba(8,12,30,0.55)]"
                    : "border border-transparent text-[var(--text-secondary)] hover:border-[var(--border)] hover:bg-[var(--surface-soft)]/70 hover:text-[var(--text-primary)]",
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 transition",
                    isActive ? "text-[var(--accent)]" : "text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]",
                  )}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)]/70 p-3">
          <p className="text-xs text-[var(--text-muted)]">Sync Status</p>
          <p className="mt-1 text-sm font-medium text-[var(--text-primary)]">Queues online</p>
        </div>
      </div>
    </aside>
  );
}
