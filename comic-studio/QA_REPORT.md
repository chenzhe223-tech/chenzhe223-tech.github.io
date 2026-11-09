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
