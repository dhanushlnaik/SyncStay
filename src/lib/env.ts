import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().default("postgresql://postgres:postgres@localhost:5432/syncstay"),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32)
    .default("syncstay-local-dev-secret-key-with-32-plus-characters"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_AUTH_URL: z.string().url().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().default("SyncStay <onboarding@resend.dev>"),
  CLOUDINARY_URL: z.string().optional(),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  SIMULATION_ENABLED: z.string().optional().transform((value) => value !== "false"),
  RECONCILIATION_ENABLED: z.string().optional().transform((value) => value !== "false"),
  RECONCILIATION_INTERVAL_MINUTES: z.coerce.number().int().min(1).max(240).default(10),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
