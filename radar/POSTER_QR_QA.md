# DAVYLAB Daily Poster QR Acceptance Gate

This is a release gate, not a best-effort check.

## Canonical URL
The QR code must encode exactly:
https://chenzhe223-tech.github.io/radar/daily/

## Weekly style metadata
Each poster and verification manifest must include design_variant, iso_year, iso_week, style_cycle_index, style_cycle, and template_version.

The single source of truth is radar/scripts/poster_style.py::poster_style_metadata. The generator, scheduled preflight, and QR verifier must use the same algorithm. It fixes ISO 2026-W01 to Monday 2025-12-29 and alternates by every consecutive calendar week, including the ISO year boundary. Never use day-of-month parity.

## Required checks
1. Generate the QR locally with a standard QR encoder; never draw QR-like patterns or use a remote QR image service.
2. Embed it into the dated final PNG and radar/posters/latest.png with a clear white quiet zone, sufficient module size, and contrast. The current reserved QR tile is 240×240 px at x=912, y=1302 on the 1200×1800 canvas; generator, local verifier, regression tests, and post-deploy fallback crop must use this same geometry.
3. Decode the QR from each final composed PNG using OpenCV; do not validate only the standalone QR source.
4. Compare the decoded text character-for-character with the canonical URL.
5. Check geometry, at least 12 px of clear quiet zone, sufficient contrast, and minimum detected size.
6. Make an HTTP request to the exact destination and record HTTP status and final URL.
7. Write dated and latest JSON verification manifests including style metadata, QR decoding, and destination response.

## Fail closed
- The mandatory final-image QR check runs before output commit.
- Any decode error, URL mismatch, incorrect weekly style, missing geometry, inadequate contrast/quiet zone, or unreachable destination fails the job.
- Failed output cannot overwrite the known-good public poster.
- Scheduled preflight skips only when today's report, dated poster, current weekly-style metadata and PASS QR manifest all match.
- Post-deploy verification downloads the dated poster and latest.png, decodes both again, and checks live report data, style metadata, archive index, and QR report.
- A generated QR image is not proof of scanability. Report phone-camera scanning separately; never claim a real-device scan if none occurred.

## Scope
Automated decoding and HTTP checks validate digital encoding and reachability only. A physical smartphone-camera scan is additional and must be reported honestly.
