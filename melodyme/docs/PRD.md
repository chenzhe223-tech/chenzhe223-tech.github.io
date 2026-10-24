# MelodyMe 产品需求文档（PRD）v0.2 — 音乐人生地图

## 产品定位
**核心主张：** 每一首歌，都是你走过的路。MelodyMe 以人生记忆为起点，以音乐为线索，通过地图式探索帮助用户生成可编辑的个人故事与视觉作品。

## 设计原则
1. 用户只需提供一句话即可开始；歌名、歌手、年份和专辑均非必填。
2. 用地图节点与渐进式选择代替长表单；每个节点必须带来状态变化或阶段性反馈。
3. 用户可以跳过、返回、修改、重选和重新生成。
4. AI 推测、外部来源数据与用户确认信息必须分开标注。
5. 原始故事默认私密；当前静态原型仅存浏览器本地，不提供账号、云同步或公开分享。
6. 不得将本地规则模拟称为真实 AI；不虚构音乐元数据、封面、播放能力或第三方接口。
7. 本阶段不开发音乐视频、AI 视频或相关接口。

## 用户流程
1. **唤起记忆：** 一句话输入，或选择人物、旅途、人生转折等方向。
2. **找到感觉：** 轻量选择情绪；允许跳过。
3. **发现音乐：** 可选填歌曲名和艺人。没有可靠音乐目录接入时，不自动编造歌曲、专辑、年份或封面。
4. **收获作品：** 选择文案语气与海报气质，生成故事文案、朋友圈文案和 SVG 海报预览。
5. **保存作品：** 用户明确保存后写入当前浏览器；可查看、删除、导出。当前不代表云端备份。
6. **外部音乐查询：** 只有用户提供了歌曲线索时才开放外部查询；链接不能被描述为播放保证。

## MVP 交付范围
- 音乐人生地图首屏与可点击节点。
- 四个探索节点：记忆、情绪、音乐线索、作品。
- 节点跳过、回访、进度状态、草稿恢复。
- 一句话创作入口，不要求歌手、专辑、年份。
- 文案语气、视觉气质快捷选择。
- 可编辑故事文案、朋友圈文案、SVG 海报导出。
- 本地保存、列表展示、删除与移动端响应式适配。
- 清晰披露当前为本地交互原型，不调用真实 AI、不具备账号/云同步/公开分享。

## 后续服务接入（当前未实现）
- 真实 AI 故事理解、候选歌曲建议、文案生成与海报规划。
- 经许可且核验可用性的音乐元数据源、专辑封面来源及官方 Shazam 跳转方式。
- 独立 Supabase 项目、认证、RLS、私有存储与跨设备同步。
- 服务端模型适配器、Secret 管理、超时、重试、配额和幂等。
- 用户主动分享、分享快照和撤销能力。

## 验收标准
- 无需填写歌名、歌手、专辑或年份即可开始并完成基础创作。
- 一句话可以生成可编辑的本地初稿；空输入会提示，但用户可选择跳过探索节点。
- 所有节点可以访问、跳过或返回，状态和进度可见。
- 刷新后未完成旅程及本地作品可恢复（浏览器支持 localStorage 的前提下）。
- 歌曲信息只显示用户输入或经核验来源的数据；未核验字段不得伪装成事实。
- 作品可编辑、保存、删除、导出 SVG、复制朋友圈文案。
- 手机窄屏无横向溢出，主要按钮可用，控制台无 JavaScript 错误。
- 未接入真实服务的功能在界面和交付报告中明确标注未实现。

## 明确不在本期
音乐视频、AI 视频、未经核验的歌曲识别 API、音乐流媒体播放、复杂积分/排行榜、强制社交功能。


## v0.3 增补：12 种海报风格与真实音乐资料卡
- 作品编辑器提供 12 种风格：电影雾光、旧照片、海边蓝调、城市夜色、胶片日记、温柔水彩、极简留白、复古唱片、星夜诗篇、旅行手账、花园记忆、午夜电台。
- 用户可手动选风格，也可让系统根据故事关键词和情绪做本地规则推荐。该推荐不是在线 AI 分析；真实模型接入后才可称为 AI 自动匹配。
- 音乐线索步骤支持用户主动查询 Apple iTunes Search 公开目录，展示歌曲、艺人、专辑、真实封面和目录发行日期等候选。候选仍需用户确认，失败时不生成假封面。
- 作品页展示音乐卡片，支持粘贴并展示用户提供的 Shazam 具体歌曲 URL。Shazam 是外部链接，不保证网页内嵌播放。
- 目录的 releaseDate 不自动描述为歌曲首次发行年份；用户不搜索时不会请求音乐目录。


## AI music memory engine v1

The intended experience is story-first: AI extracts memory clues, proposes hypotheses, then external music catalog results are verified separately. Candidate facts must preserve provenance (`ai_inferred`, `catalog_verified`, `user_confirmed`, `unknown`). Real cover art must match a catalog/release record. Shazam links must be exact, verified song-detail links; never claim guaranteed autoplay.

Output modes: illustrated poster using verified/authorized cover art, and a complete text-only work with AI-adapted typography and palette. DeepSeek, version comparison, AI copy, and layout planning are not considered delivered until a deployed server endpoint and real browser integration tests pass.
