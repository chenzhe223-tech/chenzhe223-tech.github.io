# WORLD/TOON 2.0 · By DAVYLAB
世界每日上演，我们画下来。基于真实公共新闻线索的原创虚构漫画创作与出版工作台。

## 线上入口
https://worldtoon.chenzhe223.workers.dev/

## 已实现与验证
- 新闻雷达：13 大新闻领域，Google News RSS + GDELT + BBC/Guardian/NASA/行业 RSS 备援，真实来源链接与时间戳，手动入选题池；新闻线索不等于事实认证。
- 作品生命周期：九格编辑器、图片保存、书架、审核、档案、删除恢复、ZIP 和网页出口，继承《霸总的小爱情》样例。
- 角色档案：原创人物外貌、衣着、性格、颜色、识别特征；生成时使用文字角色圣经以及首格参考图片辅助一致性。
- 登录与同步：Supabase 电子邮箱/密码，项目与热点 JSON 工作区，私有图片 Bucket，用户级 RLS；同步必须明确选择首次拉取/上传。
- AI 编剧和生图端点：Cloudflare Workers AI（Gemma 4 26B、FLUX.2 klein 4B）、账户认证、D1 每日次数限制（3 剧本/2 图片）。**AI_ENABLED=false**，付费推理未经确认不可开启，前端如实显示禁用状态。
- Cloudflare Worker 已部署生产，/health 版本 2.0；AI 科技新闻源线上返回真实来源文章；角色页面运行时浏览器内容被验证。
- Cloudflare D1 配额库 `worldtoon-ai-quota`，用户数据复用现有 Supabase 项目，但新表与新私有 Bucket 独立，不修改学院既有表。

## 仍须验证
- 邮箱确认/完整账号注册及两设备来回同步（需要真实测试账号）。
- 九格自动编剧和参考图生图真实模型调用（因避免未经授权费用，开关关闭）。
- 各分类 RSS 全天候可靠性、完整跨源去重、定时自动采集与自动发布。
- 社交平台真正直发（当前仅导出供审核后发布）。

## 安全
必须核对新闻原始报道和发布时间；不可将未经核实的刑事指控、私人关系或政治交易通过匿名虚构变成影射性真人漫画。人工审核与公开虚构声明是发布前必需步骤。所有用户图片默认私有；前端仅使用 Supabase publishable key，不能暴露 service-role key。

## 部署
静态资源位于仓库 `comic-studio/`，Worker `worker.js` 代理该目录。Worker 绑定：`AI` Workers AI、`DB` D1、`AI_ENABLED` 默认 `false`。D1 SQL 见 `d1.sql`。

By DAVYLAB · 把想法，做成能用的工具。