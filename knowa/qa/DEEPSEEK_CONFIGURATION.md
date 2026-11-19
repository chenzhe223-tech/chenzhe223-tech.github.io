# DeepSeek 配置清单 · KNOWA v0.5.0
- 2026-11-19. Model `deepseek-flash`; official docs https://api-docs.deepseek.com/api/create-chat-completion/
- Worker: `davylab-knowa-p0`; branch `feat/knowa-p0-20261119`; isolated from main.
- Daily limiter: `AI_QUOTA` Durable Object `KnowaAiQuota` SQLite; atomic upsert, maximum 10 calls per UTC date.
- Enable requires ALL: `AI_ENABLED=true`, `DAILY_AI_LIMIT=1..10`, valid `DEEPSEEK_API_KEY` secret, working DO binding. Default disabled (no paid calls).
- Cloudflare 10 D1 databases already exist, so a separate D1 creation was rejected (7406); do not delete or modify other projects.
- Add secret only through Cloudflare dashboard > Workers & Pages > davylab-knowa-p0 > Settings > Variables and Secrets > Add Secret. NEVER paste into chat, commit, or plaintext vars.
- Before enabling: get explicit daily-call budget authorization; configure provider prepaid limit as independent billing control.
- After enabling: test 1 real, low-token question; confirm response `ai:true` and `aiStatus:'generated'`; check provider usage and hard quota. If error, switch `AI_ENABLED=false`.
- Known limitation: count-based cap is not a dollar-denominated cap. The DeepSeek account balance/spend controls need separate configuration.
