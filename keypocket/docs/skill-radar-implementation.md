# KeyPocket Skill Radar — 采集与排名实现

## 数据来源
每日工作流使用 GitHub REST API：
- 仓库搜索：README 中明确包含 `SKILL.md` / `Agent Skills`，或 `agent-skills` topic。
- 仓库验证：读取公开仓库递归 Git Tree，必须找到仓库根目录或 skills / .claude / .agents / .github 技能目录中的 `SKILL.md` 文件。
- 过滤：仅保留非 archived、非 fork 的公开仓库；排除教程、文档、示例目录中的 SKILL.md。
- 页面展示字段来自 GitHub 返回的 owner、仓库地址、Stars、Forks、语言、Topics、描述与更新时间。Stars 不代表安装量或使用人数。

## 历史与计算口径
- 每日原始快照：`keypocket/data/skill-radar/snapshots/YYYY-MM-DD.json`。
- 前端数据：`keypocket/api/skill-radar.json`。
- 最多保留 400 天原始快照，为 365 天年榜留出缺采缓冲。
- 月榜/季榜/年榜分别以 30/90/365 天前的最近有效样本作基线；基线样本必须落在目标日期前 7 天内，否则该仓库不纳入该周期，避免把短历史误当周期增长。
- 增长值 = 当前 Stars - 基线 Stars。榜单按观察到的增长值排序，当前 Stars 用于同分排序。
- 累计榜按当前 Stars 排序，不称为累计增长。
- 首次采集时，历史周期榜显示“积累中”，不会生成虚构增长。

## 执行
GitHub Actions 每日 00:25 UTC 自动采集，也可手动运行。只使用 Actions 内置 `GITHUB_TOKEN`，不需要将 Token 写入前端或仓库 Secrets。采集失败时 workflow 失败并保留此前已提交的 JSON 与历史快照。
