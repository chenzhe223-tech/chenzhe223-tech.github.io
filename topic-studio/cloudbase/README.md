# DAVYLAB Topic Studio — CloudBase 上海环境 P0 接入资料

**阶段：P0 文件和安全边界已准备；尚未获得云环境写入权限，尚未部署数据表，尚未打开生产同步。**

## 已确认的信息

- 地域：`ap-shanghai`
- 主环境 ID（Web SDK 使用，属于非保密标识）：`cloud1-d3guyfuxtfeef189a`
- 第二环境：仅视为独立环境，不擅自部署或切换
- 已购买：CloudBase 个人版，成交价由用户提供为 ¥19.9。该价格不代表 CloudBase 之外的任何服务都已免费。
- 主账号 UIN、APPID 不用于前端 SDK 初始化，因此这里不记录；**任何 SecretId / SecretKey / AppSecret / Publishable Key / 数据库密码都不得写入此公开仓库**。

## 关键前置检查：必须确认数据库类型

上海地域云开发支持不同数据库环境，**创建后无法直接切换类型**：

- **传统云数据库环境**：文档型数据库 / 集合安全规则；适合当前非程序员作者的选题 JSON 记录。请先从控制台确认是否拥有“文档型数据库”栏目。
- **PostgreSQL 环境**：SQL 表 + 行级安全策略 RLS。只有确认是 PG 环境，才使用 `schema-postgres.sql`。不要在传统环境执行 SQL，也不要把 PostgreSQL 的 RLS 当作文档型数据库的权限。
- 如果控制台无法确认，**停止生产写入，只进行只读 SDK 初始化**。

## P0 可执行流程

1. 在腾讯云控制台选择主环境，核对“地域、套餐、数据库类型、身份认证 v2、剩余资源点”，记录是否已有数据库。
2. 将 `chenzhe223-tech.github.io` 加入 CloudBase **安全来源域名**。本地开发地址需单独允许；不要为方便而开放不必要来源。
3. 用户仅本人使用：开启有密码或验证码的个人登录，不开启匿名写入或公开注册；云端数据访问必须以已认证的用户身份绑定所有权。
4. 已有选题从浏览器平台点击“导出选题”生成 JSON，原文件留在本地。运行 `node topic-studio/cloudbase/validate-export.cjs <本地JSON文件>` 做离线数据检查；文件不上传，不打印文章正文。
5. 传统云数据库：先创建测试集合，默认拒绝访问；测试认证、写入所属权字段、跨账号读取被拒绝，再由管理员手工应用 `document-rules-owner.example.json`。该模板不是已应用的安全规则；特别要验证“创建记录”时的归属字段。
6. PG 环境：审核并在 SQL 控制台执行 `schema-postgres.sql`，针对未登录、非本人、本人、旧 revision 冲突分别测试。服务器端使用 `auth.uid()`（返回 text）。
7. 只有安全审计通过后，才启用 P1 自动同步。首次导入为**追加 / 按 ID 合并 / 冲突单独处理**，不删除现有云端或本地记录。用户发文状态保持原样，不能因同步改变 draft/approved/published。

## 多端同步数据模型（待部署）

- `topic`：每条选题单独一份记录，包含栏目、文章/贴图、排期、原文来源、视觉方案（visualPlan），避免整表覆盖。
- `research`：赛道研究及对标素材。
- `growth`：增长目标、实验、7/30 日复盘。
- `settings`：账号级排期锚点与偏好（不含任何 Token）。
- `published_record`：已发表内容的个人笔记；公开内容发布状态与草稿仍需要独立核实。

为每个条目保留 `doc_id / user_id / doc_type / payload / revision / deleted_at / created_at / updated_at`。以服务器 revision 做乐观并发控制。初期“本地离线写入 → 待同步队列 → 云端确认 → 本地标记完成”；冲突不要自动用最后保存的一端覆盖另一端。

## 安全红线

- 未发布稿件只能写到经过本人身份认证和权限隔离的 CloudBase 私有数据中；公开 GitHub 仅存源码、建表模板、测试样例，不写真实选题或稿件。
- CloudBase 文档数据库安全规则与 PG RLS 是两个体系，不能混用。测试时用第二个测试身份模拟访问其他用户的记录。
- 云端同步功能必须显式选择开启，不自动删除旧 localStorage；上线前完整备份和可逆回滚。
- CloudBase 上海服务器的数据将存放在中国大陆境内，跨境访问延迟及个人信息处理/数据出境义务按实际业务核实。
- 用户已有两套个人版环境，建议在账单管理中核对是否各自计费，避免不必要的重复订阅。

## 目前验收状态

- [x] 确认数据库类型的技术分歧和正确安全控制方式
- [x] PostgreSQL 私有表与 RLS 模板完成
- [x] 文档型数据库“默认拒绝”和“本人可访问”模板完成
- [x] 本地 JSON 导出离线校验脚本完成
- [ ] 账号级别的数据库类型 / 实际控制台权限核验
- [ ] 线上认证、数据库读写、跨账号隔离测试
- [ ] P1 正式数据迁移与 Windows / iPhone / iPad 多端验证

官方参考：
- https://cloud.tencent.com/document/product/876/127357
- https://docs.cloudbase.net/authentication-v2/method/sdk-init
- https://docs.cloudbase.net/database/security-rules
- https://docs.cloudbase.net/database/postgresql/data-permission


## 可选的官方 CloudBase 连接方式（无需把密钥发给 ChatGPT）

腾讯云已提供 **CloudBase 官方远端 MCP + OAuth 授权**：

```json
{
  "mcpServers": {
    "cloudbase": {
      "type": "http",
      "url": "https://tcb-api.cloud.tencent.com/mcp/v1"
    }
  }
}
```

在支持 OAuth 的工作工具里（腾讯云官方文档明确列有 WorkBuddy）连接后，使用腾讯云账号完成网页授权，并**只选择目标主环境**；授权完成后再执行只读的 `auth(status)` / 查询环境数据库类型，确认无误才开展数据库部署。此连接方式不需要你在聊天中发送 SecretId / SecretKey。ChatGPT 当前对话没有直接连接到你的 CloudBase 控制台，不能把已提交的 P0 文件视为真实云端部署。

官方文档：https://docs.cloudbase.net/ai/cloudbase-ai-toolkit/connection-modes
官方 WorkBuddy 接入：https://docs.cloudbase.net/ai/cloudbase-ai-toolkit/ide-setup/workbuddy
