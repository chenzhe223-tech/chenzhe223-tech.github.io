# KeyPocket V2.0 — GitHub App 私有保险库

## 目标流程
用户在 KeyPocket 中发起绑定；Cloudflare Worker 生成短时、一次性 state 并跳转 GitHub App 安装/授权。回调后校验 state、installation 与账号归属。只在用户明确授权范围内建立或确认 `keypocket-cloud-vault` 私有仓库。客户端先使用独立 KeyPocket 同步口令加密数据，再把密文交给 Worker 写入 vault。恢复时客户端下载密文并在本地解密。

## 最小权限
- Repository permissions：Metadata read；Contents read/write。
- Repository access：优先采用 Only select repositories，只选择 KeyPocket vault。
- 不需要读取用户其他私有仓库源码、组织管理、Actions、issues 或 pull requests。
- 服务端必须校验 installation owner、repository allowlist 和目标仓库 ID，不能仅相信浏览器传入的仓库地址。

## GitHub App 注册项
需要在 GitHub Developer Settings 中创建 KeyPocket 专用 GitHub App，并配置：
- Homepage URL：`https://chenzhe223-tech.github.io/keypocket/`
- Callback URL：部署后的 Cloudflare Worker OAuth callback URL（Worker 域名启用后确定，不能先填猜测地址）。
- Setup URL：可选，指向 Worker installation 完成页。
- Webhook URL/secret：仅在需要接收 installation suspend/deleted 等事件时启用。
- User authorization callback：按 GitHub App OAuth user authorization flow 配置，并使用 state 防 CSRF。

## Cloudflare Worker 配置
建议绑定以下 Worker Secrets（只保存变量名，不把值写进 GitHub/前端/文档）：
- `GITHUB_APP_ID`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_WEBHOOK_SECRET`（仅启用 webhook 时）
- `OAUTH_STATE_SECRET`
以及普通非敏感变量 `APP_ORIGIN`。

必须实现并验证：短时 state 签名/一次性校验、OAuth callback、用户与 installation 绑定、短时 installation token 获取、仓库 allowlist、加密密文读写、CORS origin 限制、错误处理与安全日志脱敏。不得将 GitHub access token、installation token、App 私钥或 state secret 写入 localStorage、前端包或日志。

## 当前真实配置检查（2026-11-02）
- Cloudflare 账户中存在 Worker 脚本 `keypocket-vault-api`。
- 该脚本当前 `workers.dev` 子域名：`enabled=false`。
- Worker Secrets 列表为空；Settings 目前仅看到普通 `APP_ORIGIN` binding。
- 目前没有可用的公开 OAuth callback，因此不能启动或完成应用内 GitHub 授权。
- KeyPocket 页面已禁用尚未实现的连接按钮，并显示真实配置状态；不会用 ChatGPT GitHub connector 冒充用户对 KeyPocket 的授权。
- 本对话可用的 GitHub connector 只用于仓库开发，不代表应用内 OAuth 权限。

## 上线前验收
1. 注册 GitHub App 并确认最小权限/Repository selection。
2. 启用 Worker 公网入口或绑定正式自定义域名；确定最终 OAuth callback URL。
3. 将 App ID、Client ID/Secret、Private Key、state secret 等通过 Cloudflare Worker Secrets 配置，禁止提交仓库。
4. 完成 OAuth start/callback、state 过期/重放拒绝、installation 归属、仅指定 vault repo 读写测试。
5. 验证客户端只上传加密密文，第二设备可下载并在本地解密。
6. 通过 QA 后才启用 KeyPocket 的“连接 GitHub”按钮。
