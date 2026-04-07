import { redirect } from "next/navigation";

import { getServerSession } from "@/lib/session";

import { VerifyEmailCard } from "./verify-email-card";

export default async function VerifyEmailPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/auth/sign-in");
  }

  if (session.user.emailVerified) {
    redirect("/dashboard");
  }

  return <VerifyEmailCard email={session.user.email} />;
}
