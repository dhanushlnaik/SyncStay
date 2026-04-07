"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    const result = await authClient.signUp.email({
      name,
      email,
      password,
    });

    if (result.error) {
      setError(result.error.message ?? "Unable to create account");
      setIsLoading(false);
      return;
    }

    router.push("/auth/verify-email");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md space-y-5">
        <div>
          <p className="font-serif text-3xl text-[var(--text-primary)]">SyncStay</p>
          <CardTitle className="mt-1">Create your owner account</CardTitle>
          <CardDescription>Register now, verify email OTP to unlock dashboard access.</CardDescription>
        </div>

        <form className="space-y-3" onSubmit={onSubmit}>
          <Input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input
            type="email"
            placeholder="owner@yourhotel.in"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Create password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error ? <p className="text-sm text-[var(--error)]">{error}</p> : null}

          <Button className="w-full" disabled={isLoading}>
            {isLoading ? "Creating..." : "Create Account"}
          </Button>
        </form>

        <p className="text-sm text-[var(--text-secondary)]">
          Already registered? <Link href="/auth/sign-in" className="text-[var(--accent)]">Sign in</Link>
        </p>
      </Card>
    </div>
  );
}
