# KeyPocket V2.0 — GitHub App 私有保险库

## 目标流程
用户在 KeyPocket 中发起绑定；Worker 生成短时 state 并跳转 GitHub App 授权。回调后校验 state、installation 和账号归属。只在用户明确授权范围内建立或确认 `keypocket-cloud-vault` 私有仓库。客户端先加密 KeyPocket 数据，再把密文交给 Worker 写入 vault。恢复时客户端下载密文并在本地解密。

## 最小权限
需要 Metadata read 与 Contents read/write（仅限 KeyPocket vault 仓库）。不需要读取用户其他私有仓库源码、组织管理、Actions 或 issues 权限。服务端需校验 installation 的 repository selection 和 repo allowlist。

## 服务端秘密
GitHub App 私钥、OAuth client secret、webhook secret、state signing key，以及任何服务端 token 只能放在 Cloudflare Worker secrets 或等价密钥管理中。不得提交 GitHub、前端、localStorage 或日志。

## 账户状态
仅记录 GitHub login、avatar、installation/repo ID、vault URL、lastSyncAt、syncStatus。不要在 localStorage 保存个人访问令牌。

## 当前状态
页面有未配置占位；KeyPocket 专用 GitHub App、Worker、OAuth 回调、Secrets、私有仓库读写及多设备恢复都未完成。当前对话可用 GitHub connector 仅为仓库开发权限，不代表应用内用户授权。
