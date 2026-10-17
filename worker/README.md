# DAVYLAB AI Radar Subscription

- Static preference page: `radar/subscribe/index.html`
- Worker API: `worker/src/index.js`
- D1 schema: `worker/schema.sql`
- Cron: `30 23 * * *` UTC = 07:30 China Standard Time (UTC+8)
- Email provider: Brevo transactional email API

## Deployment prerequisites
1. Create D1 database named `davy-radar-subscriptions`; run `worker/schema.sql`.
2. Replace `database_id` in `worker/wrangler.toml` with the real D1 UUID.
3. Deploy Worker with `wrangler deploy`.
4. Add Worker secret `BREVO_API_KEY` (never commit it).
5. Configure a verified sender/domain in Brevo and set `SENDER_EMAIL` to that verified address.
6. Replace `YOUR_ACCOUNT` in `radar/subscribe/index.html` with the actual Worker hostname.
7. Smoke-test /health, double opt-in, unsubscribe, and cron with test contacts before publishing the QR poster.

## Safety
The scheduled delivery blocks sends unless five stories have headlines, substantive summaries, source links, at least four unique source URLs, a fresh report date, and no explicit fallback/error top5 status. Blocked runs are logged. Per-subscriber sends are recorded.

GitHub Pages alone cannot securely store subscribers or send mail. The live subscription is not active until Worker, D1, and Brevo API key are configured. Do not advertise the QR as live before end-to-end testing.
