import { NextRequest, NextResponse } from "next/server";

import { onboardingSubmitSchema } from "@/lib/contracts";
import { submitOwnerOnboarding } from "@/lib/onboarding";
import { requireSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  const authResult = await requireSession({
    allowUnapproved: true,
  });

  if ("error" in authResult) {
    return authResult.error;
  }

  const body = await request.json();
  const parsed = onboardingSubmitSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (!parsed.data.confirmSubmission) {
    return NextResponse.json({ error: "Submission confirmation is required" }, { status: 400 });
  }

  try {
    const result = await submitOwnerOnboarding(authResult.domainUser.id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit onboarding" },
      { status: 400 },
    );
  }
}
