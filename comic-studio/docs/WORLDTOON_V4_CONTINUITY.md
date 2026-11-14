# WORLD/TOON V4.0 — 持续开发、验收及阻碍交接

**快照日期:** 2026-11-14 (Asia/Singapore)  
**安全边界:** 不含个人凭据、API Keys、未发表漫画或商业敏感内容。该文档是工程状态，不是作者批准、模型生成、GitHub 交付或发表回执。

## 1. 唯一入口与现有代码

- Frontend: `chenzhe223-tech/chenzhe223-tech.github.io`, `comic-studio/`
- 功能分支: `feature/worldtoon-v4-unified-production-20261113`
- 草稿 PR: https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/pull/139
- 私有生产/验收仓库: `chenzhe223-tech/worldtoon`
- 配套草稿 PR #7: https://github.com/chenzhe223-tech/worldtoon/pull/7
- Cloudflare live: https://worldtoon.chenzhe223.workers.dev/
- read-only Cloudflare 部署核验 (2026-11-14): 最新 Worker `worldtoon` 仍为 `2026-11-12T06:45:53Z` 部署，版本 `be6759cc-5ca8-44a4-9e71-c236c6156fc4`; **V4 分支未部署**。
- 单一约定：始终在现有 PR/分支与协议推进，不重建产品，不覆盖历史作品，不启用收费模型/服务，不代作者审核或 WorkBuddy 发表。

## 2. 已实现但仍在草稿的功能

1. 三入口：热点改编 / 一句话创作 / 自主创作；复用同一作品主数据和既有模块。
2. 七步路线：故事方案 → 角色设定 → 剧情分镜 → 视觉风格 → 正式生成 → 审阅精修 → 导出发布。
3. Character Bible：复用资产、作者确认 AI 角色、版本 ID 锁定、作品内造型覆盖、角色与九格生产指令一致性。
4. 不触发收费模型的 DeepSeek 费用确认；原始 PNG/封面技术 ZIP SHA256 检验及反向导入/篡改拒绝。
5. 独立审批、真实 pilot/作者授权、私有 GitHub 与 WorkBuddy 责任边界。
6. 本机草稿原子创建、保存状态提示、云端异常不影响本机成功保存；新角色建档/作品关联在存储失败时自动回滚。
7. 发表状态防误报：不再仅凭文章链接认定已发表，需私有仓库返回 `wechat_official_backend` 后端核验、时间戳、交付 SHA256 及无未解决问题。

## 3. 最新真实测试证据 (不夸大)

- 代码 HEAD (创建本文件前): `dbf7f670dd26a37c8882321ad294039c3ee770f4`。
- Frontend CI: `43568294021` 静态质量、`43568294035` V3/V4 回归、`43568294038` 移动契约、`43568294054` Chrome 浏览器 E2E，均为 **success**。
- Chrome E2E: 真实创建三个入口、角色确认和复用、离线刷新、390px 手机、820px 竖屏与 1180px 横屏平板、超限草稿回滚、角色资产建档失败回滚、云同步调度失败后的本机保留、九格+封面合成测试图片 ZIP 的解压/SHA 校验，共 10 个浏览器流程通过。
- 图片验收只用 **明确标注为 synthetic 的技术样本**；不能解读为真实漫画美术、版权、人物连续性或公众号图文排版已合格。
- 私有仓库 PR #7 CI: `43410394525` success；这只验证 Schema/角色版本合同，不代表用户审批。
- 浏览器曾在 `43567600320` / `43567941334` 出现测试不稳定或失败，添加角色保存诊断、同步等待和新的原子回滚测试后，最近完整浏览器用例通过；如再次失败应检查真实日志，不准标记 QA Passed。

## 4. 阻碍台账 / 不得越权绕过

| ID | 状态 | 真实阻碍 | 解锁前需要的独立证据 |
| --- | --- | --- | --- |
| G1 | BLOCKED | 真实商业级 2 张 pilot 及 9 格+封面生成未验收；收费生图默认关闭 | 获明确的模型费用授权，按创意锁定约定生成真实角色样稿/首格，并让作者独立审查，不能用技术测试图替代 |
| G2 | BLOCKED | Supabase 登录态的两设备数据同步、权限隔离、刷新恢复未做真实端到端测试 | 经用户授权的独立登录环境与真实读写结果；无账号凭据不得假设通过 |
| G3 | BLOCKED | 实际 9 格正式美术 / 中文文字 / 构图 / 版权与角色稳定性没有可用的真实逐格 QA | 每张可读取的 1080×1440+ 真 PNG、独立封面、清晰事实来源和版权检查，逐图验收 |
| G4 | BLOCKED | 私有 GitHub 工单、样稿 SHA、两层作者批准、最终交付和 WorkBuddy 真实回执没有完成贯通测试 | 在真实任务 ID 下入仓、SHA256 核验、Actions QA、两次独立作者批准，最终 WorkBuddy 微信后台回执；不得写假文件 |
| G5 | BLOCKED | 尚未合并正式版，也未在 Cloudflare V4 实际上线复核 | 先通过 G1-G4 所需的可验证验收/必要授权，再按实际部署权限灰度发布、核对版本及线上 PC/Pad/Phone |

