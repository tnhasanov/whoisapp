import { sql } from "drizzle-orm";
import type { Database } from "@/lib/db/client";

/**
 * Fixed-window limiter stored in Postgres, so limits hold across web
 * instances and restarts. Returns whether the call is allowed.
 */
export async function consumeRateLimit(
  db: Database,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const result = await db.execute<{ count: number; window_start: Date }>(sql`
    INSERT INTO app_rate_limits (key, window_start, count)
    VALUES (${key}, now(), 1)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN app_rate_limits.window_start < now() - make_interval(secs => ${windowSeconds})
                   THEN 1 ELSE app_rate_limits.count + 1 END,
      window_start = CASE WHEN app_rate_limits.window_start < now() - make_interval(secs => ${windowSeconds})
                   THEN now() ELSE app_rate_limits.window_start END
    RETURNING count, window_start
  `);
  const row = result.rows[0];
  const count = Number(row.count);
  const resetAt = new Date(new Date(row.window_start).getTime() + windowSeconds * 1000);
  return { allowed: count <= limit, remaining: Math.max(0, limit - count), resetAt };
}
