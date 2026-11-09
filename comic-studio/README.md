# WORLD/TOON 2.0 · By DAVYLAB
世界每日上演，我们画下来。基于真实公共新闻线索的原创虚构漫画创作与出版工作台。

## 线上入口
https://worldtoon.chenzhe223.workers.dev/

## 已实现与验证
- 新闻雷达：13 大新闻领域，Google News RSS + GDELT + BBC/Guardian/NASA/行业 RSS 备援，真实来源链接与时间戳，手动入选题池；新闻线索不等于事实认证。
- 作品生命周期：九格编辑器、图片保存、书架、审核、档案、删除恢复、ZIP 和网页出口，继承《霸总的小爱情》样例。
- 角色档案：原创人物外貌、衣着、性格、颜色、识别特征；生成时使用文字角色圣经以及首格参考图片辅助一致性。
- 登录与同步：Supabase 电子邮箱/密码，项目与热点 JSON 工作区，私有图片 Bucket，用户级 RLS；同步必须明确选择首次拉取/上传。
- AI 编剧和生图端点：Cloudflare Workers AI（Gemma 4 26B、FLUX.2 klein 4B）、账户认证、D1 每日次数限制（3 剧本/2 图片）。**AI_ENABLED=false**，付费推理未经确认不可开启，前端如实显示禁用状态。
- Cloudflare Worker 已部署生产，/health 版本 2.0；AI 科技新闻源线上返回真实来源文章；角色页面运行时浏览器内容被验证。
- Cloudflare D1 配额库 `worldtoon-ai-quota`，用户数据复用现有 Supabase 项目，但新表与新私有 Bucket 独立，不修改学院既有表。

## 仍须验证
- 邮箱确认/完整账号注册及两设备来回同步（需要真实测试账号）。
- 九格自动编剧和参考图生图真实模型调用（因避免未经授权费用，开关关闭）。
- 各分类 RSS 全天候可靠性、完整跨源去重、定时自动采集与自动发布。
- 社交平台真正直发（当前仅导出供审核后发布）。

## 安全
必须核对新闻原始报道和发布时间；不可将未经核实的刑事指控、私人关系或政治交易通过匿名虚构变成影射性真人漫画。人工审核与公开虚构声明是发布前必需步骤。所有用户图片默认私有；前端仅使用 Supabase publishable key，不能暴露 service-role key。

## 部署
静态资源位于仓库 `comic-studio/`，Worker `worker.js` 代理该目录。Worker 绑定：`AI` Workers AI、`DB` D1、`AI_ENABLED` 默认 `false`。D1 SQL 见 `d1.sql`。

By DAVYLAB · 把想法，做成能用的工具。
## 2026-11-10 双轨验收更新

- GitHub 交付仓 `chenzhe223-tech/worldtoon` 已核验为 Private。
- 轨道 A 仍保留接口，不启用收费推理；两轨共用 GitHub 交付质量门禁。
- 双轨中心显示 WorkBuddy 已接单、草稿已核验、正式发表等细分状态；后台凭证缺失时明确显示需要配置，不错误推断仓库为 Public。
- Worker 静态源使用本站 `main/comic-studio/`，便于前端修改随提交更新；缓存到期后生效，保留 Git 提交用于回滚。
- 仅配置 Cloudflare Worker 服务端的 GitHub 受限令牌和 Supabase 管理员 UID 才能正式派单；此处不保存密钥。

## Comic Engine · 2026-11-10

- **素材发现**：生产 Worker `GET /api/comic/discover` 聚合全球新闻（原有 Google News/RSS/GDELT）、Hacker News、arXiv AI 论文。独立来源失败不伪造素材；输出来源标识、待核验状态和版权边界。前端六维规则评分，<60 隐藏，并可一键生成作品草稿。
- **四 Skill 编辑工作台**：`comic-engine.js` 将 baoyu-comic、scenario-storyboards、agent-comic-kit、TT_AutoManga 的开放创作方法适配为可执行的九格分镜、角色圣经、逐格绘图提示词和浏览器 PNG 排版。直接打开漫画创作台即可操作；仅已有真实图片才能合成九张 PNG。
- **真实接口/组件边界**：外部 Python/MCP 原版引擎目前**没有**作为 Worker 服务安装；平台未自动生成 AI 图片。之后若需一键完整出图，必须明确配置可用的图片模型或实际运行的 Python 后端，并核验费用和权限。
- **验收**：PR 主分支 GitHub Actions 静态和单元测试通过；线上 GitHub Actions `worldtoon-live-comic.yml` 实际核验 Worker 健康、模块可访问、Hacker News 非空采集及非法来源 400。AI_ENABLED 保持 false；Cloudflare Secret、D1 绑定保留。
- **版权**：开源采集和创作代码不意味着第三方新闻原文、图片、人物肖像已获得转载许可。未核验新闻与剧本草稿不可直接发表。

## 2026-11-10 经典与历史资料 · P0–P3 增量

- P0：新接入 Gutendex/Project Gutenberg 经典书目与 Wikidata 历史实体，正式线上测试分别确认 32 条、60 条候选。所有故事和历史实体都是待研究线索，未经过事实审核或原著/译本版权清理。
- P1：开放视觉素材接口最初选用 Met v1 Search、Art Institute of Chicago，运行时分别返回 HTTP 410（旧 Met 搜索已于 2026-10-01 下线）和 HTTP 403。现改为 Met v1.1 Search + Cleveland Museum of Art API，均要求馆藏明确标注 CC0。新版本须通过线上冒烟测试，不可仅凭本地单元测试称为运行通过。
- P2：创作台可搜索 CC0 视觉参考并保存至作品；制作包含 `production/visual-references.json`，九格提示词包含引用对象的源链接、作者、许可。参考图不是史实证据，也不自动复制到漫画成品。
- P3：增加缺格断点续做（受 `AI_ENABLED` 和用户权限、每日配额保护）及九格 PNG 技术 QA 报告；`AI_ENABLED=false` 时不产生付费 AI 图片。真实九张独立 AI 生成、角色一致性人工审校和公众号发表仍属未验收项，不能宣布完整自动生成已交付。
- 源码与线上资源遵循 GitHub + Cloudflare 部署；保留已有 Private GitHub 派单/档案、Supabase RLS、D1 和人工审核，不自动发表。
