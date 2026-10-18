# DAVYLAB AI 前沿简报：订阅后端

## Current status

The Cloudflare D1 database and Worker are now deployed, and the cron trigger is configured. The subscription service is **not production-ready yet**: the Brevo `BREVO_API_KEY` secret is not configured, the public health endpoint has not been externally verified in this run, and end-to-end email tests remain pending. The GitHub Pages subscription page change is still on feature branch `feature/ai-news-subscription` and must not be treated as published until the PR is reviewed and merged.

## Architecture

- Static signup page: `/radar/subscribe/`
- Worker source: `radar/subscription/worker.js`
- D1 schema: `radar/subscription/schema.sql`
- Daily public JSON: `https://chenzhe223-tech.github.io/radar/data/latest.json`
- Email delivery: Brevo transactional API
- Schedule: `30 23 * * *` UTC = 07:30 China Standard Time (UTC+8)
- Double opt-in; hashed confirmation tokens; unsubscribe link; unique daily send log; quality gate blocks all sending if the edition is not safe to deliver.

## Required Cloudflare setup

Create a D1 database named `davy-radar-subscriptions`, then execute `schema.sql`. Deploy `worker.js` as `davy-radar-subscriptions` with D1 binding `DB` and the following secrets/vars:

- Secret `BREVO_API_KEY`: Brevo API key (never put this in Git)
- Secret `ADMIN_TOKEN`: strong random admin token for manual digest testing
- Var `MAIL_FROM`: verified sender address (Brevo account currently lists `chenzhe223@gmail.com`)
- Var `MAIL_FROM_NAME`: `DAVYLAB · AI 前沿简报`
- Var `REPORT_URL`: `https://chenzhe223-tech.github.io/radar/data/latest.json`
- Var `PUBLIC_SUBSCRIBE_URL`: `https://chenzhe223-tech.github.io/radar/subscribe/`
- Var `WORKER_PUBLIC_URL`: the deployed Worker origin, e.g. `https://davy-radar-subscriptions.<your-subdomain>.workers.dev`
- Cron trigger `30 23 * * *`

Set the actual Worker URL in `radar/subscribe/index.html` by replacing the placeholder `API_BASE`. Confirmation and unsubscribe links must point to the Worker origin, not the static GitHub Pages URL.

## Deploy and test

1. Create D1 and apply schema.
2. Deploy Worker and configure binding/secrets/vars/cron.
3. Check `GET /health` returns `ok: true`, `databaseConfigured: true`, `mailConfigured: true`, `reportConfigured: true`.
4. Subscribe with a test address you control. Verify confirmation email and confirmation link; verify pending records do not receive daily mail.
5. Test invalid email, empty interests, unconfirmed subscription, unsubscribe, duplicate submit, and origin rejection.
6. Use the authenticated admin digest endpoint for a test send only after the quality gate is confirmed.
7. Confirm that invalid/missing report date, fewer than five curated items, missing titles/links, duplicate links, or poor source coverage prevents the send.
8. Confirm one email maximum per subscriber per report date and inspect D1 `send_log`.
9. Scan the final poster QR code only after the real signup URL is live.

## Important limitation

This first implementation deliberately does not send if the report lacks exactly five curated stories or fails source checks. The latest observed JSON (2026-10-17) uses `top5_status: source_fallback`, with all five stories marked `fallback: true`; the Worker quality gate explicitly blocks this edition. Each edition is rechecked at send time. Interest matching currently filters the five curated stories by keyword; it is not yet a separate AI-generated per-subscriber report. Never advertise the feature as live until backend deployment and end-to-end tests pass.
