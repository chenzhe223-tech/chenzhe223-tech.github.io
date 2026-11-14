"""Publish bounded, same-origin copies of source artwork without changing provenance."""
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from hashlib import sha256
from io import BytesIO
from pathlib import Path
from urllib.request import Request, urlopen
import json

from PIL import Image
from radar.scripts.news_image_match import normalize_url

ROOT = Path(__file__).resolve().parents[2]
LIMIT = 8_000_000


def fetch_image(url):
    if not url.startswith("https://") or normalize_url(url) != url:
        raise ValueError("Only public HTTPS source images may be cached")
    with urlopen(Request(url, headers={"User-Agent": "Mozilla/5.0 DAVYLAB-SourceImage/1"}), timeout=6) as response:
        if normalize_url(response.geturl()) != response.geturl():
            raise ValueError("Unsafe image redirect")
        data = response.read(LIMIT + 1)
    if len(data) > LIMIT:
        raise ValueError("Source image exceeds cache limit")
    return data


def cache_report(report, root=ROOT, fetcher=fetch_image):
    day = str(report.get("report_date", ""))
    if date.fromisoformat(day).isoformat() != day:
        raise ValueError("Invalid report date")
    top5 = report.get("top5", [])[:5]
    visible = top5 + report.get("xnews_voices", [])[:6] + report.get("china_ai_news", [])[:1]
    urls = list(dict.fromkeys(x.get("image_url", "") for x in visible
                             if x.get("image_match_status") == "article_image"
                             and str(x.get("image_url", "")).startswith("https://")
                             and normalize_url(x["image_url"]) == x["image_url"]))
    target = Path(root) / "radar/assets/editions" / day
    target.mkdir(parents=True, exist_ok=True)

    def cache(url):
        name = "source-" + sha256(url.encode()).hexdigest()[:16] + ".webp"
        path = target / name
        if path.exists():
            with Image.open(path) as image:
                image.verify()
        else:
            data = fetcher(url)
            if len(data) > LIMIT:
                raise ValueError("Source image exceeds cache limit")
            with Image.open(BytesIO(data)) as image:
                if image.width * image.height > 40_000_000:
                    raise ValueError("Source image dimensions exceed cache limit")
                image.load()
                image.thumbnail((1600, 1200))
                image = image.convert("RGBA" if "A" in image.getbands() else "RGB")
                temporary = path.with_suffix(".tmp")
                image.save(temporary, format="WEBP", quality=86)
                temporary.replace(path)
        return "../assets/editions/" + day + "/" + name, sha256(path.read_bytes()).hexdigest()

    cached, failed = {}, []
    with ThreadPoolExecutor(max_workers=4) as pool:
        jobs = [(url, pool.submit(cache, url)) for url in urls]
        for url, job in jobs:
            try:
                cached[url] = job.result()
            except Exception as exc:
                failed.append(type(exc).__name__ + ": " + str(exc)[:160])
    eligible_top5 = [x for x in top5 if x.get("image_match_status") == "article_image"]
    if eligible_top5 and not any(x.get("image_url") in cached for x in eligible_top5):
        raise RuntimeError("No illustrated Top5 source could be cached; refusing a fragile lead: " + "; ".join(failed))
    for section in ("top5", "news", "china_ai_news", "xnews_voices"):
        for story in report.get(section, []):
            if story.get("image_match_status") == "article_image" and story.get("image_url") in cached:
                story["image_local"], story["image_local_sha256"] = cached[story["image_url"]]
    return {"cached": len(cached), "failed": len(failed), "errors": failed}


def main():
    path = ROOT / "radar/data/latest.json"
    report = json.loads(path.read_text(encoding="utf-8"))
    result = cache_report(report)
    data = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    path.write_text(data, encoding="utf-8")
    (ROOT / "radar/data/archive" / (report["report_date"] + ".json")).write_text(data, encoding="utf-8")
    print("PASS source-image cache:", json.dumps(result))


if __name__ == "__main__":
    main()
