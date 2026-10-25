---
name: melodyme-music-platform
description: Work on iTunes Search metadata, Apple MusicKit evaluation, track availability, provider authentication, and lawful music catalog integration in MelodyMe.
---

# MelodyMe Music Platform Integration

## Reference and compatibility
This skill is informed by the MusicKit audio skill listing previously found in the public [Claude Skill Registry](https://github.com/majiayu000/claude-skill-registry). The registry is a community catalog, not an official Apple SDK. For implementation, consult the current official [Apple MusicKit documentation](https://developer.apple.com/musickit/) and [iTunes Search API documentation](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/).

Native iOS `MediaPlayer` APIs do not run directly inside MelodyMe's static web page. Browser MusicKit JS and iOS-native MusicKit are distinct integration paths and must not be mixed up.

## Existing product boundary
The current MelodyMe flow uses real iTunes Search catalog results and available short preview URLs. Preserve that behavior. Do not imply that a preview URL gives full-song playback or that iTunes Search results grant Apple Music subscriber catalog access.

## Integration rules
1. Keep track metadata separate from playback capability. A catalog result may be metadata-only, preview-capable, or available for a separately authorized full-track playback path.
2. Use official, documented provider APIs and SDKs. Verify current auth requirements, regional availability, rate limits, attribution, artwork use, preview terms, and caching rules before implementation.
3. Never fabricate tracks, artists, album art, preview URLs, full-track availability, or provider response fields.
4. Do not commit private keys, developer tokens, or user tokens. Any secret embedded in client-side JavaScript is public. If a private secret is required, stop and propose a secure backend architecture rather than shipping it in the page.
5. Handle empty results, missing artwork, missing preview, region restrictions, authorization expiry, throttling, and network errors explicitly. Preserve user input and provide a retry or fallback.
6. Respect copyright, DRM, account, subscription, and geographic restrictions. Do not scrape, download, redistribute, or proxy protected music.
7. Add MusicKit only if the user-visible requirement justifies it and the required developer configuration, authorization flow, terms, and tests can be met. Do not add a runtime dependency merely to claim a skill was integrated.
8. Keep the current static GitHub Pages architecture unless a new capability truly requires a backend or build system.

## Suggested internal abstraction
Where it reduces coupling, normalize provider results behind a small adapter:
- `searchTracks(query)`: real metadata records.
- `getTrackDetails(id)`: metadata plus explicit preview/full-playback capability.
- `getPlaybackCapability(track)`: `full`, `preview`, or `metadata-only`.
- `playPreview(track)`: attempt supported preview playback and return a clear result.

Use the codebase's existing naming and data model if one already exists; this abstraction is guidance, not a mandate to rewrite.

## Acceptance checklist
- [ ] Every displayed track comes from a real provider response or is clearly marked demo content.
- [ ] Preview and full-track capability are not conflated.
- [ ] No secret is committed in frontend code.
- [ ] Missing previews and provider failures are clearly represented.
- [ ] Provider attribution and usage terms are documented.
- [ ] Existing search, selection, poster, story, and save flows remain compatible.

This skill is an engineering guide, not a MusicKit entitlement, API token, or license to stream full tracks.
