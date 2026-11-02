# KeyPocket — GitHub App 私有备份仓库

更新：2026-11-02

## 1. 结构
- 浏览器通过 GitHub App 安装授权，不持有 Personal Access Token。
- Cloudflare Worker keypocket-vault-api 负责签发 GitHub App JWT、按已安装权限生成临时 Installation Access Token，并操作固定私有仓库。
- Installation Token 只为 keypocket-cloud-vault 一个仓库申请 Contents 写入和 Metadata 只读权限。
- 保险库文件固定为 keypocket-vault.v2.json，只保存客户端加密后的 {salt,iterations,iv,data} envelope。
- Worker 使用 7 天 HMAC 会话令牌返回浏览器；实际 GitHub Installation Token 不返回浏览器。
- GitHub App 私钥、App ID 和 HMAC Session Secret 存放在 Cloudflare Worker Secrets。

## 2. Worker 地址
- Worker：https://keypocket-vault-api.chenzhe223.workers.dev
- 回调：https://keypocket-vault-api.chenzhe223.workers.dev/github/callback
- 健康检查：/health

Worker 已通过 Cloudflare API 部署；执行环境 DNS 解析失败，故当前尚未完成公网 /health 冒烟检查。

## 3. GitHub App 配置
创建 GitHub App（建议名称 KeyPocket Vault）：
- Homepage URL：https://chenzhe223-tech.github.io/keypocket/
- Callback URL：上述 Worker /github/callback
- Webhooks：不启用（当前流程不需要）。
- Repository permissions：Contents = Read and write；Metadata = Read-only（GitHub 默认基础权限）。
- Installation：只允许选择仓库，不要选择全部仓库。
- 在 chenzhe223-tech 账户下创建私有仓库 keypocket-cloud-vault，然后把 App 仅安装到这个仓库。

## 4. Cloudflare Worker 变量与 Secrets
已有变量：
- APP_ORIGIN=https://chenzhe223-tech.github.io

需配置 Worker Variable：
- GITHUB_APP_SLUG：GitHub App 设置页面显示的 slug。

需配置 Worker Secrets：
- GITHUB_APP_ID：GitHub App ID。
- GITHUB_APP_PRIVATE_KEY：从 GitHub App 页面下载的 PEM 私钥原文。
- SESSION_SECRET：至少 32 字节的随机高熵值。可本机生成，例如 openssl rand -hex 32；不要发到聊天、Issue 或提交仓库。

可以通过 Cloudflare Dashboard → Workers & Pages → keypocket-vault-api → Settings → Variables and Secrets 配置。保存后重新部署/重启 Worker 版本。

## 5. 授权与数据操作
1. KeyPocket 的 GitHub 账户模块点击“连接 GitHub”。
2. 在 GitHub 页面把 App 安装到 keypocket-cloud-vault 私有仓库。
3. Worker 验证安装，并确认仓库为私有仓库。
4. 客户端仅持有 7 天范围受限的 HMAC 会话；App 私钥和 Installation Token 不进入页面。
5. 自动检查点更新时，客户端可将加密 Vault 文件 PUT 到固定仓库路径；也可手动恢复。
6. 页面解除绑定只清除此设备保存的授权会话；如需彻底撤销 App 访问，应在 GitHub Settings → Applications → Installed GitHub Apps 中卸载 App。

## 6. 限制
- 当前 Worker 代码已部署，但 GitHub App 尚未创建/配置，授权与私有仓库读写未通过实际测试。
- 任何情况下都不读取、复制或同步用户其他私有仓库的源码。
- GitHub 私有仓库备份依赖 Supabase 共享加密盐和本地解锁密码派生密钥，因此跨设备恢复仍需要登录同一 Supabase 用户并使用同一 KeyPocket 本地密码。
- GitHub 仓库保存的是加密文件，不是可直接查看的 KeyPocket 明文数据。
