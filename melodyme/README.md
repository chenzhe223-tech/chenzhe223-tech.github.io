# MelodyMe — 音乐人生地图

> 每一首歌，都是你走过的路。

MelodyMe 是一款以音乐为线索、以人生记忆为内容的个人创作产品原型。新版从长表单转为地图式渐进探索，让用户用一句话开始，并逐步选择情绪、音乐线索和作品风格。

## 当前可体验
- 四站音乐人生地图：唤起记忆、找到感觉、发现音乐、收获作品。
- 一句话即可开始；歌曲名与歌手可选，专辑和年份不要求用户填写。
- 节点可跳过、回访；草稿与作品保存在当前浏览器。
- 故事与朋友圈文案可编辑，支持 SVG 海报导出。
- 默认本地私密，不会自动公开。

## 真实限制
这是静态交互原型。文案由本地规则生成，**尚未调用真实 AI**；没有账号、云数据库、跨设备同步、公开分享或真实 AI。用户可主动查询 Apple iTunes Search 公开歌曲目录，查看真实返回的候选、专辑信息和封面并手动选择；此功能依赖外部服务、网络和地区可用性。Shazam 只作为经过域名校验的外部歌曲链接入口，不保证网页内嵌播放。

## 本地运行
直接在现代浏览器打开 `index.html`，无需构建步骤。

## 文档
- [PRD](docs/PRD.md)
- [设计系统](docs/DESIGN_SYSTEM.md)
- [技术架构](docs/ARCHITECTURE.md)
- [测试计划](docs/QA_PLAN.md)

视频生成与 AI 视频接口不属于当前阶段。


## 新增：海报风格与音乐资料卡
- 12 种独立视觉风格，可手动选择；支持本地规则推荐（并非真实 AI 自动分析）。
- 用户主动查询 Apple iTunes Search 后，可查看真实目录候选与专辑封面并选择确认。
- 可粘贴 Shazam 官方歌曲链接，在作品内展示对应入口。Shazam 播放仍在外部服务进行，网页内嵌播放未经验证。
- 当前没有真实 AI 模型调用、云同步或账号服务。音乐查询依赖外部公开目录，可能因网络、地区或服务策略不可用。


## 当前生产验收记录（2026-10-24）
- 生产地址：<https://chenzhe223-tech.github.io/melodyme/>
- 已验证提交：`31e2fcd0769e2c3ee2070bf4bdd106e3ea9c91bd`
- 生产 smoke test：<https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/actions/runs/40081612291>
- 原型 QA：<https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/actions/runs/40081540880>
- 生产测试覆盖 HTTP 200、真实 iTunes 搜索候选与封面 URL、候选选择、12 种风格、Shazam 链接操作、保存/刷新恢复、桌面/移动端 JS 错误、390px 横向溢出和 SVG 下载。
- 测试证据 Artifact（保留 14 天）：<https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/actions/runs/40081612291/artifacts/12555795968>
- 测试不证明真实 AI、账号、云同步、双用户隔离或后端安全已经完成。
