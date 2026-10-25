# MelodyMe Poster Design System v1.0

## Status

This document describes the implementation now in the static MelodyMe frontend. It distinguishes prompt/configuration tests from actual model output validation. A successful image response is **not** proof that the requested style was visually followed.

## Architecture

- `poster-system.js`: single source of truth for nine mode definitions, style-lock prompt composition, mode-specific negative prompts, text-safe zones, prompt version, and basic image dimension/aspect-ratio checks.
- `index.html`: existing journey, selected iTunes track data, mode cards, image-service fallback, poster text composition, SVG export and local persistence.
- Image generation: existing Pollinations.ai URL first, then the existing Cloudflare Worker `generateAlbumArt` action. No new provider or secret was added.
- The generated image is background artwork only. Song title and artist are typeset in the frontend from the selected iTunes catalog candidate. If no catalog candidate is selected, the poster uses a neutral placeholder instead of presenting unverified input as confirmed metadata.
- Poster background target is portrait 3:4, requested at 768×1024 from both services (within the existing Worker width/height bounds of 256–1024).
- Same input creates a stable seed from song/style/mood/scene. This improves repeatability but does not guarantee identical output from a remote service.
- Image checks currently verify image decoding, portrait ratio (0.68–0.82), and minimum dimensions (600×800). They do **not** automatically assess semantic style fidelity, face integrity, negative-prompt compliance, or text-safe-zone composition. The status explicitly says visual style quality has not been automatically verified.

## Nine modes

| ID | Mode | Locked visual language |
|---|---|---|
| `cinematic` | 电影感氛围 | Cinematic photography, layered depth, plausible key light, restrained midnight palette |
| `geometric` | 几何排版艺术 | Swiss modernism, modular grid, controlled asymmetry, limited colors |
| `surreal` | 超现实梦境 | One coherent impossible scene, convincing scale and soft atmospheric light |
| `analog-film` | 复古胶片 | Believable 35mm photography, subtle grain/halation and natural color shifts |
| `sound-visualization` | 声音可视化 | Organized waveforms/resonance geometry, not fake player UI or fake data |
| `artist-editorial` | 歌手与专辑编辑 | Music-magazine editorial photography; fictional/non-identifiable subject without authorized reference |
| `nature-healing` | 自然治愈 | Quiet believable landscape, natural light, muted botanical/coastal palette |
| `futuristic-digital` | 未来数字音乐 | One sculptural metallic/glass structure, controlled directional light and dynamic perspective |
| `color-sketch-comic` | 彩色素描漫画 | Actual hand-drawn pencil strokes, expressive ink outlines, watercolor layering and paper texture |

Color Sketch Comic includes three independent substyles:
- `lively-pencil`: brighter palette, lively poses, directional rhythm marks and visible colored-pencil strokes.
- `gentle-journal`: quieter everyday scene, more negative space, delicate pencil and watercolor texture.
- `comic-panels`: deliberate panel-like composition, stronger ink outlines and dynamic lines.

## Prompt composition

Each mode has: `styleId`, `styleName`, `designIntent`, `compositionRules`, `palette`, `lighting`, `materials`, `subjectGuidance`, `negativePrompt`, `reservedTextZones`, `qualityChecks`, and `promptVersion`.

The composer locks the style first, then adds only bounded mood/scene cues and an optional palette nuance. It always asks the model for background artwork only, with no song title, artist text, logos, QR codes, player controls, or fake metadata. If the provider has no separate negative-prompt parameter, mode-specific and global exclusions are included in the positive prompt as explicit restrictions.

## Image generation and failure handling

- Pollinations.ai is requested first with a portrait ratio and deterministic seed.
- After an image load error, 12-second timeout, or failed basic image check, the Worker fallback is attempted.
- Worker response must be a non-empty `image/png` response. The Worker itself remains responsible for its existing model fallback and input bounds.
- The image is only marked as loaded after the browser decodes it and the basic technical checks pass.
- If both paths fail, the generated image is hidden; story copy, selected track data and SVG export remain available.
- Mode changes invalidate the old generated image, so an image from one mode is not silently reused for another.

## Tests and acceptance boundary

The CI workflow now includes:
- Browser JavaScript syntax checks.
- Nine-mode configuration checks.
- 27 prompt-composition combinations (9 modes × 3 moods).
- Three comic substyle checks.
- Basic image technical-check pass/fail cases.
- Playwright desktop/mobile journey checks, mode switching, image fallback, saving and no-overflow checks, using a deterministic 768×1024 test image.

These are configuration and simulated-flow tests. They do **not** count as 27 real image generations, do not score image semantics, and do not establish production Worker/model availability. A real visual acceptance run still needs 3 representative songs per mode, generated-image review, and verified deployed-browser checks.

## Known limitations

1. No vision-model-based 100-point style scoring is wired in; the app must not display invented scores.
2. Text-safe zones are included in prompts and the frontend uses bounded layout, but there is no face/subject segmentation to prove text will never overlap a face.
3. SVG export embeds the generated image by its remote image URL rather than bundling the raster bytes. The export visually matches when the URL remains accessible; offline/self-contained export is not guaranteed.
4. The public Pollinations service and configured Worker are external dependencies. Real generation latency, quota, model availability and visual quality remain environment-dependent.
