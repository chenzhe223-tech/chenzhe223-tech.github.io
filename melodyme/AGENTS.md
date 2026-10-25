# MelodyMe 工程规则

本文件仅约束 `melodyme/` 项目。开发或维护 MelodyMe 时，先阅读：

- `README.md`：当前产品范围与已知限制。
- `docs/ARCHITECTURE.md`：前端、Worker 与第三方服务边界。
- `docs/DESIGN_SYSTEM.md`：界面视觉与交互规范。
- `docs/QA_PLAN.md`：验证要求。

## 技能路由

按任务读取对应本地技能；它们是供 Codex、WorkBuddy 等开发代理使用的工程规范，不是浏览器运行时插件：

- UI、布局、移动端、无障碍、交互状态或视觉验收：`skills/melodyme-frontend/SKILL.md`
- 音频预览、HTMLAudioElement、媒体事件、错误恢复或播放行为：`skills/melodyme-audio-engineering/SKILL.md`
- Apple MusicKit、iTunes Search、目录/播放权限、将来原生 iOS 集成：`skills/melodyme-music-platform/SKILL.md`

## MelodyMe 不可突破的产品边界

1. 当前应用使用 iTunes Search 返回真实歌曲目录与可用的短试听 URL；试听必须由用户主动触发，不得伪装成完整歌曲播放。
2. 不得声称拥有 Apple Music 完整曲库播放权限，不得绕过 DRM、登录、订阅或地区限制。
3. MusicKit 只有在产品确实需要 Apple Music 会员曲库且具备正确的开发者配置、用户授权和合规流程时才可引入；不能为了“集成 Skill”而增加运行时依赖。
4. 不引入未经授权的音乐源、抓取、代理播放或隐藏自动播放。
5. UI 改动优先移动端，保留现有四站流程、记忆故事、海报与纯文字路径；不得为了视觉优化删除既有功能。
6. 所有音乐元数据必须来自真实响应；不确定字段应省略或明确标注，禁止编造。
7. 修改后应运行可用的自动化测试，并记录“已修改、已测试、已部署、真实线上验收”四种不同状态；不得将部署成功等同于端到端验收通过。
