---
name: melodyme-music-platform
description: Make compliant decisions about iTunes Search, Apple Music catalog metadata, and possible future MusicKit integration for MelodyMe. Use when changing music search, track metadata, preview links, provider attribution, or native Apple Music support.
---

# MelodyMe Music Platform Integration

## Important source verification

A previously listed “MusicKit Audio Skill” path in https://github.com/majiayu000/claude-skill-registry could not be found at the referenced path during repository verification. Do not claim that this repository skill is installed or copied. This file is a project-specific compatibility guide based on MelodyMe's existing architecture and publicly documented Apple platform boundaries.

Source registry: https://github.com/majiayu000/claude-skill-registry (MIT repository license; individual generated entries may have distinct origins and should be checked individually before copying).

## Current MelodyMe implementation

- Use iTunes Search results for real catalog metadata and artwork URLs.
- Only use a preview URL when it is actually returned by the provider.
- Keep preview playback distinct from Apple Music subscription playback.
- Keep AI-generated memorial art clearly labeled as AI-generated and never present it as official album artwork.
- Do not fabricate artists, titles, release years, artwork, availability, or preview URLs.

## MusicKit decision gate

MusicKit is not a drop-in replacement for iTunes Search. Consider it only when the product requirement explicitly calls for Apple Music catalog or subscriber playback beyond short previews.

Before implementation, verify the current official Apple documentation and requirements for:
- Apple Developer team and MusicKit configuration.
- Developer token creation and secure server-side handling of signing keys.
- User authorization and Music User Token handling where required.
- Required entitlements, platform support, regional availability, subscription state, and playback restrictions.
- Privacy disclosure, user consent, revocation, and error/empty states.

Never put Apple signing keys or private credentials in `index.html`, public JavaScript, Git history, or client-side environment variables. Any developer-token signing operation must remain server-side. Do not request or store an Apple ID password.

## Web versus native

- The current MelodyMe deployment is a static web frontend with a Cloudflare Worker backend. Do not assume native iOS APIs or MediaPlayer framework classes can run in this web app.
- For the web frontend, use only supported web APIs and documented MusicKit JS capabilities after checking the current official documentation.
- Native iOS MusicKit / MediaPlayer code belongs in a separate native client, not in the static web page.
- Do not add a MusicKit SDK or token flow solely to satisfy this skill. Existing iTunes Search + short preview remains the default unless requirements change.

## Search and metadata quality

1. Normalize provider response fields at the service boundary.
2. Preserve provider IDs and canonical URLs when supplied.
3. Validate URLs and tolerate missing optional fields.
4. Keep loading, empty, rate-limit, network, configuration, and provider-error states distinct.
5. Never scrape private endpoints or bypass access controls.
6. If a provider's terms, access requirements, or current behavior are uncertain, verify official documentation before implementation.

## Acceptance checklist

- Search results reflect a real provider response.
- Missing artwork/preview fields are handled without breaking the page.
- Search failures show a useful error and preserve user-entered memory/story content.
- No provider secrets appear in frontend assets or repository history.
- The UI never implies full-song playback when only a short preview is available.
- Integration is tested on the target platform; native iOS capability is not claimed from web-only testing.

## References

- Apple MusicKit: https://developer.apple.com/musickit/
- iTunes Search API documentation: https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/
- MelodyMe architecture: `../../docs/ARCHITECTURE.md`
