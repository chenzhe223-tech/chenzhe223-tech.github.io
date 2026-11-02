# KeyPocket — Skill Radar 全球热门榜单

更新：2026-11-02

## 1. 数据来源与采集
每日 GitHub Actions 运行 keypocket/scripts/collect-skill-radar.cjs：
- 使用 GitHub Public Repository Search 检索 skill、agent skill、Claude skill、Codex skill 和 MCP 相关项目。
- 排除私有、归档、Fork 与明显教程/路线图类仓库。
- 读取公开 README，检查 Skill 文件、Agent Skills、Claude Code、Codex、MCP 等相关性。
- 保存原生 owner、仓库名称、公开 URL、Stars、Forks、语言、Topics、更新时间、README 相关性分数。
- 将当日 Stars/Forks 写入唯一的 (repo_id,sampled_on) 历史快照。

采集任务仅把公开仓库元数据写入公开榜单表。Service Role Key 只允许作为 GitHub Actions Secret，禁止放进前端或源码。

## 2. 榜单定义
- 月度：约 30 天前的快照与当前 Stars/Forks 对比。
- 季度：约 90 天前的快照与当前 Stars/Forks 对比。
- 年度：约 365 天前的快照与当前数值对比。
- 累计：当前 Stars 数量排序，不代表历史增长。

周期评分：Stars 增长 70% + Forks 增长 20% + README 相关性 10%。这是用于排序的归一化综合分，不代表安装量、活跃用户或实际使用人数。

完整周期样本未达到前不产生周期榜单。首次采集日期是历史统计起点，不回填不存在的历史数据。

## 3. 失败处理
- 工作流执行失败时不删除或清空上一版有效榜单。
- GitHub 搜索限流时有限等待重试；持续限流则整次采集失败并保留上次数据。
- 只在筛选出至少一个有效仓库后更新数据。

## 4. 一次性配置
GitHub 仓库 Actions Secrets 需要：
- KEYPOCKET_SUPABASE_URL：https://urzgghdwawpwqliafrzv.supabase.co
- KEYPOCKET_SUPABASE_SERVICE_ROLE_KEY：Supabase 项目的 Service Role Secret。

配置后从 Actions 手动运行 KeyPocket Skill Radar Daily Collector，检查日志中的 sampledOn、accepted、snapshots，并确认 Supabase 两张表有记录。

## 5. 当前状态
采集器和每日工作流已提交到升级分支；Actions Secret 未配置，首次采集尚未执行。榜单页面因此会显示真实空数据状态，而不是虚构 Top 10。
