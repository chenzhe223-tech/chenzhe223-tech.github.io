# KeyPocket V2.0 — Skill Radar 数据规范

## 数据原则
GitHub 公开仓库为主要来源。仓库名、原生作者、URL、Stars、Forks、更新时间、语言、Topics、README 相关性与每日历史快照必须有真实来源。不得把当前 Stars 当作历史增长。

月榜 30 天、季榜 90 天、年榜 365 天的增长必须由当前日快照减去对应窗口起点的历史快照计算。样本不足时标记“数据积累中”，不能倒算。累计榜按当前 Stars 排名并注明口径。每榜最多 Top 10。

## 快照字段
schemaVersion、historyStartedAt、updatedAt、boards(month/quarter/year/all)、repositories 数组；每个仓库包括 id、fullName、owner、url、stars、forks、pushedAt、language、topics、description、readmeRelevance、firstObservedAt、history(date/stars/forks)。

## 过滤
- 仅规范 GitHub owner/repo 地址。
- 优先上游原生作者与官方组织。
- 排除 archived、disabled、教程、列表聚合、同名无关和无效仓库。
- 明确区分 fork/第三方适配/原生项目。
- Stars/Forks 不等于安装量或活跃用户数。

## 自动采集
每日 GitHub Actions 采集并保存历史快照。失败保留最近一次有效数据。Token 只能在服务端 GitHub Actions/Worker 中使用，不得进前端。权重须在 UI 公开。首次历史起始日必须显示。

## 当前状态
页面四个榜单周期入口已加入，读取 `./api/skill-radar.json`。该文件、采集脚本和每日快照 workflow 尚未创建，因此页面无数据时应显示空态，不得伪造榜单。
