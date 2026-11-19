import { DurableObject } from 'cloudflare:workers';
// SQLite-backed, account-isolated Durable Object. Never store API secrets here.
export class KnowaAiQuota extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS ai_daily_quota (day TEXT PRIMARY KEY, used INTEGER NOT NULL)');
  }
  async reserve(day, limit) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isInteger(limit) || limit < 1 || limit > 10) return false;
    // Single SQL statement: concurrent calls cannot overrun the limit.
    const rows = this.ctx.storage.sql.exec('INSERT INTO ai_daily_quota (day,used) VALUES (?1,1) ON CONFLICT(day) DO UPDATE SET used = used + 1 WHERE used < ?2 RETURNING used', day, limit);
    return [...rows].length === 1;
  }
}
