# WORLD/TOON 2.3 · 发布与核验记录
发布日期：2026-11-09

## 三项变更
1. 日期：全球热点、AI Radar 进入选题池时，已知事件日优先，否则使用原始新闻发布日期作为待核验候选；eventDateBasis 保留依据。漫画草稿继承事件日期和来源记录，手动改日期标为 manual_unverified。
2. 视觉：顶栏新增「视觉与动效」；3 布局、4 配色、3 档动效、左侧/顶部导航、一级目录及二级菜单上下排序、重命名与分组迁移。偏好保存到 data.settings.visual，纳入已有本地备份和账号数据同步。
3. AI 角色：角色档案新增自动生成角色草稿的编辑表单，服务器新增 POST /api/ai/characters，使用原有 Supabase 鉴权及 Cloudflare Workers AI 调用配额。生成后可编辑和删除；不复刻现实人物。

## 测试和部署
- 前端 app.js、extension.js、briefing.js、personalize.js 及 Worker 的静态语法检查通过。
- 6 项日期单元测试通过：新闻发布日期候选、日期依据、明确事件日、AI 简报日期、简报草稿继承、普通选题草稿继承。
- 在模拟 DOM 下验证：个性化设置初始化、三级动效档位、三组十个导航项及角色 AI 入口。
- Cloudflare 部署版本：1496b675-16ef-46c7-ac81-d8a3cf247474；API 控制台证实 100% 生效，AI、DB 和 AI_ENABLED 绑定继承成功。
- 费用限制：AI_ENABLED=false，真实 AI 角色生成尚不能使用，必须取得费用授权才可启用。不得声称模型端到端测试通过。
- 公网浏览器 URL 抓取失败，未得到真实设备上的点击截图。上线版本验证不等同于全功能浏览器验收。

## 兼容性与边界
- 保持原 AI Radar 自动发布和存档不变。
- 日期候选不等于已经核实的事件发生日期；刊发前继续事实复核。
- 保存用户布局偏好不会自动发布漫画或更改新闻内容。

生产入口：https://worldtoon.chenzhe223.workers.dev/
仓库：https://github.com/chenzhe223-tech/chenzhe223-tech.github.io/tree/main/comic-studio