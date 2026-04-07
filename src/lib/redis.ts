import IORedis from "ioredis";

import { env } from "@/lib/env";

let client: IORedis | null = null;

export function getRedisClient() {
  if (!client) {
    client = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });
  }

  return client;
}