## 5. 接手 Agent 的直接执行指令

1. 查询两个现存 PR 的 HEAD 和 GitHub Actions，检索本文件与 `WORLDTOON_V4_20261113_ACCEPTANCE.md`；**先去重，不重复提交已解决的问题**。
2. 优先无偿、可证明的改进：增强健壮性、真实失败/恢复测试、角色版本不漂移、视觉入口的移动/平板可用性、打包完整性/校验、RLS 权限合规检查。
3. 每次修复提交到同一功能分支；`worldtoon-v3.js` 最后必须带有 canonical `workflow-v4.js`，`worldtoon-v3.css` 必须与 `workflow-v4.css` 同步，否则 Worker 资源白名单无法正确发布。
4. 在对应 commit 上至少验证四个前端 CI；如改变私有任务协议，额外检查私有仓 PR #7 CI。先修复失败，再报告状态。
5. 每次推进把 commit、run URL/ID、通过/失败、阻碍及唯一下一步写回本文件；无需空提交。功能未测必须标记 partial。
6. 一旦触及付费模型、用户账号授权、作者样稿/终审批准、公众号权限或部署风险，**不得擅自启动**；留下准确的待用户操作和恢复命令，不做虚构代理操作。

## 6. 严格阶段验收

- **Code Completed:** P0/P1 较完整，P2/P3 真实商业级生图/发表闭环待完成。
- **Build Passed:** 2026-11-14 最新技术 CI 全绿（上述 SHA）；后续每次变更都重新检查最新 commit。
- **Runtime Verified:** 老 Worker 存在；**V4 未核验**。
- **Functional Tested:** 本地无付费浏览器路径通过；认证、多设备、收费模型和正式 9 图生产 **未通过/未测试**。
- **Production Deployed / Author Approved / WorkBuddy Ready / Published / Archived:** **全部 NO**，不得自行升级状态。

> WORLD/TOON · By DAVYLAB — 真实代码、真实验收、可恢复交接；没有达到标准就保留阻碍状态。

## 7. 2026-11-14 角色姓名输入异常与二次回归

- GitHub Actions run `43568436748` and `43568596554` 曾真实失败：Chrome 里角色名称必填字段在连续填写角色属性后清空，而外观、服饰等字段保留，原生 HTML 表单拒绝提交。这是 UI 输入稳定性缺陷，不是 QA 人工忽略项。
- 修改 `workflow-v4.js`：角色创建表单关闭自动填充；人名输入改为 `name=characterName`，对已有 `name` 的调用保持兼容；同步 Worker allowlist 中的 `worldtoon-v3.js`。
- 浏览器用例明确检查名字填写完其他字段后仍完整，且点击后实际写入角色、资产快照与版本引用；另独立检查存储超限时不会残留角色资产。
- 代码提交 `6659ab743dfed5307bb154810cc0648809224d07`：GitHub Actions **4/4 success**，对应 runs `43568768592`（静态）、`43568768600`（V3/V4）、`43568768603`（移动）、`43568768633`（Chrome 实测 10 路径）。这不证明商业漫画美术/登录云端/公众号已完成。
- 持续风险：曾观察到表单输入不稳定；对后续每次合并前的独立浏览器复测执行失败即阻断，不靠单次绿灯宣布完全消除。
- **未完成门禁 G1-G5 不变。**

## 8. 2026-11-14 热点失败回滚与发布门禁二次验证

- 高风险错误已修复：V4 热点入口先创建新项目，原逻辑在浏览器存储失败、`newProject(topic)` 返回 null 后仍调用 `selected()`，可能错误重定向并修改上一个作品的工作数据。现改为 `const p=newProject(t);if(!p)return;`，成功后才允许进入七步编辑。
- 真实 Chrome 专门构造旧作品 + 存储空间不足 + 热点新建：验证 **不进入旧作品作为新任务**、旧标题/描述/entryType/项目数量保持原样，失败正确报告。技术导入的测试热点需要页面重新读取持久化数据；已修复测试夹具。
- 角色名称字段改名与禁自动填充仍保留，真实 Chrome 角色建档和失败回滚继续通过。
- 源码 commit `a0194e597f3e2188a523736b33f98de793d56811` **4/4 CI success**:
  - V3/V4 回归 `43569228611`
  - 静态质量 `43569228581`
  - 移动端 `43569228538`
  - Chrome 浏览器 E2E `43569228568`（现共 11 项路径）
