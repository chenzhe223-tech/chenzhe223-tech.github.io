#!/usr/bin/env python3
"""Run Horizon with the repository's private-safe config and attach its Chinese digest.

The model credential is read only from the DEEPSEEK_API_KEY environment variable.
Failures are recorded without exposing environment values and do not destroy the
baseline RSS/GitHub report.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import subprocess
import sys
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[2]
REPORT = ROOT / "radar" / "data" / "latest.json"
CONFIG = ROOT / "radar" / "config" / "horizon.json"
DATA_DIR = ROOT / "radar" / "horizon-data"
HORIZON_DIR = Path(os.environ.get("HORIZON_DIR", "/tmp/Horizon"))
TZ = ZoneInfo("Asia/Shanghai")


def main() -> int:
    report = json.loads(REPORT.read_text(encoding="utf-8"))
    if not os.environ.get("DEEPSEEK_API_KEY"):
        report["ai_analysis"] = {
            "status": "unavailable",
            "message": "未检测到 DEEPSEEK_API_KEY；基础新闻与 Skill 榜单仍可正常更新。"
        }
        REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print("[horizon] API secret unavailable; keeping baseline report.")
        return 0

    if not (HORIZON_DIR / "src" / "main.py").exists():
        report["ai_analysis"] = {"status": "unavailable", "message": "Horizon 运行目录未就绪；基础日报已保留。"}
        REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return 0

    today_utc = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d")
    summary_path = DATA_DIR / "summaries" / f"horizon-{today_utc}-zh.md"
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        cmd = [
            sys.executable, "-m", "src.main",
            "--config", str(CONFIG),
            "--data-dir", str(DATA_DIR),
            "--hours", "24",
            "--log-level", "WARNING",
        ]
        completed = subprocess.run(
            cmd, cwd=HORIZON_DIR, check=False, timeout=480,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
        )
        if completed.returncode != 0:
            # Keep logs concise and never print environment variables.
            print(f"[horizon-warning] Horizon exited with code {completed.returncode}.")
            report["ai_analysis"] = {
                "status": "unavailable",
                "message": "AI 分析本次未完成，基础新闻与 Skill 榜单仍正常展示。"
            }
        elif not summary_path.exists():
            report["ai_analysis"] = {
                "status": "empty",
                "message": "Horizon 本次没有生成可发布的中文摘要；基础日报已保留。"
            }
        else:
            summary = summary_path.read_text(encoding="utf-8").strip()
            report["ai_analysis"] = {
                "status": "ok",
                "provider": "DeepSeek via Horizon",
                "generated_at": dt.datetime.now(TZ).isoformat(),
                "summary_markdown": summary[:30000],
                "summary_source": "Horizon daily digest; source URLs are included where available."
            }
            print(f"[horizon] Attached Chinese AI digest ({len(summary)} characters).")
    except subprocess.TimeoutExpired:
        report["ai_analysis"] = {
            "status": "unavailable",
            "message": "AI 分析运行超时，基础新闻与 Skill 榜单已保留。"
        }
        print("[horizon-warning] Timed out; keeping baseline report.")
    except Exception as exc:
        report["ai_analysis"] = {
            "status": "unavailable",
            "message": "AI 分析暂时不可用，基础新闻与 Skill 榜单已保留。"
        }
        print(f"[horizon-warning] {type(exc).__name__}; keeping baseline report.")

    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
