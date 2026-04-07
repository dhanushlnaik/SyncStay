import { NextRequest, NextResponse } from "next/server";

import { propertyOnboardingSchema } from "@/lib/contracts";
import { upsertPropertyRegistration } from "@/lib/onboarding";
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

  const parsed = propertyOnboardingSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await upsertPropertyRegistration(authResult.domainUser.id, parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save property registration" },
      { status: 400 },
    );
  }
}
