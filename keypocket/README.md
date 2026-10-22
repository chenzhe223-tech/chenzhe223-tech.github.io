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
