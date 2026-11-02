# KeyPocket GitHub App Worker

This Worker is the server-side GitHub App bridge. It never receives or decrypts API Key records. The browser sends only the encrypted KeyPocket vault envelope.

## GitHub App configuration

Create a GitHub App for KeyPocket with:
- Repository permissions: **Contents: Read and write**, **Metadata: Read-only** (Metadata is the implicit minimum).
- Subscribe to no webhooks unless needed later.
- Install only on the private repository named \`keypocket-cloud-vault\`.
- Use the GitHub App installation callback URL: \`https://<WORKER_HOST>/github/callback\`.

Create a private repository named \`keypocket-cloud-vault\` under the owner account, then install the App selecting only this repository. The Worker checks that it exists and is private before issuing an app session.

## Worker configuration

Set vars in \`wrangler.jsonc\`:
- \`APP_ORIGIN=https://chenzhe223-tech.github.io\`
- \`GITHUB_APP_SLUG=<the App slug>\`

Set secrets using Wrangler's secure prompt:
- \`GITHUB_APP_ID\`
- \`GITHUB_APP_PRIVATE_KEY\` (PEM private key)
- \`SESSION_SECRET\` (random high-entropy secret, at least 32 bytes)

Deploy from this directory with Wrangler. Never commit .dev.vars or private keys.

The app should be configured with \`window.KP_V2_GITHUB_WORKER_URL\` equal to the deployed Worker URL. The callback returns a seven-day HMAC-signed session in the URL fragment; the browser stores only this limited session. The App installation token is minted server-side for the one vault repository and is never sent to the browser.

## API

- \`GET /health\`
- \`GET /github/install?return_url=<KeyPocket URL>\`
- \`GET /github/callback\` (GitHub App callback)
- \`GET /github/status\`
- \`GET /github/vault\`
- \`PUT /github/vault\` (encrypted envelope only)
- \`POST /github/disconnect\`

The vault path is fixed to \`keypocket-vault.v2.json\`; callers cannot select arbitrary repository paths. Request body limit: 8 MB. The private repository remains the user's own GitHub repository.