- 上述是技术质量证据，不是模型真实输出、用户跨设备认证、Cloudflare V4 发布或公众号发表证明；**G1–G5 阻碍仍保留**。下一次自动续推先确认本文件后续源码 HEAD 和 CI，不得只使用此历史绿色 SHA 认定最新版本通过。

## 9. 2026-11-14 20:40 SGT · 真实重绘丢字/旧导演损坏/作品复制恢复

本轮起点 PR #139 HEAD `1101c09c828e7becf974954c23ea81c3d2d95bf1`，该提交静态/布局/回归三项成功，但真实 Chrome job `43594583760` 失败：连续角色字段填写过程中 `characterName` 丢失。这不是可以忽略的偶发失败。

### 已真实修复

- `workflow-v4.js` 中角色建档新增项目 ID 隔离的 **内存临时表单快照**，input capture + render 前 FormData 双保险，支持异步重绘后还原姓名、外观、服饰及其他原有字段；仅提交成功后清除，未经显式确认不创建角色资产。
- Chrome 自动化新增 **填写角色名称后强制调用 `render()` 两次**、检查原始内容保留，再验证确认建档及版本引用。相关改动同步进 Worker allowlist 的 `worldtoon-v3.js`。
- 旧导演数据可能只有 `styleId` / `approval`，没有完整故事板。旧实现 `wtDirector.approved` 会 `TypeError`，造成新 V4 工作区加载失败并回退旧编辑器。新实现 **异常即未审批**，绝不代签锁定，并保持工作区可用。
- 正式漫画书架页面已升级为已发表展示，不再承担旧版所有编辑操作；因此已在 V4 作品工作区明确恢复 **「复制为新作」**，沿用既有只复制剧本与固定角色版本、剥离远端任务/作者审批/发表回执的安全逻辑。
- 浏览器回归改为从 **真实 V4 工作区** 执行复制，验证旧作内容/工单完整，新作审批均清零。测试中的旧版不完整导演结构保留为真实兼容性回归夹具。

### 最新验收（代码提交）

- Canonical JS / Embedded JS / tests HEAD: `e2b95f6c218d595806367bce80897491186ccb75`
- 四项 GitHub Actions **均已完成 success**：
  - static quality: https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/actions/runs/43595922921
  - mobile: https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/actions/runs/43595922871
  - V3/V4 unit regressions: https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/actions/runs/43595922873
  - actual Chrome browser E2E: https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/actions/runs/43595922864
- Chrome E2E **12 workflows**: 三入口/七步骤、作者确认角色和跨重绘恢复、原始角色库隔离、技术合成 9 PNG+独立封面哈希/ZIP 导入、手机和平板、容量故障回滚、热点创建不覆盖旧作品、复制不继承 GitHub 审批/工单、云同步调度失败本地仍保留。**合成图片仅作技术校验，不等于正式商业美术。**
- Cloudflare 只读部署检查：现网 Worker `worldtoon` 最新仍是 `2026-11-12T06:45:53Z` 发布版本 `be6759cc-5ca8-44a4-9e71-c236c6156fc4`，本次 V4 仍**未部署**。不可拿 GitHub 绿灯冒充线上验收。

### 下一轮唯一恢复优先级

1. 先读取此文件并检查 PR #139 是否出现更新 HEAD；不沿用旧 SHA 冒充新测试。
2. 启动经用户授权的 **真实登录双设备 UAT**，验证 Supabase RLS、跨设备新增/覆盖冲突、离线恢复及服务端安全策略；没有认证环境不得声明通过。
3. 只有在 **明确的模型用量/费用授权** 后才调用生成模型；先真实产出角色定妆和第一格、SHA256 入私有仓，并让作者独立确认；然后才生成 9 格 PNG+独立封面并做逐图手机 QA，确保预览和成图一致。
4. 私有 GitHub 工单/真实文件/Manifest/独立终审/WorkBuddy 状态需要按仓库协议实测，不能写人工回执。公众号发表仅在 WorkBuddy 严格授权条件下进行。
5. G1-G5 依旧 BLOCKED；**P0/P1 代码层测试通过不代表整个 V4.0 产品升级交付完成**。维持草稿 PR、未授权不合并/不部署/不收费/不发表。
