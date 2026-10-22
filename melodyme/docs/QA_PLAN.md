# MelodyMe 测试计划 v0.1

## 测试状态说明
本清单定义测试步骤，不代表测试已执行。每次测试需记录浏览器/设备、构建版本、步骤、预期、实际结果和证据链接。

## Phase 1 prototype checks
| ID | 场景 | 步骤 | 预期 |
|---|---|---|---|
| P-01 | 首次进入 | 打开首页 | 产品定位和创作入口清晰 |
| P-02 | 空输入校验 | 不输入故事，点击生成 | 阻止生成并提示填写一句回忆 |
| P-03 | 最小创作 | 只输入故事后生成 | 生成可编辑的本地模拟结果 |
| P-04 | 完整创作 | 输入歌名、歌手、年份、情绪 | 结果页显示对应信息 |
| P-05 | 编辑作品 | 修改故事文案 | 修改后的内容保留在编辑器 |
| P-06 | 保存记忆 | 保存作品后打开时间线 | 新记忆出现在时间线 |
| P-07 | 删除记忆 | 删除自己的记录 | 仅目标记录删除，其他记录保留 |
| P-08 | 分享权限 | 尝试打开私密记录分享 URL（后续功能） | 无权限时拒绝访问 |
| P-09 | 移动端布局 | 390×844 和 360×800 视口检查 | 无横向溢出，主要按钮可触达 |
| P-10 | 键盘操作 | Tab/Shift+Tab/Enter 操作 | 焦点顺序合理，交互可操作 |
| P-11 | 失败恢复 | 模拟生成失败（真实 AI 接入后） | 输入保留、错误可理解、可重试 |
| P-12 | 刷新持久性 | 刷新页面 | 原型本地存储；生产版须验收云端持久化 |

## Automated prototype test evidence
- GitHub Actions run 39823723984: passed HTML checks, JavaScript syntax check, desktop create/save/reload, mobile create flow, mobile overflow, and browser page-error checks.
- GitHub Actions run 39824055898: repeated prototype smoke checks passed after adding the architecture/schema draft.
- GitHub Actions run 39824386825: prototype and live-QA script syntax checks passed; desktop/mobile prototype smoke checks passed.
- These tests used a local static server in GitHub Actions; they do not prove real AI, account auth, cloud sync, or production backend security.

## Production live route test
The separate `MelodyMe live deployment QA` workflow checks the deployed `/melodyme/` URL after app files change on `main`. It records route response, empty-input validation, create/preview/save/reload, SVG export, desktop/mobile page errors, mobile horizontal overflow, and screenshots/JSON report as a 14-day artifact.

## Production security checks (not yet applicable to static prototype)
- Two users A/B: A cannot read/update/delete B's private memories.
- Unauthenticated requests cannot read private records.
- Changing memory IDs in URLs cannot bypass authorization.
- RLS enabled and verified for all user-owned tables.
- Server API never trusts client-supplied user_id.
- AI key absent from bundle, browser network requests, and Git history.
- Private artwork cannot be accessed via permanent public object URLs.
- Revoked share links reject subsequent access.
- Repeated requests cannot duplicate charges; retries restore job state.
- Memory deletion removes related derived content and files per policy.

## Release gate
- Static checks and build pass.
- Core end-to-end flow passes.
- Production URL returns correct page and loads assets.
- Unverified items remain explicitly marked; no implicit pass.
