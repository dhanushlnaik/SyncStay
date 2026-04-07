"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

export default function SettingsPage() {
  const [simulationEnabled, setSimulationEnabled] = useState(true);
  const router = useRouter();

  const signOut = async () => {
    await authClient.signOut();
    router.push("/auth/sign-in");
    router.refresh();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-4">
        <div>
          <CardTitle>Simulation Mode</CardTitle>
          <CardDescription>Control auto-generated booking simulation behavior for demos.</CardDescription>
        </div>

        <label className="flex items-center justify-between rounded-xl border border-[var(--border)] px-3 py-2 text-sm">
          <span>Enable simulation toggle</span>
          <input
            type="checkbox"
            checked={simulationEnabled}
            onChange={(event) => setSimulationEnabled(event.target.checked)}
          />
        </label>

        <Input value={simulationEnabled ? "Enabled" : "Disabled"} readOnly />
      </Card>

      <Card className="space-y-4">
        <div>
          <CardTitle>Session</CardTitle>
          <CardDescription>Credentials auth managed by better-auth.</CardDescription>
        </div>

        <Button variant="outline" onClick={signOut}>
          Sign Out
        </Button>
      </Card>
    </div>
  );
}
