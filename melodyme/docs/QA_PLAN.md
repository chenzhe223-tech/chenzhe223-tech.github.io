# MelodyMe 测试计划 v0.2

## 当前测试范围
静态 HTML/CSS/JS 音乐地图前端、iTunes Search、Cloudflare Worker 文本 AI 适配器及 Workers AI 封面接口。CI 只证明自动化覆盖范围内的行为；不证明真实线上模型、外部图片服务、生产发布、账号认证或云同步已完成。

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
| MAP-08 | 作品生成 | 优先尝试 Worker AI；失败时保留可编辑本地初稿并明确提示降级 |
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


## v0.4 — iTunes 试听与 AI 纪念封面验收

### iTunes previewUrl

| ID | 场景 | 预期 |
|---|---|---|
| AUDIO-01 | 选择包含 `previewUrl` 的 iTunes 候选 | 音乐资料卡显示 HTML audio controls，标签为“30 秒试听片段” |
| AUDIO-02 | 检查试听 URL | `audio.src` 与 iTunes 目录返回的 `previewUrl` 一致；不拼接、不猜测 |
| AUDIO-03 | 用户首次进入结果页 | 音频不自动播放，`preload="none"` |
| AUDIO-04 | 点击第二个音频播放（如页面存在多个音频） | 其他 audio 元素被暂停 |
| AUDIO-05 | 选择没有 `previewUrl` 的目录候选 | 不显示音频控件，显示“该曲目暂无试听片段”，控制台无异常 |
| AUDIO-06 | Shazam 外链 | 仍独立显示；不以试听替代 Shazam，不宣称完整歌曲播放 |

### AI 纪念封面

| ID | 场景 | 预期 |
|---|---|---|
| COVER-01 | Pollinations 成功返回图片 | 图片使用 lazy loading、描述性 alt，显示“AI 生成封面（非真实专辑封面）” |
| COVER-02 | 检查发往 Pollinations 的 prompt | 仅包含风格、情绪和映射后的场景关键词，不包含完整故事原文、姓名或完整用户输入 |
| COVER-03 | 同一输入重复生成 | 由歌曲/风格/情绪/映射场景产生稳定 seed |
| COVER-04 | Pollinations 图片加载失败 | 自动尝试 Worker 的 `generateAlbumArt`，响应按 image/png 解析 |
| COVER-05 | Pollinations 超时 | 12 秒后启动 Worker 兜底 |
| COVER-06 | 两路图片服务均失败 | 显示本地渐变占位和“AI 封面暂不可用，已保留你的文字和海报内容”；故事、分享文案和 SVG 导出仍可用 |
| COVER-07 | 点击重新生成 | 显示 loading 状态；按钮禁用防止重复触发；完成或失败后恢复可操作 |
| COVER-08 | 检查真实专辑封面 | AI 装饰封面不得覆盖 iTunes artworkUrl，也不得被标记为真实专辑封面 |
| COVER-09 | 海报回归 | 12 种风格名称/样式不变；SVG 导出逻辑未被 AI 图片改写；纯文字模式仍可用 |

### Worker generateAlbumArt

| ID | 场景 | 预期 |
|---|---|---|
| ARTAPI-01 | 有效请求，AI 返回图片字节 | HTTP 200、`content-type: image/png`、返回图像字节 |
| ARTAPI-02 | Origin 不匹配 | HTTP 403，AI 不被调用 |
| ARTAPI-03 | 非 POST | HTTP 405 |
| ARTAPI-04 | 请求体超过 12 KB | HTTP 413 |
| ARTAPI-05 | prompt 空、全空白或超过 400 字符 | HTTP 400 |
| ARTAPI-06 | width/height 小于 256 或大于 1024 | HTTP 400 |
| ARTAPI-07 | Workers AI 绑定缺失 | HTTP 503，返回 `ai_image_service_not_configured` |
| ARTAPI-08 | 所有图像模型调用失败 | HTTP 502，返回 `ai_image_generation_failed`，不泄露内部堆栈或密钥 |
| ARTAPI-09 | 超时 | HTTP 504，返回 `ai_image_timeout` |
| ARTAPI-10 | Rate Limiter 触发/不可用 | HTTP 429/503，复用 Worker 既有保护机制 |
| ARTAPI-11 | 响应检查 | 不返回任何 API key 或 secret 字段 |
| ARTAPI-12 | DeepSeek Secret 缺失但 Workers AI 已绑定 | `generateAlbumArt` 不依赖 DeepSeek Secret；文本动作仍按原逻辑返回 503 |

### 响应式与核心流程

- [ ] 12 种海报风格名称逐项存在，地图四站可继续、跳过与回访。
- [ ] 纯文字文案与图片/文字海报都可完成；AI 封面失败不影响 SVG 下载。
- [ ] 360px、390px、桌面视口无横向溢出。
- [ ] 浏览器控制台无未处理 JavaScript 错误。
- [ ] 保存、刷新恢复、编辑、删除和 SVG 下载无回归。
- [ ] 无音频自动播放；所有音频仅由用户主动操作。
- [ ] 真实 iTunes 返回缺少 previewUrl 时，页面正确显示无试听状态。

## 本次交付状态必须分四栏记录

| 状态 | 含义 |
|---|---|
| 已代码修改 | 对应变更已提交到 PR 分支或合并提交 |
| 已跑测试 | 明确列出实际执行的命令/CI 运行与结果 |
| 已部署 | 目标环境已发布对应提交；仅有合并记录不算部署证据 |
| 真实端到端验收通过 | 在生产浏览器/Worker 中实际完成操作并保存证据；不能由单元测试代替 |

新功能在 CI 和生产浏览器回归完成之前保持“待验证”。Pollinations 和 Workers AI 均为外部服务，免费额度、模型可用性和访问策略可能变化。


## v1.0 — Nine-mode poster design system

| ID | Scenario | Expected |
|---|---|---|
| POSTER-01 | Mode selector | Exactly nine mode cards; one selected state; changing mode preserves story and selected track |
| POSTER-02 | Prompt composition | Each mode includes its own locked composition, palette, lighting, materials, subject guidance, reserved text zones and negative rules |
| POSTER-03 | Comic substyles | Three distinct substyle configurations: lively pencil, gentle journal, comic panels |
| POSTER-04 | Portrait image request | Pollinations and Worker requests use 768×1024 within the Worker’s accepted bounds |
| POSTER-05 | Technical image checks | Decode succeeds, ratio is within 0.68–0.82, dimensions are at least 600×800 |
| POSTER-06 | Mode switch | Previous generated background is invalidated; no stale image is presented as the newly selected style |
| POSTER-07 | Regeneration | Explicit regeneration changes the deterministic variation seed; automatic retries remain bounded to the existing two-service path |
| POSTER-08 | Verified metadata | Poster title/artist come from selected catalog track; unconfirmed typed values are not displayed as confirmed song metadata |
| POSTER-09 | SVG export | Uses the generated background URL when available and front-end song typography; external image URL means export is not guaranteed to be self-contained/offline |
| POSTER-10 | Visual fidelity | Must be manually/vision-reviewed. Basic image checks do not count as semantic style validation or a style score |

### v1.0 automated evidence

The updated `.github/workflows/melodyme-qa.yml` adds a Node-based configuration test for 9 modes × 3 mood cues (27 prompt combinations), three comic substyles, and positive/negative image-dimension checks. It also updates Playwright selectors and uses a deterministic 768×1024 PNG fixture so image dimensions can be tested without paying for real generations.

The automated suite does **not** perform 27 live generations. No real visual score is emitted. The real image provider, live Worker and all nine visual styles remain subject to separate production verification.
