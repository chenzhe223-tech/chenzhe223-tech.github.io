# KeyPocket Skill Radar

最后更新：2026-11-02（UTC+8）

## 数据来源与采集
- 采集对象：GitHub 公开仓库中与 Skill/Agent/工具生态相关的项目。
- collector：`scripts/build-keypocket-skill-radar.cjs`。
- 产物：`keypocket/api/skill-radar.json`。
- 历史：`keypocket/data/skill-radar/snapshots/`。
- 定时工作流：`.github/workflows/keypocket-skill-radar.yml`，每日执行并将可追溯指标快照写回仓库。
- GitHub 仓库指标包含真实公开 API 返回的 Stars/Forks/语言/Topics/更新时间等；数据不得凭空补齐。

## 当前真实状态
- collector 语法检查和 self-test 已通过。
- Daily Collector workflow run `41406777376`（commit `d15f8a64833891ef8cfff1f1027fa9a019db01bb`）成功。
- 已发布的榜单 JSON 包含 132 个候选仓库，当前可确认历史采样只有 1 天。
- 日榜可展示采集时的当前 Stars；月、季、年增长趋势由于历史不足，必须继续显示“历史积累中”。
- 累计 Stars 不等于近期增长量；不得将累计星标排序描述为“最近爆发/增长最快”。
- 原生官方仓库、上游作者、第三方适配、教程及同名无关项目必须区分；不得用无关项目凑数。

## 验收与限制
- KeyPocket 专项 Skill Handoff QA `41408780134` 成功，包含 collector self-test 与线上一键收录 E2E。
- collector 的持续运行和历史跨度仍需长期观察；达到足够数据前不宣布四周期趋势榜正式验收。
- Skills 的一键收录是将公开仓库元数据保存到 KeyPocket 本地加密项目库，不会自动安装代码或执行 Skill。
