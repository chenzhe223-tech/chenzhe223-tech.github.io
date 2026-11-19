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

## 2026-11-19 · 已授权配置与生产验证
- 用户明确批准：KNOWA 每 UTC 日最多 **5 次** DeepSeek 付费调用（不是按金额计费上限）。
- 已在 Cloudflare Workers settings 绑定 `AI_ENABLED=true`、`DAILY_AI_LIMIT=5`，使用 `inherit` 保留 `DEEPSEEK_API_KEY` 加密 Secret 与 `AI_QUOTA` Durable Object；绝不提交秘钥。
- 实测 `/api/health`: `aiConfigured=true`, `quotaBackendBound=true`；实测 POST 通用常识：HTTP 200、`ai=true`、`aiStatus=generated`、`verified=ai-synthesis-unverified`，约1880ms。
- 仅发起一次付费测试以保留余量。多次真实付费请求可能在同日被其他公共访客消耗，平台暂无登录身份级门禁。
- repo `wrangler.jsonc` 与已授权线上状态对齐；主入口使用包含已导出配额 DO 的 `dist/worker.js`，重新部署前运行 `npm run build && npm run test && npm run check`。
- 关闭测试：将 Cloudflare 的 `AI_ENABLED=false` 或 `DAILY_AI_LIMIT=0`；不要删除 Secret 以免影响后续恢复。
