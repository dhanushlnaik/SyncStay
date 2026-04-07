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
    <aside className="hidden w-64 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] p-4 lg:block">
      <div className="mb-8 flex items-center gap-2 px-2">
        <ChartNoAxesCombined className="h-5 w-5 text-[var(--accent)]" />
        <div>
          <p className="font-serif text-xl text-[var(--text-primary)]">SyncStay</p>
          <p className="text-xs text-[var(--text-muted)]">Hospitality Control</p>
        </div>
      </div>

      <nav className="space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                isActive
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-soft)]",
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
