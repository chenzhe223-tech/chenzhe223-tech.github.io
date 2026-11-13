# WORLD/TOON 项目交接

更新日期：2026-11-12（Asia/Shanghai）

## 新会话先看

- 线上平台：[WORLD/TOON](https://worldtoon.chenzhe223.workers.dev/)
- GitHub 仓库：[chenzhe223-tech/chenzhe223-tech.github.io](https://github.com/chenzhe223-tech/chenzhe223-tech.github.io)
- 当前实施工作树：仓库的 `.worktrees/worldtoon-character-series`。
- 当前本地分支：`codex/worldtoon-characters-series-v1`；添加本交接文档前 HEAD 为 `15505ab`，当时工作树干净。
- 注意：本地工作树的 `main` 指针停在旧提交 `e6e6d04`；远端主分支已前进。不要直接把这个旧工作树分支推到主分支。继续新改动前先核对远端 `main`，建议从最新主分支创建新分支/工作树，或仔细比较后再移植必要提交。

## 用户目标与产品边界

用户要求在现有 WORLD/TOON 与 GitHub 仓库内完成角色档案智能化、跨漫画角色身份和漫画名、整季系列规划、红果短剧/小说/名著检索、全球热点信息架构、紧凑画风选择、创作关联视觉素材，以及 Claude、Gemini、Kimi、通义千问等模型入口。用户选了方案 1，确认启动并要求当前会话直接实施、验收和部署。

保留已有作品与数据、作者审批、GitHub QA 和版权保护。现代版权作品不抓取全文、不大量复现原文。热点、题名身份、剧情摘要和版权状态要注明来源或核验状态；不得把第三方榜单写成红果官方数据，不得捏造热度或 AI 生成结果。

## 已实现并合并

1. **角色身份**：`character-continuity.js` 保存稳定角色 ID、原生名及每部漫画的别名；明确标注的男女主角会在 AI 草稿生成后自动建档。角色档案由作者审核和编辑。没有明确角色类型的旧稿不会靠名字猜测主角。
2. **AI 角色档案**：支持原生角色模型和 DeepSeek 角色草稿；DeepSeek API Key 按请求使用，UI 提示供应商可能收费。本轮未调用真实模型。
3. **系列规划**：支持 2–30 集，含全季故事弧、世界观、角色、固定服装和各集剧情/场景。作者可逐集编辑；确认后创建可继续编辑的工作台草稿，不自动发表。
4. **作品发现**：支持红果短剧/网剧、小说/世界名著、综合搜索；展示作品身份、来源、日期、权利状态和剧情候选，并可进入现有创作工作台。未核实摘要、榜单和热度会明确标识；不抓取原著全文。
5. **画风选择**：25 种画风采用紧凑推荐区与可展开图鉴；3D 效果参考图完整呈现，不冒充正式生图成果。
6. **视觉素材**：按空间、服装、配饰、建筑、交通、色彩等分类，并能指定素材作用对象/部位；保留授权门槛。
7. **模型适配**：故事分镜与系列规划入口提供原生、DeepSeek、OpenAI、Claude、Gemini、Kimi、通义千问选项；外部模型按次自带密钥。产品里的 ChatGPT/WorkBuddy 选项代表生产工作流，不等同于这些模型选择。

### 角色改名行为需继续确认

角色身份与新生成内容使用稳定 ID/漫画名，避免模型继续按旧名创作。若用户期望修改角色名后**回写已经存在的分镜对白/画面文字**，需专项验收；不要未经作者确认对已编辑分镜做全局替换。

## 发布记录

- 主功能 PR：[PR #131](https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/pull/131)，合并提交 `e0d17b159c26ef42ed1034f833096009e5b32c2a`。
- 浏览器验收夹具修复：[PR #132](https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/pull/132)，合并提交 `3e72188228bb7f169614a47085bbd974ba7f5c2d`。
- 3D 预览取消裁切：[PR #133](https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/pull/133)，合并提交 `64e8e4e6e334a225637a54334a21cc781f32d59b`。
- 后续主分支提交 `27bc53ba427d8a87ae8f60e97821d538fb000acc` 只改 KeyPocket 数据，没有改 WORLD/TOON；其 Pages 构建和部署成功。
- Cloudflare Worker `worldtoon` 最新部署记录：deployment `d156ff6e-7df0-4498-b17a-ac0dd582e45a`，版本 `be6759cc-5ca8-44a4-9e71-c236c6156fc4`，流量 100%，时间 `2026-11-12T06:45:53Z`。线上 `/health` 曾返回版本 `4.6.0`。

## 验收证据

WorldToon 主版本 `64e8e4e...` 的 GitHub Actions：

- [响应式真实浏览器验收](https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/actions/runs/43172200595)：手机 390px、平板 820px、桌面 1440px 全部通过；25 张图均加载，图片无裁切，页面无横向溢出。包含截图 artifact。
- [线上制作流程冒烟](https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/actions/runs/43172200564)：通过。
- [静态质量门禁](https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/actions/runs/43172200433)、[生产回归](https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/actions/runs/43172200473)、[V3 前端与生产守卫](https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/actions/runs/43172200533)、[线上风格图鉴图片验收](https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/actions/runs/43172200571)：均通过。
- 本地实现阶段 22 项测试套件和 DeepSeek smoke 通过。最后本地复核的 `style-v3-production.cjs`、`mobile-layout.cjs`、`character-continuity.cjs` 也通过。
- 作者审批、版权说明和不自动发表边界保留在产品流程中。

### 当前发现的非 WorldToon 检查失败

最新主分支 `27bc53ba...` 上的通用 [DAVYLAB Browser QA](https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/actions/runs/43175513141) 失败于“公众号选题工作台 smoke checks”的 selector 等待超时。失败页面不属于 WORLD/TOON；同提交 Pages 构建和部署成功，且该提交只改 KeyPocket 文件。新会话若处理此问题，应按日志单独处理，不能误报为 WorldToon 失败。

## 尚未启用/未实测

- Cloudflare Worker 设置中 `AI_ENABLED="false"`，AI binding 存在。原生 AI 编剧、生图与原生系列规划因此关闭；外部模型需要用户按次提供密钥。启用原生 AI 会开放可能产生用量成本的功能；如要改此开关，先核实成本/额度并取得明确授权。
- 没有用真实 DeepSeek/Claude/Gemini/Kimi/通义千问密钥发起生成，也没有声称其模型内容已实测。
- 最近一次手动重验时 CUA 浏览器连接中断，PowerShell DNS 也无法解析外网；线上状态由 Cloudflare 部署 API、GitHub Pages 记录和已成功的 GitHub-hosted WorldToon live smoke/browser QA 支持。恢复浏览器后可再做一次手动只读复核。
- 用户数据未被本轮验收修改；浏览器 QA 用隔离页面渲染样式，不创建或覆盖用户作品。

## 新会话建议步骤

1. 先读此文件、检查最新远端 `main` 和工作树状态，不要重做已合并的 PR。
2. 若继续验收，优先只读打开线上 `/health`、`/api/config`、`#/live`、`#/characters` 和创作工作台；不要输出密钥值或覆盖现有作品。
3. 复测用户最初报告的改名问题：修改主角漫画名后，检查新生成分镜是否使用新名；区分新生成内容与既有对白回写。
4. 与用户确认是否开启原生 AI。当前开关关闭；不要因“部署上线”自动扩大可能产生费用的调用范围。
5. 若继续改代码，从最新主分支新建工作分支/工作树；按需修复通用 DAVYLAB Browser QA 的独立失败。

## 新聊天可直接使用的开场语

> 请先读取仓库 `comic-studio/docs/WORLD_TOON_HANDOFF_2026-11-12.md`，按交接中的发布状态继续。先核对最新主分支与线上状态，再针对角色改名后的既有分镜同步做只读验收；不要重做已合并功能、不要改动用户作品、不要输出或改写任何密钥。原生 AI 当前关闭，如要开启先说明可能的用量成本并取得确认。

