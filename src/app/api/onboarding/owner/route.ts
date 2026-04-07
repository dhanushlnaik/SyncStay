import { NextRequest, NextResponse } from "next/server";

import { ownerOnboardingSchema } from "@/lib/contracts";
import { upsertOwnerProfile } from "@/lib/onboarding";
import { requireSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  const authResult = await requireSession({
    allowUnapproved: true,
  });

  if ("error" in authResult) {
    return authResult.error;
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ownerOnboardingSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await upsertOwnerProfile(authResult.domainUser.id, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save owner profile" },
      { status: 400 },
    );
  }
}
