# KNOWA 2.0 P0 — knowledge asset registry

- Existing Worker, GitHub branch, NASA globe, knowledge discovery and DeepSeek daily cap are preserved.
- 36 original source-linked seed records now have IDs, citation URLs, review status, version, article routes and read-only APIs.
- GET /api/knowledge?category=&q=&limit= and GET /api/knowledge/k01 and /api/knowledge/categories.
- /knowledge catalog and /knowledge/k01 article page (responsive); browser-native read-aloud, share and local-only bookmarks.
- The initial 36 entries are **source-review-pending**; original links are not the same as independent fact verification.
- No anonymous write endpoints or changes to existing quota; personal sync, editorial workflow, R2 and media generation remain future tasks.
- Success requires CI and live HTTP checks; absent independent testing must be marked pending.
