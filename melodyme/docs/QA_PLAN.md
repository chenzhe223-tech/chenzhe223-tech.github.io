# MelodyMe 测试计划 v0.2

## 当前测试范围
静态 HTML/CSS/JS 音乐地图交互原型。该测试范围不证明真实 AI、音乐目录、账号认证、云同步或后端安全已完成。

## 手工/自动化验收
| ID | 场景 | 预期 |
|---|---|---|
| MAP-01 | 首次进入 | 首屏优先显示地图与开始探索入口 |
| MAP-02 | 一句话开始 | 无需歌手、专辑、年份即可进入下一站 |
| MAP-03 | 空故事 | 继续时提示；跳过仍可探索其他节点 |
| MAP-04 | 节点选择 | 地图节点与左侧节点均可跳转到对应站点 |
| MAP-05 | 情绪选择 | 可多选、取消，刷新后保留 |
| MAP-06 | 音乐线索 | 歌名与艺人可选；专辑/年份不是必填 |
| MAP-07 | 跳过节点 | 可跳过非必要节点且可返回 |
| MAP-08 | 作品生成 | 生成可编辑故事与朋友圈文案，标注本地模拟状态 |
| MAP-09 | 保存与恢复 | 保存作品后刷新仍在本地作品集 |
| MAP-10 | 删除作品 | 仅删除选中的本地记录，并二次确认 |
| MAP-11 | SVG 导出 | 导出非空 SVG 文件 |
| MAP-12 | 复制文案 | 支持复制；剪贴板不可用时提供手动复制回退 |
| MAP-13 | 音乐外链 | 无歌曲线索时不跳转；有线索才打开查询 |
| MAP-14 | 手机布局 | 360px / 390px 视口无横向溢出 |
| MAP-15 | 错误与持久性 | 刷新后旅程恢复；控制台无未处理错误 |

## 已有证据（历史）
- GitHub Actions runs 39823723984、39824055898、39824386825：旧版原型相关桌面/移动流程曾通过。
- Run 39824918303：旧版生产 smoke test 曾验证 HTTP 200、创作/保存/刷新恢复、SVG 导出、移动端溢出与 JS 错误。
- **上述记录针对此前旧版本，不代表 v0.2 地图重构已通过。** 新版合并后必须重新运行自动化并查看实际结果。

## 尚未验证
- 真实 AI 服务及模型密钥。
- 音乐元数据 API、专辑封面授权与 Shazam 官方跳转。
- Supabase Auth、RLS、双用户隔离、跨设备同步、撤销分享。
- 服务端 Secret 未泄露与生成成本控制。
- 真实用户可用性与创作完成率。

## 发布门槛
- JavaScript 语法检查通过。
- 新版桌面与移动核心流程通过。
- 生产 URL 指向已验收提交。
- 所有未验证项目在交付报告中保留明确状态。


## v0.3 新增验收点
| ID | 场景 | 预期 |
|---|---|---|
| ART-01 | 风格选择器 | 显示 12 种可区分风格，选中状态明确 |
| ART-02 | 自动风格推荐 | 推荐后可手动覆盖；界面说明当前为本地规则，不冒称 AI |
| ART-03 | 海报样式变化 | 12 种样式有独立视觉差异，SVG 导出仍可用 |
| MUSIC-01 | 查询歌曲 | 用户主动搜索真实 iTunes 目录；加载、无结果、网络失败都有反馈 |
| MUSIC-02 | 候选确认 | 候选显示真实封面、歌曲名、艺人、专辑；用户选择后作品页显示资料 |
| MUSIC-03 | 封面来源 | 只使用 API 返回的 artwork URL；加载失败时不出现随机替代图 |
| MUSIC-04 | Shazam URL | 仅接受 shazam.com 具体歌曲链接，显示外链，不承诺 iframe 播放 |
| MUSIC-05 | 事实状态 | 候选明确标注待用户确认；不把专辑发行日期冒称歌曲发行年份 |

以上是测试要求，不代表这些新增功能已经通过生产验收。


## v0.3 生产验收结果（2026-10-24）

生产 URL：<https://chenzhe223-tech.github.io/melodyme/>

部署提交：`31e2fcd0769e2c3ee2070bf4bdd106e3ea9c91bd`。GitHub Pages 部署与生产 smoke test 均成功。

- 生产 smoke test：<https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/actions/runs/40081612291>
- 本次 artifact：<https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/actions/runs/40081612291/artifacts/12555795968>（desktop/mobile 截图与 JSON 报告，14 天保留）
- 本次生产测试通过：HTTP 200、产品标题、空故事提示、真实 iTunes 搜索返回 8 条候选、封面 URL 为 API 返回的 `mzstatic.com` 图片、候选选择后作品卡显示歌曲、12 种海报风格、可覆盖的本地风格推荐、Shazam 具体歌曲 URL 操作、作品生成、保存/刷新恢复、桌面与移动端无 JS 错误、390px 移动端无横向溢出、SVG 海报导出。
- 已知限制：自动风格推荐仍是本地规则，不是 AI；故事与朋友圈文案仍是本地规则生成；没有登录、云端保存、多设备同步或公开分享；没有音乐播放嵌入；测试未覆盖真实用户双账号隔离。
- 生产音乐目录搜索验证的是当时的真实外部响应；外部目录可能随网络、地区和服务策略变化，不能保证每次都返回相同结果。


## DeepSeek server adapter gate (not production verified)

- [ ] Deploy Worker to a controlled Cloudflare environment.
- [ ] Configure `DEEPSEEK_API_KEY` as a Worker secret; verify it is absent from client assets and logs.
- [ ] Configure exact allowed origin and edge rate limiting.
- [ ] Test all six action schemas against real DeepSeek responses.
- [ ] Test missing key, malformed input, body limit, origin rejection, provider errors, timeout and malformed model JSON.
- [ ] Wire client to deployed endpoint; verify a user story produces real analysis with provenance.
- [ ] Verify no original story is sent to the music catalog API.
- [ ] Verify AI candidates against real catalog records; never use AI output as factual album metadata or image URLs.
