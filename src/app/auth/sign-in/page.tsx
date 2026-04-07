"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVerifyBanner] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    const query = new URLSearchParams(window.location.search);
    return query.get("verifyRequired") === "1";
  });

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    const result = await authClient.signIn.email({ email, password });

    if (result.error) {
      setError(result.error.message ?? "Unable to sign in");
      setIsLoading(false);
      return;
    }

    const sessionResult = await authClient.getSession();
    const emailVerified = (
      sessionResult.data?.user as
        | {
            emailVerified?: boolean;
          }
        | undefined
    )?.emailVerified;

    if (emailVerified === false) {
      router.push("/auth/verify-email?verifyRequired=1");
      router.refresh();
      return;
    }

    const onboardingStatus = await fetch("/api/onboarding/status");
    if (onboardingStatus.ok) {
      const onboardingData = (await onboardingStatus.json()) as { approvalStatus?: string };
      if (onboardingData.approvalStatus && onboardingData.approvalStatus !== "APPROVED") {
        router.push("/onboarding");
        router.refresh();
        return;
      }
    }

    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8rem] top-[-8rem] h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(153,69,255,0.35),transparent_70%)]" />
        <div className="absolute right-[-8rem] bottom-[-8rem] h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(20,241,149,0.2),transparent_72%)]" />
      </div>

      <Card className="relative w-full max-w-md space-y-5 border-[var(--accent)]/30">
        <div>
          <p className="font-serif text-3xl text-[var(--text-primary)]">SyncStay</p>
          <CardTitle className="mt-1">Sign in to your workspace</CardTitle>
          <CardDescription>Use your owner or admin credentials to continue.</CardDescription>
        </div>

        {showVerifyBanner ? (
          <div className="rounded-xl border border-[var(--warning)]/35 bg-[var(--warning)]/10 px-3 py-2 text-sm text-[var(--text-primary)]">
            Your email is not verified yet. Sign in and complete OTP verification to access dashboard features.
          </div>
        ) : null}

        <form className="space-y-3" onSubmit={onSubmit}>
          <Input
            type="email"
            placeholder="owner@lotushaven.in"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error ? <p className="text-sm text-[var(--error)]">{error}</p> : null}

          <Button className="w-full" disabled={isLoading}>
            {isLoading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <p className="text-sm text-[var(--text-secondary)]">
          No account yet? <Link href="/auth/sign-up" className="text-[var(--accent)]">Create one</Link>
        </p>
      </Card>
    </div>
  );
}
