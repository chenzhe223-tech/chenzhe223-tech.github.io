---
name: melodyme-audio-engineering
description: Engineer and verify MelodyMe browser audio previews, HTMLAudioElement lifecycle, playback controls, and failure states.
---

# MelodyMe Audio Engineering

## Project fit
MelodyMe is a browser-based web app whose current song discovery flow uses real iTunes Search results and available short preview URLs. The upstream [shortwavlabs/agent-skills](https://github.com/shortwavlabs/agent-skills) repository focuses substantially on DSP, JUCE, Pure Data, and audio plug-in workflows. Those concepts may inform specialist audio work, but native plug-in build systems are not drop-in dependencies for this web app. Use browser-native media APIs unless the product architecture changes for a justified reason.

## Required workflow
1. Read `README.md`, `docs/ARCHITECTURE.md`, and the current audio code before editing. Trace how track metadata and preview URLs are produced and passed to the player.
2. Never treat a title, catalog ID, artist name, or artwork URL as a playable audio source. Confirm a real preview URL exists.
3. Use one authoritative media element for each active preview. Avoid duplicate players or controls that imply they operate the same audio independently.
4. Synchronize UI state with actual media events and outcomes: `play`, `pause`, `timeupdate`, `loadedmetadata`, `ended`, and `error` as appropriate. Handle rejection from `audio.play()` (including browser gesture/autoplay restrictions).
5. Handle empty preview URLs, unsupported formats, network failures, unknown duration, and expired/unavailable resources gracefully. Do not claim a track is playing when playback did not start.
6. Remove old event listeners when changing tracks and avoid duplicate listeners after repeated renders or searches.
7. Keep audio playback user-initiated. Do not bypass DRM, scrape protected streams, proxy unauthorized media, or misrepresent short previews as full-track playback.
8. Keep visualizations optional and lightweight. If Web Audio API analysis is introduced, account for browser restrictions and only connect audio sources when permitted and useful.

## UX requirements
- Accessible play/pause button names and visible focus state.
- Touch targets generally at least 44 CSS px.
- Play state is conveyed by icon/text/state, not color alone.
- Track selection, loading, playing, paused, ended, and error states are distinguishable.
- A failed preview offers a clear recovery path without losing the selected track/story.

## Acceptance checklist
- [ ] A valid preview URL can load and play after a user gesture.
- [ ] Pause/resume and progress follow actual media state.
- [ ] Missing/unavailable preview displays a truthful explanation.
- [ ] Rapidly selecting tracks does not create duplicate players or stale playback.
- [ ] Repeated searches do not multiply event listeners.
- [ ] Unknown/zero duration does not break progress or seeking.
- [ ] Mobile layout and browser console remain healthy.

This skill is a development instruction set, not an audio catalog or a source of playback rights.
