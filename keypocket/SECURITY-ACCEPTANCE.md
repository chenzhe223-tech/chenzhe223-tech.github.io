# KeyPocket MVP security acceptance

## Implemented controls (static/code inspection)
- [x] No account or server API in the application.
- [x] CSP sets `connect-src 'none'`; no remote scripts/styles are loaded.
- [x] API records are encrypted with AES-256-GCM before being written to IndexedDB.
- [x] Password-derived key uses PBKDF2-HMAC-SHA-256 with 310,000 iterations and a random per-vault salt.
- [x] The derived key is non-extractable and kept in memory only while unlocked.
- [x] UI masks keys by default and requires explicit reveal/copy action.
- [x] Backup file encrypts records with a separate backup password and AES-256-GCM.
- [x] Backup import rejects files larger than 10 MB, KDF iterations outside 100,000–1,000,000, malformed salt/IV/data, more than 5,000 records, invalid records, and duplicate record IDs.
- [x] Provider identification is local and conservative; ambiguous `sk-...` formats are not guessed.

## Executed checks
- [x] JavaScript syntax check with `node --check`.
- [x] Node Web Crypto tests: AES-GCM roundtrip, ciphertext does not contain plaintext, wrong password rejected, backup roundtrip.
- [x] Static checks: CSP, no remote asset URLs, IndexedDB, AES-GCM/PBKDF2, backup import/export, clipboard path, responsive breakpoint, no fetch/XHR/WebSocket calls in application JS.
- [x] JavaScript syntax check after backup-import hardening.

## Not yet verified in a real browser session
- [ ] Full end-to-end UI flows for create/read/update/delete, clipboard permissions, backup download/upload, and restore.
- [ ] Browser devtools network panel confirmation.
- [ ] Mobile visual QA on actual iOS/Android browsers.
- [ ] Live GitHub commit and Cloudflare Pages deployment.

The local browser automation environment blocked navigation to both `file://` and the local HTTP server, so these browser-level checks are explicitly not claimed as passed. Complete them after serving the package in a normal local browser or after a preview deployment.