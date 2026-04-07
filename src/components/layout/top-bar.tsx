"use client";

import { Bell, ChevronDown, LogOut } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { toast } from "@/lib/toast";

export function TopBar({ ownerName }: { ownerName: string }) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    const result = await authClient.signOut();

    if (result.error) {
      toast.error("Unable to sign out", result.error.message ?? "Please try again.");
      setIsSigningOut(false);
      return;
    }

    toast.success("Signed out");
    router.push("/auth/sign-in");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface)]/90 px-6 py-3 backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-serif text-2xl text-[var(--text-primary)]">Lotus Haven Jaipur</p>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="success">All channels mostly healthy</Badge>
            <span className="text-xs text-[var(--text-muted)]">Timezone: Asia/Kolkata</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm">
            Sync all channels
          </Button>
          <Button size="sm">Simulate booking</Button>
          <button className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)]/70 p-2 text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]">
            <Bell className="h-4 w-4" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)]/45 px-3 py-2 text-left transition hover:bg-[var(--surface-soft)]">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xs font-semibold text-[var(--accent)]">
                  {ownerName.slice(0, 1).toUpperCase()}
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{ownerName}</p>
                  <p className="text-xs text-[var(--text-muted)]">Account</p>
                </div>
                <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{ownerName}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={isSigningOut}
                onSelect={(event) => {
                  event.preventDefault();
                  void handleSignOut();
                }}
                className="text-[var(--error)] data-[highlighted]:bg-[var(--error-soft)]"
              >
                <LogOut className="mr-2 h-4 w-4" />
                {isSigningOut ? "Signing out..." : "Sign out"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
