# WORLD/TOON v1.0 测试报告

- 时间：2026-11-09（Asia/Singapore）
- 代码语法：`node --check app.js`、`node --check sw.js`、`node --check worker.js` 通过
- Chromium 隔离浏览器：`python tests/test_sandbox_browser.py` 通过
- 完成测试：初始化示例、热点录入、建立新作品、分镜模板生成、图片上传、完整 ZIP 备份、九图离线网站 ZIP、阅读翻页与键盘操控
- Python `zipfile` 验证：备份 ZIP 内含 `workspace.json` 与媒体资源，漫画静态发布 ZIP 内含 `index.html` 与 **9 个独立图片文件**
- 手机：390×844 视口无横向溢出，导航可打开并跳转
- 限制：当前执行环境禁止浏览器直连本地 HTTP URL，因此测试采用 HTML 注入方式，并在测试环境模拟浏览器来源限制的 localStorage、IndexedDB 和本地图片 fetch；**不能等同于公网真实浏览器完整功能验收**
- 上线核验：GitHub 文件提交、Cloudflare Worker 响应与线上浏览器运行需分别提供证据，测试报告不提前声明它们完成

## 回退

- 旧版保存在 GitHub 原始历史提交及 Cloudflare Worker 原脚本中
- V0.1 的 localStorage 键 `davylab_worldtoon_v01` 迁移时不删除
- 新版使用 `davylab-comic-press-v1`，并支持完整 ZIP 工作区导出

## 生产环境核验（2026-11-09）

- GitHub 发布提交：`f2bbfa2edd233b0c6218658d3267c42f874e10ac`，新增/更新 19 个文件（含首期 9 张独立图片与封面）。
- Cloudflare Worker `worldtoon` 部署版本 `fce081f2-5f0c-4ce9-a991-0d580cc34c32`，API 确认 100% 流量生效；workers.dev 子域名已启用。
- Firecrawl 实时抓取：`https://worldtoon.chenzhe223.workers.dev/` HTTP 200，页面显示 WORLD/TOON V1.0 与六个导航模块。
- Firecrawl 独立线上浏览器（只读）检查：六个模块导航均可切换；创刊作品封面加载成功（naturalWidth 840）；阅读器第 1–9 格图片均可加载（naturalWidth 840），无断图；翻页交互正常。
- 以上证明线上静态工作台可访问；不代表自动热点、AI 模型生图、真实平台直发或云端数据同步已经实现。
- 编辑内容仅保存在访问者当前浏览器。跨设备不可自动同步，请先使用完整 ZIP 备份。
