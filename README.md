# DAVYLAB · SPARK & PULSE

**品牌主张：把想法，做成能用的工具。**

DAVYLAB 是我的个人 AI 产品实践与轻量应用开发品牌，希望让更多普通人从一个具体念头开始，低成本验证、制作和迭代自己的数字产品。

## 品牌方法
- **SPARK / 灵感**：发现真实问题，看见可能。
- **BUILD / 实现**：先做核心功能，用可体验的原型验证方向。
- **PULSE / 持续**：根据真实反馈持续修正和迭代。

## 网站内容
- 动态品牌首页、核心理念与创造方法。
- 可横向滚动的应用超市，支持搜索、分类筛选、左右浏览和产品详情。
- 真实 Logo 优先；未找到独立 Logo 的概念项目使用文字品牌名，不使用虚构占位图标。
- 真实入口的项目可直接打开；无公开入口的概念项目展示详情与状态，不虚构链接。
- 清楚标注 ¥9.9 首发体验范围与合作边界。
- 新增「开放 Skill」区，展示公开可复用的 AI 工作方法，并链接到 DAVYLAB GitHub 源码与使用说明。

## 在线网站
https://chenzhe223-tech.github.io/

## 发布
GitHub Actions 自动发布到 GitHub Pages。每次向 `main` 推送提交后，工作流会重新部署；发布完成后会自动运行 Chromium 浏览器冒烟验收并保存截图和 JSON 报告。


## Reusable image intelligence skills

This repository now maintains project-level Agent Skills for image discovery and article illustration in `.agents/skills/`: Firecrawl web extraction guidance, Google Lens Pro reverse-image/OCR, Baoyu Article Illustrator, OpenAI ImageGen, and a DAVYLAB orchestration skill. Integration notes and local activation steps are in `.agents/skills/davylab-asset-intelligence/INSTALL.md`.

The frontend remains static. Live provider API integration must run server-side (for example in a Cloudflare Worker) with secrets stored server-side. Never expose provider keys in public HTML, JSON, Git history, or browser requests. Skill files do not by themselves install local CLIs or prove live API access.
