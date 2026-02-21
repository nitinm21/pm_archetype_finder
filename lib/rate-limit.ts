const buckets = new Map<string, { count: number; expiresAt: number }>();

export function isRateLimited(key: string, limit = 60, windowMs = 60_000): boolean {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.expiresAt < now) {
    buckets.set(key, { count: 1, expiresAt: now + windowMs });
    return false;
  }

  if (existing.count >= limit) {
    return true;
  }

  existing.count += 1;
  buckets.set(key, existing);
  return false;
}
