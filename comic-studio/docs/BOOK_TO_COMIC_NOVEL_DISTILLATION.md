# WORLD/TOON · Book-to-Comic Novel Distillation

## Goals and source credit

The WorldToon editor integrates a **novel-focused, browser-side adaptation of the chapter indexing, structured retrieval, and evidence traceability concepts** of [virgiliojr94/book-to-skill](https://github.com/virgiliojr94/book-to-skill) (MIT license). It is **not** the original Python book-to-skill runtime nor a claim to have embedded its entire CLI. WorldToon novel-core.js and novel-studio.js are independently implemented for the existing V4 browser application. The upstream tool is designed primarily for technical books; a novel requires a different extraction ontology (character, narrative structure, themes, chapter anchors and rights mode).

## User journey

1. From the V4 "AI 编剧" stage or "创意导演台 → 剧情分镜", open **小说蒸馏 · Book to Skill**.
2. Upload a TXT / Markdown / text-layer PDF / EPUB (max 40MB). The browser extracts every eligible chapter and computes a SHA256. No source file uploads on select.
3. Inspect chapter headings, source locators, theme counts, candidate characters, and the extraction report. These are **source-grounded lexical cues**, not AI semantic understanding, narrative truth or publication clearance.
4. Select **文学导读** for works without adaptation rights; the editable 9-panel output uses the three approved axes: brief verified introduction (01–03), independent philosophical criticism (04–06), and original contemporary reader's meaning (07–09). No plot reenactment.
5. Select **剧情改编** only after confirming adaptation rights and providing an HTTPS rights-evidence link. This attestation is not equivalent to independent legal verification; formal QA remains required.
6. Apply the structural index. This creates nine source-anchor-bearing **editable director placeholders**, invalidates previous author creative lock, and preserves source digest, chapter index and risk annotations. It does not mark content as model-reviewed or finished.
7. The "复制深度语义蒸馏指令" and/or next ChatGPT task ZIP requests chapter-level narrative analysis, actual character relationships, turning points, philosophical commentary and evidence-linked nine-panel proposal. It must be grounded in original source material and independently reviewed before re-locking creative direction.
8. The ChatGPT ZIP contains `novel-skill.json` and `NOVEL_DISTILLATION.md`. If and **only if** the user explicitly opts to include the source in an outbound ZIP, a SHA-matched local IndexedDB copy is also packaged as `source/private-novel-original.<ext>`; it is **not** silently uploaded by the application. WorkBuddy does not receive manuscript bytes in direct task generation.
9. After human review the existing cartoon asset pipeline remains unchanged: author locks screenplay/style/cast → 1 cover + 9 independent PNG → QA → separate publication authorization.

## Privacy, limits and status

- Raw novel is only held in browser memory on initial read; when the user selects to keep a local copy, bytes are stored under a project-scoped IndexedDB key. Only a short structural index and digest are persisted as project metadata, which can sync with the account.
- No paid model calls are triggered by file upload, chapter indexing or applying the draft. Deep semantic distillation remains a **separate ChatGPT / configured-model action**; mark its absence explicitly.
- The system does not run OCR on scanned PDFs. For incomplete text extraction, oversized books (>4 million characters or >500 parsed chapters), unsupported files and corrupted sources, it fails with an explanation rather than silently truncating material.
- Word counts, chapters, keyword counts and potential names are lexical heuristics. Theme and character observations require actual verification with the source and may not be treated as facts without review.
- Rights may differ across jurisdictions and translations. Book introduction, commentary and fair use exceptions are context-dependent; do not assert universal immunity from copyright. Never equate lawful possession of a book with permission to republish an adaptation.
- The task JSON includes `novel_source_skill`, explicit `semantic_status=not_performed`, the precise source SHA256 and a flag indicating whether actual manuscript bytes were included. A missing source cannot be represented as attached.
- **Not built:** automatic multi-model semantic inference from full books without user action, OCR, automatic source licensing, or author-approved production images from the distillation itself.

## Acceptance

`node comic-studio/tests/novel-core.cjs` checks full-source handling, chapter provenance, false-semantic-prevention and SHA256. `node comic-studio/tests/novel-integration-browser.cjs` checks the rendered editor, actual local file import, nine source-anchored storyboard suggestions, explicit export consent and the real ZIP.
