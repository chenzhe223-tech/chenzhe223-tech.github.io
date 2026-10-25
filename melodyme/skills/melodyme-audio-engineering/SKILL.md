---
name: melodyme-audio-engineering
description: Maintain and test MelodyMe's browser-based short music previews, media events, accessible playback controls, and graceful audio failure handling. Use when changing audio preview or player behavior; do not use to add full-song playback or generate music.
---

# MelodyMe Audio Engineering

## Scope

This is a web-app adaptation of general audio engineering practices. The source skill collection at https://github.com/shortwavlabs/agent-skills primarily targets DSP and native audio-plugin development (JUCE/C++), not a browser music catalog player. Do not copy its plugin toolchain or introduce JUCE, C++, WebAssembly, or DSP dependencies into MelodyMe unless a separate, explicitly approved product requirement calls for them.

MelodyMe currently plays only a short preview when a trusted catalog response supplies a valid preview URL. It is not a full-track streaming service.

## Required implementation rules

1. **User initiated:** Never autoplay a preview. Playback begins only after a clear user action.
2. **One selected preview:** A selected track must not render duplicate audio controls or duplicate itself in the alternative-candidate list. Keep one authoritative playback state.
3. **Native browser media first:** Prefer `HTMLAudioElement` for provided preview URLs. Do not fetch and re-host audio bytes without a legal and technical requirement.
4. **Events, not guesses:** Use `play`, `pause`, `ended`, `timeupdate`, `loadedmetadata`, `canplay`, and `error` as needed. Reflect actual media state; don't show “playing” before the browser accepts playback.
5. **Mobile resilience:** Test iOS Safari gesture restrictions, interrupted network, tab/background changes, repeated play/pause, changing tracks while playing, and missing/expired preview URLs.
6. **Accessible controls:** Play/pause controls need an accessible name, visible focus, at least 44 CSS px touch target, disabled/loading/error states, and a readable time indicator where useful.
7. **Resource cleanup:** When switching tracks or unmounting a player, pause old media, detach stale listeners where appropriate, and avoid overlapping audio elements.
8. **Graceful failure:** On unsupported/expired URLs, network failures, or rejected play promises, stop the loading state, show a concise recoverable message, and preserve the rest of the music story/poster flow.
9. **No fabricated audio:** Never substitute an unrelated URL, synthesize a fake “preview,” or claim that a track is available if the response lacks a valid preview URL.
10. **No unauthorized full playback:** Do not bypass DRM, paywalls, regional controls, authentication, or a provider's terms. No covert downloading or extraction.

## Validation checklist

- A track with a valid preview URL starts only after tapping Play.
- A track without a preview URL has no misleading enabled Play button.
- Switching candidates cannot leave two tracks playing.
- Rapid repeated taps do not create duplicate audio elements or inconsistent state.
- Pause, resume, ended, error, and offline states are reflected correctly.
- iPhone Safari viewport and touch targets remain usable.
- The browser console contains no new uncaught media errors.
- Test results distinguish automated checks from real iPhone/device verification.

## Source and adaptation note

Reference: https://github.com/shortwavlabs/agent-skills  
The repository's published skills are focused on DSP/audio-plugin workflows; this file is a MelodyMe-specific adaptation, not a copy of its implementation.
