## 2026-11-02 — 同步账号密码找回
- 同步中心新增“忘记密码”入口，接入 Supabase Auth recover 邮件请求与自定义回跳地址。
- 新增恢复链接解析（recovery access token / token_hash）、新密码确认和 Auth user PATCH。
- 恢复令牌只在页面内存中使用；不改变本地库密码、跨设备加密口令或加密数据；采用不暴露账号是否存在的提示。
- Browser QA 41478022304、Pages 41478020574、KeyPocket Skill Handoff QA 41478022270 均 SUCCESS；合成 E2E 覆盖恢复请求、回跳和密码更新。
- 真实邮件投递尚未验证；需配置 Supabase 自定义 SMTP 和 Redirect URL 白名单。

# KeyPocket CHANGELOG

## 2026-11-02 — V2.0 继续交付与生产同步安全收敛
- 确认本地 IndexedDB 加密格式保持兼容；保留本地快照、30 天回收站与 Skill 收录路径。
- V2 增量同步已实现逐条加密、CAS 版本比较、设备注册、独立同步口令验证及云端每日/月度密文快照。
- Skill Radar 每日 collector 与历史 snapshot workflow 已实现；目前只有单日数据，月/季/年趋势继续显示历史积累中。
- KeyPocket 专项 Skill handoff QA run 41408780134 成功；Pages run 41408779662 成功。
- 修复 Supabase KeyPocket 专属表权限：收回不必要 TRUNCATE/REFERENCES/TRIGGER、旧 RPC EXECUTE，sync_items 客户端只读，唯一写入由受限 RPC 承担。
- 唯一写入 RPC 显式要求 auth.uid、校验设备归属及 revoked_at，并以当前用户范围执行 SQL；函数使用 SECURITY DEFINER 和空 search_path；authenticated 可调用，anon 不可调用。
- 删除 sync_items 旧 INSERT/UPDATE RLS policies，防止将来误授表写权限时打开旁路。
- 为整站 QA 重载解锁失败增加 unlock 状态与 IndexedDB 快照诊断；具体根因待运行日志回传。
- 同步文档与唯一项目状态，标记真实账号双设备与 iOS/微信尚未验收。
