# KeyPocket

KeyPocket 是一款本地优先的 API Key 管理网页应用。

## 访问应用

GitHub Pages 地址： https://chenzhe223-tech.github.io/keypocket/

## 文件结构

- `index.html` — 页面结构与视觉样式
- `app.js` — 本地加密、IndexedDB、密钥记录管理与备份恢复逻辑
- `SECURITY-ACCEPTANCE.md` — 安全验收清单
- `DELIVERY-REPORT.md` — 交付状态与已知限制

## 隐私与安全边界

- 密钥数据设计为保存在当前浏览器本地，不提供云同步。
- 页面设置严格的 Content Security Policy，禁止应用主动发起网络连接。
- 使用前请先以测试密钥验证流程，并妥善保管本地解锁密码与加密备份。
- 浏览器清除站点数据可能导致本地数据丢失；请定期导出加密备份。
- 此版本不是经独立安全审计的密码管理器，不建议作为唯一的生产密钥存储方案。

## 本地运行

在此目录启动静态 HTTP 服务器：

```bash
python -m http.server 8000
```

然后访问 `http://localhost:8000/keypocket/`（如果服务器从仓库根目录启动）。


## 项目清单（MVP 新增）

- 在「我的应用与仓库」中保存项目名称、GitHub 仓库 URL、线上应用 URL、分类、技术栈、标签与备注。
- 项目元数据使用当前本地密钥库的 AES-GCM 加密后存入 IndexedDB。
- 项目清单会包含在加密备份中；旧版本备份若没有 projects 字段，可正常按空项目列表导入。
- 保存 GitHub 仓库链接不需要 GitHub Token；当前版本不会自动读取仓库元数据或同步私有仓库。
- 删除项目只删除本地索引，不会删除 GitHub 仓库或线上网站。
