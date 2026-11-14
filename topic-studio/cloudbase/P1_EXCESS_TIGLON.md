# DAVYLAB Content Studio｜excess-tiglon PostgreSQL P1 实施交接

> **状态：代码与安全迁移脚本已提交；尚未在腾讯云执行 SQL，未开放真实跨设备同步。**
>
> 唯一目标环境：`excess-tiglon-d6gjc77qr6fa193f2`（上海，CloudBase 个人版）。
> **禁止部署到受限制的 `cloud1-d3guyfuxtfeef189a`。**

## 1. 当前已确认与未确认

用户提供的腾讯云控制台截图证明，当前目标 `excess-tiglon` 的 PostgreSQL 已启用，`public` Schema 中已有 `cron_locks`、`dashboard_metrics`、`mail_board_snapshots`。这些表可能服务其他应用，**本方案不读取正文，不修改、删除或改名它们**。

尚未核实：身份认证登录方式与当前登录用户的 CloudBase **Auth UID**、Web 安全来源、RLS 实际隔离、剩余额度的计费边界、CloudBase PostgreSQL RPC 是否已部署。腾讯云 UIN 和 APPID **不是** `auth.uid()`。

## 2. 已准备的专用数据库对象

文件：`schema-postgres-p1-excess-tiglon.sql`（**尚未执行**）

新增对象仅使用唯一前缀 `davylab_ts_v1_`：

- `public.davylab_ts_v1_allowed_owners`：管理员在 CloudBase 私人控制台添加本人 **Auth UID**，无前端访问权限；默认空表，未被授权前全部拒绝。
- `public.davylab_ts_v1_documents`：按 `(owner_uid, doc_type, doc_id)` 存储单条稿件、排期、研究与增长记录。仅对 `authenticated` 用户开放 **SELECT**，并通过 RLS + 允许名单校验限制只能查看本人记录。
- `public.davylab_ts_v1_is_allowed()`：判断当前 JWT role、Auth UID、匿名身份及允许名单，匿名和其他账号返回 false。
- `public.davylab_ts_v1_put(...)`：受控 **CAS（Compare-and-Swap）** 单条写入：首次新增必须期望修订号 0；更新必须携带准确的服务端修订号；使用数据库行锁，双方同时修改不能互相覆盖。
- 当前**没有开放删除接口**；旧设备没有某条记录不能因此视为已授权删除。

CloudBase 官方文档说明其 PostgreSQL 权限需要 **GRANT + RLS**；`auth.uid()` 返回 **text**，而非 UUID。其 RPC 文档另提醒：当前网关未必强制检查 `GRANT EXECUTE`，因此所有 SECURITY DEFINER 函数必须在函数内部显式检查 `auth.role()`、`auth.uid()` 和允许名单，不能只依赖 SQL GRANT。

## 3. 真实环境的安全执行顺序

**第一步：只读确认**

1. 在腾讯云控制台顶部确认 `excess-tiglon`，而不是另一个环境。
2. 在「PostgreSQL → SQL 编辑器」执行 `read-only-preflight-excess-tiglon.sql`：仅返回 DB schema/角色/策略元数据，不会查看业务表数据或修改内容。
3. 在「身份认证 → 登录方式」核实邮箱/密码或邮箱验证码方式已启用，并配置 Web 安全来源 `chenzhe223-tech.github.io`。
4. 通过「身份认证 → 用户管理」核实**本人登录用户的 Auth UID**，无需在 GitHub、公开文件或聊天中提交该 ID。

**第二步：仅建立独立表**

在确认账号权限与费用允许后，由账户持有人在**目标环境**的私有 SQL 编辑器审核并执行 `schema-postgres-p1-excess-tiglon.sql`。脚本 BEGIN/COMMIT 事务包裹，只创建 `davylab_ts_v1_` 前缀对象，允许名单初始为空，所有人均不能进行业务写入。

**第三步：在私人控制台给本人授权**

在确认目标环境、本人的真实 Auth UID 后，仅管理员运行：

```sql
-- 请在私有 SQL 编辑器替换下面的占位符，绝不要提交此值到 GitHub。
INSERT INTO public.davylab_ts_v1_allowed_owners(owner_uid)
VALUES ('<YOUR_CLOUDBASE_AUTH_UID>')
ON CONFLICT (owner_uid) DO NOTHING;
```

**第四步：权限与版本测试（必须实际执行）**

- 未登录：访问记录应返回拒绝或空结果；任何调用 `davylab_ts_v1_put` 必须被拒绝。
- 第二个非本人测试账号：`davylab_ts_v1_is_allowed()` 返回 false；无权查看本人稿件、创建记录或调用写入函数。
- 本人登录：可读取自己的空记录集合，其他人的内容不可见。
- 使用专用合成 ID `__davylab_qa__*` 完成首次插入（expected revision=0）、同 ID 同时写入（旧 revision 必须冲突）、正确 revision 修改（成功）。
- 测试异常：网络断开或网关超时后，先查询云端状态再重试；不能在未确认写入结果时盲目重复。
- iPhone/Windows 同账号读取真实 SQL 测试记录，并模拟离线修改、冲突和回滚。**不使用真实选题草稿作为测试。**

**第五步：逐条导入真实数据（必须另行授权与验收）**

当前备份工具 `sync-center.html` 保留原始 localStorage 字符串；`sync-core.js` 提供逐条合并/冲突规划；`pg-sync-adapter.js` 只提供带 owner 预检的**只读查询**与名字以 `__davylab_qa__` 开头的**合成测试记录写入**。未启用真实稿件推送或自动下载合并。

真实迁移须在以上测试通过后，先为所有旧研究对标数据分配稳定 ID，再两端独立备份、追加导入、解决冲突和完成回滚检查。不得自动修改原稿的 `draft / approved / in_wechat_draft / published` 状态。

## 4. 测试与相关文件

- `read-only-preflight-excess-tiglon.sql` — 控制台只读检查
- `schema-postgres-p1-excess-tiglon.sql` — 待审核的独立表 + RLS + CAS 迁移
- `pg-sync-adapter.js` — 环境 ID 硬限制、allowlist 预检、只读差异规划、合成测试写入
- `test-p1-pg.cjs` — SQL 权限设计静态断言及 SDK Mock 校验（不等于真实 PostgreSQL 执行测试）
- `test-sync-core.cjs` — 原有 P0 离线备份/冲突测试
- `.github/workflows/topic-studio-cloudbase-p0.yml` — GitHub Actions 测试工作流

## 5. 成本、数据保护和交付状态

**不使用另外一套 CloudBase 环境；未开通新的付费资源；未写入账户密码、令牌或真实用户数据。** 云端 SQL 尚未执行，不能宣称已开通多端同步。调用 CloudBase 时可能占用已购买套餐的资源点，应在控制台先核对余量和告警。

当前完成层级：
- **代码准备**：已完成
- **本地静态测试 / Mock 测试**：已覆盖，需确认最新 GitHub Actions 运行结果
- **目标数据库真实建表**：未执行
- **身份认证 / RLS 真正隔离**：未验证
- **Windows + iPhone 实际双向同步**：未验证
- **生产同步启用**：关闭

官方参考：https://docs.cloudbase.net/authentication-v2/auth/auth-pg 、https://docs.cloudbase.net/database/postgresql/data-permission 、https://docs.cloudbase.net/database/postgresql/rpc
