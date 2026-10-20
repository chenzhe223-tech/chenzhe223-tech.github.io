# DAVYLAB Daily Poster QR Acceptance Gate

This is a release gate, not a best-effort check.

## Required URL

The QR code must encode exactly:

`https://chenzhe223-tech.github.io/radar/daily/`

## Daily build requirements

1. Generate the QR locally with a standard QR encoder. Never draw QR-like patterns or depend on a remote QR image service.
2. Embed the QR in both the dated final PNG and `radar/posters/latest.png`. Keep a clear quiet zone and sufficient module size / contrast.
3. Decode the QR from each final composed PNG with OpenCV's QR decoder. Do not validate only the standalone QR source.
4. Compare decoded text byte-for-byte / character-for-character with the required URL.
5. Check QR geometry, at least 12 px of clear quiet zone in the rendered poster, sufficient contrast, and a minimum detected QR size.
6. Make an HTTP request to the exact target page and require a successful response.
7. Write `radar/posters/YYYY-MM-DD.qr-verification.json` and `radar/posters/latest.qr-verification.json` with the result.

## Fail closed

- The workflow step `Mandatory final-image QR and destination gate` runs before any daily output is committed.
- Any error, empty decode, URL mismatch, missing QR geometry, poor contrast, insufficient quiet zone, or unreachable destination makes the step fail.
- Failed output is not committed, so it cannot overwrite the public latest poster.
- The scheduled preflight may skip a day's work only when today's report and poster are complete and the matching QR verification manifest says `PASS`.
- The post-deploy job downloads both the dated poster and `latest.png`, decodes their QR codes again, compares the exact URL, and checks the public verification manifest.
- If the decoder cannot prove a URL, the result is `FAILED / NOT VERIFIED`; visual inspection or successful QR generation is not proof of scanability.

## Scope

This automated check verifies digital decoding and destination reachability. A physical-device scan can provide additional assurance, but it must never be used to waive a failed automated check.
