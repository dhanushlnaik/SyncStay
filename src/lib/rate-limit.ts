type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function now() {
  return Date.now();
}

export function getRateLimitIdentifier(input: Request) {
  const forwardedFor = input.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  const realIp = input.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  return "unknown";
}

export function consumeRateLimit(input: {
  scope: string;
  identifier: string;
  limit: number;
  windowMs: number;
}) {
  const key = `${input.scope}:${input.identifier}`;
  const currentTime = now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= currentTime) {
    const resetAt = currentTime + input.windowMs;
    buckets.set(key, {
      count: 1,
      resetAt,
    });

    return {
      allowed: true,
      remaining: Math.max(0, input.limit - 1),
      resetAt,
      retryAfterMs: input.windowMs,
    };
  }

  if (current.count >= input.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: current.resetAt,
      retryAfterMs: Math.max(0, current.resetAt - currentTime),
    };
  }

  current.count += 1;
  buckets.set(key, current);

  return {
    allowed: true,
    remaining: Math.max(0, input.limit - current.count),
    resetAt: current.resetAt,
    retryAfterMs: Math.max(0, current.resetAt - currentTime),
  };
}
