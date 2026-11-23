"""Build a deterministic standalone preview Worker from the reviewed local editor.

No external network, tokens, production writes, or deployment side effects.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MARKER = '"__DAVYLAB_EDITOR_HTML__"'


def build():
    source = (ROOT / "preview-worker.js").read_text(encoding="utf-8")
    editor = (ROOT / "editor.html").read_text(encoding="utf-8")
    if source.count(MARKER) != 1:
        raise ValueError("preview worker bundle marker missing or repeated")
    if "DAVYLAB News Engine" not in editor or "editorForm" not in editor:
        raise ValueError("editor validation failed")
    return source.replace(MARKER, json.dumps(editor, ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    target = Path(args.out)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(build(), encoding="utf-8")
    print("Built independent Worker preview from same editor source; no deployment")


if __name__ == "__main__":
    main()
