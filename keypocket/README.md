# KeyPocket

KeyPocket 是一款本地优先的 API Key 管理网页应用，提供本地加密密钥库、加密备份/恢复、应用与仓库清单，以及可选的加密云端同步入口。

## 访问应用
GitHub Pages：https://chenzhe223-tech.github.io/keypocket/

## 文件结构
- keypocket/index.html — 页面结构、视觉样式、Content Security Policy 与功能入口
- keypocket/app.js — 本地加密、IndexedDB、密钥记录、项目清单、Skill 收录和可选同步逻辑
- SECURITY-ACCEPTANCE.md — 安全边界、检查记录与待验证事项
- DELIVERY-REPORT.md — 交付状态与已知限制
- docs/project-continuity/ — 项目连续性档案、当前状态、任务、决策、测试和交接指令

## 本地密钥库
- API Key 记录在客户端使用 Web Crypto 加密后保存到当前浏览器 IndexedDB。
- 本地解锁密码用于派生加密密钥；密码不会作为密钥库密码发送给 KeyPocket 服务端。
- 备份文件使用独立备份密码加密。请保管本地密码和备份。
- 浏览器清除站点数据、设备丢失或存储损坏可能导致本地数据无法恢复；请定期导出加密备份。
- 本项目不是经过独立安全审计的专业密码管理器，不建议作为唯一的生产密钥存储方案。

## 可选的跨设备加密同步
页面提供同步账号注册、登录和“合并并同步加密资料”入口。当前客户端实现会将密钥记录和项目记录组成快照，再使用由本地解锁密码派生的 AES-GCM 密钥加密后发送到 Supabase 同步表。

- 客户端通过 Supabase Auth 与 REST API 发起请求；页面 CSP 因此允许连接 Supabase，并允许 GitHub API 读取公开仓库元数据。
- 云端记录包含加密 payload，以及用于同步的用户 ID、schema version、revision、更新时间等元数据；这些元数据并非加密 payload 的一部分。
- 不要将“客户端发送加密 payload”理解为已完成完整的云端安全验证。Supabase 表结构、RLS/访问策略、账号生命周期、错误恢复和生产配置仍需单独核验。
- 同步操作会合并本地和云端记录。开始前应导出加密备份，并确保各设备使用相同的本地解锁密码。
- 登录同步账号的密码与本地解锁密码应不同。
- 本地密钥库和加密备份仍应作为重要数据保护措施；不要把云同步当成唯一备份。

## 从每日 AI 简报一键收录 Skill
- 在 [DAVYLAB AI 前沿简报](https://chenzhe223-tech.github.io/radar/daily/) 的 Skill 推荐卡片中点击“一键收录到 KeyPocket”。
- 简报页会将公开仓库名称、GitHub URL、简介、主题、许可证、采集时 Stars、更新时间和来源日期暂存在同一网站源的浏览器 localStorage 队列中；队列不应包含 API Key、访问令牌或其他秘密。
- 解锁 KeyPocket 后，应用展示待收录信息；用户确认后，资料经过 GitHub 仓库 URL 校验和相同仓库去重，再使用当前密钥库的 AES-GCM 加密保存到 IndexedDB 的“我的应用与仓库”。
- 若 KeyPocket 已打开，跨标签页存储事件可提示待收录项；也可点击“从 AI 简报收录”手动处理。
- 此待收录队列仅在同一浏览器配置和网站源内共享，不等于跨设备同步。跨设备使用需另行使用同步或加密备份流程。
- 本功能只收录公开项目资料，不会自动安装 Skill，也不会验证其安全性或适用性。使用前请检查 README、权限、依赖和许可证。

## 本地运行
从仓库根目录执行：

    python -m http.server 8000

然后打开 http://localhost:8000/keypocket/。Web Crypto 和剪贴板功能需要安全上下文；现代浏览器通常将 localhost 视为安全上下文。

## 安全与隐私提醒
- 不要在 Issue、日志、项目档案或截图中分享真实密钥、密码、令牌或加密备份内容。
- 复制密钥会把完整值放入系统剪贴板，请留意共享设备。
- 任何云同步功能都应结合实际代码、Supabase 表策略、浏览器网络请求和部署配置进行验证。
- 详见 SECURITY-ACCEPTANCE.md；其中标记为待验证的项目不得视为已通过。
