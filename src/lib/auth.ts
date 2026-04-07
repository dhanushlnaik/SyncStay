import { UserRole } from "@prisma/client";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

function toDomainRole(role: unknown): UserRole {
  if (role === "MASTER_ADMIN") {
    return UserRole.MASTER_ADMIN;
  }

  if (role === "STAFF") {
    return UserRole.STAFF;
  }

  return UserRole.OWNER;
}

async function sendOtpWithResend(data: {
  email: string;
  otp: string;
  type: "sign-in" | "email-verification" | "forget-password" | "change-email";
}) {
  if (!env.RESEND_API_KEY) {
    logger.warn("RESEND_API_KEY missing. OTP email skipped; using log fallback.", {
      email: data.email,
      type: data.type,
      otp: data.otp,
    });
    return;
  }

  const subjectByType: Record<typeof data.type, string> = {
    "email-verification": "SyncStay email verification OTP",
    "sign-in": "SyncStay sign-in OTP",
    "forget-password": "SyncStay password reset OTP",
    "change-email": "SyncStay email change OTP",
  };

  const subject = subjectByType[data.type];
  const html = `
    <div style="font-family: Inter, Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1f1a17;">
      <h2 style="margin: 0 0 12px;">SyncStay</h2>
      <p style="margin: 0 0 8px;">Use this one-time password to continue:</p>
      <p style="font-size: 30px; letter-spacing: 8px; margin: 12px 0 16px; font-weight: 600;">${data.otp}</p>
      <p style="margin: 0 0 6px; color: #6b6257;">This code expires in 10 minutes.</p>
      <p style="margin: 0; color: #8c8377; font-size: 12px;">If you did not request this code, you can ignore this email.</p>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: [data.email],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    logger.error("Failed to send OTP email via Resend", {
      email: data.email,
      type: data.type,
      status: response.status,
      responseText,
    });
    throw new Error("Failed to send OTP email");
  }
}

export const auth = betterAuth({
  appName: "SyncStay",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.BETTER_AUTH_URL],
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    modelName: "AuthUser",
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "OWNER",
      },
      isActive: {
        type: "boolean",
        required: true,
        defaultValue: true,
      },
    },
  },
  session: {
    modelName: "AuthSession",
  },
  account: {
    modelName: "AuthAccount",
  },
  verification: {
    modelName: "AuthVerification",
  },
  plugins: [
    nextCookies(),
    emailOTP({
      sendVerificationOTP: sendOtpWithResend,
      overrideDefaultEmailVerification: true,
      expiresIn: 600,
      otpLength: 6,
    }),
  ],
  databaseHooks: {
    user: {
      create: {
        after: async (authUser) => {
          try {
            await prisma.user.upsert({
              where: { authUserId: String(authUser.id) },
              update: {
                name: String(authUser.name),
                email: String(authUser.email),
                role: toDomainRole(authUser.role),
                isActive: Boolean(authUser.isActive ?? true),
              },
              create: {
                authUserId: String(authUser.id),
                name: String(authUser.name),
                email: String(authUser.email),
                role: toDomainRole(authUser.role),
                isActive: Boolean(authUser.isActive ?? true),
              },
            });
          } catch (error) {
            logger.error("Failed to mirror auth user into domain user", {
              authUserId: String(authUser.id),
              error: error instanceof Error ? error.message : String(error),
            });
          }
        },
      },
      update: {
        after: async (authUser) => {
          await prisma.user.updateMany({
            where: { authUserId: String(authUser.id) },
            data: {
              name: String(authUser.name),
              email: String(authUser.email),
              role: toDomainRole(authUser.role),
              isActive: Boolean(authUser.isActive ?? true),
            },
          });
        },
      },
    },
  },
});
