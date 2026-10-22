# MelodyMe 技术架构与实施边界 v0.1

## 当前真实状态
- 目前产品原型以静态 HTML/CSS/JS 运行，记忆数据保存在用户当前浏览器 localStorage。
- 真实 AI、认证、云数据库、跨设备同步、公开分享、歌曲元数据服务均未接入。
- 现有 Supabase 连接可见的项目为其他产品（dashboard-studio、tongxing-aa）；不得把 MelodyMe 数据写入这些项目。
- 当前代码位于 DAVYLAB GitHub Pages 仓库的 `melodyme/` 子目录，尚未建立独立应用仓库。
- 生产后端需要独立 Supabase 项目/明确的数据隔离与服务端 AI provider 配置；新建付费资源前需先确认成本。

## 目标架构（待实施）
- **Web client**：React/TypeScript 可在 MVP 工程阶段引入；先保持页面体验简单，避免不必要的框架迁移。
- **Auth + Postgres**：专属 Supabase 项目；Auth 管理身份，Postgres 保存记忆、作品和任务；RLS 作为数据边界。
- **Storage**：私有对象桶保存用户上传和私有作品；公开作品应使用单独的发布副本/授权流程，不直接暴露原始私有文件。
- **Server API**：Cloudflare Worker 或 Supabase Edge Function 负责鉴权、AI 调用、配额、幂等、错误归一化；只选择一个主要服务端入口，避免双重业务逻辑。
- **AI provider**：由服务端适配器调用；密钥仅存 Secret；记录 provider/model、任务状态、用量和错误类别，不默认记录完整私密提示词。
- **Music metadata**：先允许手动输入歌名/艺人/合法链接；只有在核实条款、可用性和授权后才接入第三方目录或播放能力。
- **Deployment**：当前静态概念页沿用 GitHub Pages；正式应用应在独立仓库和独立发布目标中部署，避免与个人站点工作流互相影响。

## API 约定草案
- `POST /api/memories` 创建记忆；服务端从 session 获取 user_id，不信任请求体 user_id。
- `GET /api/memories` 返回当前用户获准访问的记忆。
- `PATCH /api/memories/:id` 更新并校验所有权。
- `DELETE /api/memories/:id` 执行删除策略并清理派生资源。
- `POST /api/generations` 创建任务，要求幂等键；返回 job id。
- `GET /api/generations/:id` 返回任务状态及可见结果。
- `POST /api/posts` 仅发布用户明确选择的内容快照。
- `POST /api/share-links` 生成一次性/可撤销分享；数据库只存 token hash。
- `DELETE /api/share-links/:id` 撤销分享。

## GenerationJob 状态
`queued → running → succeeded | failed | cancelled`
- 任务需要 owner_id、job_type、status、idempotency_key、attempt_count、provider、model、started_at、completed_at、error_code。
- 同一用户同一幂等键只能创建一个逻辑任务。
- 失败时保留输入草稿；重试应有次数/成本限制。
- 不把服务端 Secret 或第三方错误原文直接返回浏览器。

## 多设备同步
- 以 Postgres 作为云端事实源；每条记录有 id、user_id、created_at、updated_at、version。
- 客户端离线草稿明确标记 pending sync。
- 更新采用乐观并发：version 不匹配时返回冲突，不静默覆盖。
- 删除使用 tombstone 或可追踪的删除事件，避免旧设备把删除数据重新上传。
- 上传/下载仅同步当前用户获准访问的数据；退出登录后清除内存中的敏感数据。

## 上线前的基础设施阻塞
1. 创建专属 Supabase 项目并确认成本/区域。
2. 确定 AI 文本模型 provider 与可用密钥；不要复用其他项目的密钥或把密钥写入前端。
3. 确认正式应用独立仓库/域名/部署目标。
4. 配置 Storage 私有桶与访问策略。
5. 执行真实 RLS、跨账号和撤销分享测试。
