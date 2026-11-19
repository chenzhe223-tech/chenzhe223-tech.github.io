// Spend safety: a positive, small numeric quota and an atomic backend are required.
// A missing key, binding, opt-in, or quota fails CLOSED.
export const dailyAiCap = env => {
  const n = Number(env?.DAILY_AI_LIMIT);
  return Number.isInteger(n) && n >= 1 && n <= 10 ? n : 0;
};
export const aiGateReady = env => env?.AI_ENABLED === 'true' &&
  !!String(env?.DEEPSEEK_API_KEY || '').trim() &&
  !!env?.AI_QUOTA && dailyAiCap(env) > 0;
export async function reserveAiQuota(env, now = new Date()) {
  if (!aiGateReady(env)) return {allowed: false, reason: 'disabled'};
  try {
    // All users share one named DO instance: its SQLite UPSERT serializes claims.
    const ok = await env.AI_QUOTA.getByName('knowa-global-paid-ai').reserve(now.toISOString().slice(0, 10), dailyAiCap(env));
    return {allowed: ok === true, reason: ok === true ? 'reserved' : 'quota-exhausted'};
  } catch { return {allowed: false, reason: 'quota-unavailable'}; }
}
