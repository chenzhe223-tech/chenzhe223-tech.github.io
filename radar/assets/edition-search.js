(() => {
  const dialog = document.getElementById("editionSearch");
  const input = document.getElementById("editionQuery");
  const results = document.getElementById("editionResults");
  function showResults() {
    const query = input.value.trim().toLocaleLowerCase();
    const en = document.documentElement.lang.startsWith("en");
    const report = reportData || {};
    const sections = [
      [report.top5, (_, i) => deepReadHref("top5", i)],
      [report.xnews_voices, (_, i) => deepReadHref("xnews", i)],
      [report.china_ai_news, s => s.source_url || s.url],
      [report.news, s => s.url],
      [report.skills, s => s.html_url || s.url || s.repo_url]
    ];
    results.replaceChildren();
    const seen = new Set();
    for (const [stories, link] of sections) {
      for (const [i, story] of (stories || []).entries()) {
        const title = (en ? story.title_en : story.title_zh) || story.title || story.full_name || story.name;
        if (!title || seen.has(title) || !title.toLocaleLowerCase().includes(query)) continue;
        const href = link(story, i);
        if (!href || !(/^(https:\/\/|\.\.\/read\/\?)/i).test(href)) continue;
        seen.add(title);
        const anchor = document.createElement("a");
        anchor.href = href;
        anchor.textContent = title;
        const item = document.createElement("li");
        item.append(anchor);
        results.append(item);
      }
    }
    if (!results.children.length) results.textContent = en ? "No matching stories in this issue." : "本期没有匹配的条目。";
  }
  document.getElementById("openSearch").addEventListener("click", () => {
    document.getElementById("searchTitle").textContent = document.documentElement.lang.startsWith("en") ? "Search this issue" : "搜索本期简报";
    input.value = "";
    showResults();
    dialog.showModal();
    input.focus();
  });
  input.addEventListener("input", showResults);
})();
