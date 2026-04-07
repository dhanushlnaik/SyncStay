"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

type VerifyEmailCardProps = {
  email: string;
};

const RESEND_COOLDOWN_SECONDS = 30;

async function postAuthRequest(path: string, payload: Record<string, unknown>) {
  const response = await fetch(`/api/auth${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = (await response.json().catch(() => null)) as
    | { message?: string; error?: { message?: string } | string }
    | null;

  if (!response.ok) {
    const message =
      body?.message ??
      (typeof body?.error === "string" ? body.error : body?.error?.message) ??
      "Request failed";
    throw new Error(message);
  }

  return body;
}

export function VerifyEmailCard({ email }: VerifyEmailCardProps) {
  const router = useRouter();
  const [otp, setOtp] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoSentRef = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }

    const interval = setInterval(() => {
      setCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldown]);

  const sendOtp = useCallback(async (manual: boolean) => {
    setIsResending(true);
    setError(null);

    try {
      await postAuthRequest("/email-otp/send-verification-otp", {
        email,
        type: "email-verification",
      });
      setMessage(manual ? "New OTP sent to your email." : "OTP sent to your email.");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to send OTP");
    } finally {
      setIsResending(false);
    }
  }, [email]);

  useEffect(() => {
    if (autoSentRef.current) {
      return;
    }

    autoSentRef.current = true;
    void sendOtp(false);
  }, [sendOtp]);

  const onVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsVerifying(true);
    setError(null);
    setMessage(null);

    try {
      await postAuthRequest("/email-otp/verify-email", {
        email,
        otp,
      });
      setMessage("Email verified successfully. Redirecting...");
      router.push("/onboarding");
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Invalid OTP");
    } finally {
      setIsVerifying(false);
    }
  };

  const onSkipForNow = async () => {
    await authClient.signOut();
    router.push("/auth/sign-in?verifyRequired=1");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md space-y-5">
        <div>
          <p className="font-serif text-3xl text-[var(--text-primary)]">SyncStay</p>
          <CardTitle className="mt-1">Verify your email with OTP</CardTitle>
          <CardDescription>
            We sent a verification code to <span className="font-medium text-[var(--text-primary)]">{email}</span>.
          </CardDescription>
        </div>

        <form className="space-y-3" onSubmit={onVerify}>
          <Input
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="Enter 6-digit OTP"
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
            required
          />

          {message ? <p className="text-sm text-[var(--success)]">{message}</p> : null}
          {error ? <p className="text-sm text-[var(--error)]">{error}</p> : null}

          <Button className="w-full" disabled={isVerifying || otp.length < 6}>
            {isVerifying ? "Verifying..." : "Verify Email"}
          </Button>
        </form>

        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={() => void sendOtp(true)}
            disabled={isResending || cooldown > 0}
            className="flex-1"
          >
            {isResending ? "Sending..." : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend OTP"}
          </Button>
          <Button variant="ghost" onClick={onSkipForNow} className="flex-1">
            Skip for now
          </Button>
        </div>

        <p className="text-xs text-[var(--text-muted)]">
          You can skip this step now, but dashboard and API features stay blocked until your email is verified.
          <Link href="/auth/sign-in?verifyRequired=1" className="ml-1 text-[var(--accent)]">
            Return to sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}
