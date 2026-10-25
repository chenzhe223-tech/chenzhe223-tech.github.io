# MelodyMe 基层技术支持：Agent Skills

本目录为 MelodyMe 建立项目级 AI 开发规范，供 Codex、WorkBuddy 等兼容开发代理在修改代码时读取。技能不是浏览器运行时插件，不会被公开网页加载，也不会额外发起网络请求。

## 三项基础技能

| 本地 Skill | 主要职责 | 上游参考 |
|---|---|---|
| `melodyme-audio-engineering` | 浏览器音频试听、播放状态、媒体生命周期、失败恢复与音频体验 | [shortwavlabs/agent-skills](https://github.com/shortwavlabs/agent-skills) |
| `melodyme-music-platform` | iTunes Search、Apple MusicKit 评估、目录元数据、试听权限与平台合规 | [Claude Skill Registry 的 MusicKit 条目](https://github.com/majiayu000/claude-skill-registry) |
| `melodyme-frontend` | 移动端布局、UI 一致性、可访问性与视觉回归 | [oh-my-openagent frontend skill](https://github.com/code-yeongyu/oh-my-openagent/tree/dev/packages/shared-skills/skills/frontend) |

## 技能如何生效
- `../AGENTS.md` 负责按任务路由到对应 Skill。
- 每项 Skill 的 `SKILL.md` 写明适用场景、工程边界、工作流程和验收清单。
- 开始对应任务时，开发代理应先读相关技能，再检查当前代码并实施修改。
- 这是工程指导层，不是应用内的新功能。它不会自动安装 Apple MusicKit、音频库或第三方依赖。

## 适配 MelodyMe 的关键边界
1. 当前产品通过 iTunes Search 获取真实歌曲目录，并使用可用的短试听 URL；不得把试听说成完整歌曲播放。
2. 原生 iOS 的 `MediaPlayer` API 不可直接在普通网页中运行；浏览器 MusicKit JS 与原生 MusicKit 是不同的集成方案。
3. 不复制上游整个 Skill 包，也不盲目安装 DSP/JUCE 工具链。仅把适用的工程方法整理成本地规范，并保留上游来源链接。
4. 不虚构歌曲、试听地址、曲库权限或 API 响应；不绕过 DRM、订阅或地区限制。
5. 任何实际平台集成都必须单独评估认证、权限、使用条款、密钥安全和测试。

## 维护
当应用架构、音乐源或播放能力发生变化时，同步更新对应 Skill、`AGENTS.md` 与 `docs/ARCHITECTURE.md`，并通过 `docs/QA_PLAN.md` 的检查。
