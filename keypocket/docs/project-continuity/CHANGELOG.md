## 2026-11-03 — KeyPocket Skill 导入与 iOS 缓存修复
- Skill 导入使用字符串标签格式写入本地加密项目；GitHub owner/repo 比较大小写不敏感，完整仓库 URL 走精确仓库 API，不回退到 Fork 搜索结果。
- 移动端弹窗关闭时取消请求并清理 body 滚动锁；弹窗内部触摸滚动；收录成功后关闭并返回项目列表。
- app.js 与 index.html cache-bust 同步更新为 `kp-v2-skill-import-fix-20261103-23`。
- 最终 Pages `41550827155`、Browser QA `41550827588`、Skill Handoff QA `41550827587` 均 SUCCESS。
- Playwright 覆盖搜索/收录、390px 精确仓库 URL、收录后返回、弹窗再次打开/关闭、无 pageerror；真实 iPhone Safari/微信真机仍待验收。

## 2026-11-03 — iPhone Skill 导入卡顿与仓库 URL 精确匹配
- 修复手机端 Skill 导入弹窗滚动与生命周期：关闭时取消请求、清理滚动锁，防止输入框自动聚焦引起键盘/视口跳动；保存成功自动返回项目列表。
- GitHub 搜索增加请求超时提示。
- 输入完整 GitHub 仓库 URL 时，改用 /repos/{owner}/{repo} 精确读取，不再把 URL 当关键词并返回第三方 Fork。
- 390px Chromium Browser QA 41548966622 SUCCESS：弹窗布局、保存返回、再次打开/关闭通过。
- 精确 URL 的专项 mock 已加入 Browser QA；代码语法/Skill Handoff QA 41549386767 SUCCESS，Pages 41549584320 SUCCESS；同 SHA Browser QA 尚待补跑，iPhone Safari 真机仍待验收。

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


## 2026-11-04 自动备份改为单份最新全量覆盖

- 本地自动快照改为固定 IndexedDB key `kp.snapshot.latest`，每次完整加密后覆盖旧快照；成功写入后清理旧版本，失败保留上一份有效备份。
- 备份中心仅显示最新一份；恢复流程先在内存读取并校验目标备份，再写入保护快照，避免固定 ID 覆盖导致恢复读错。
- 云端 V2 备份改为账号级 `milestone/latest` 单行 upsert；成功写入后删除当前账号其他 daily/monthly/milestone 旧快照。密文仍包含密钥、项目及删除/tombstone 信息。
- 新增 Browser QA：连续两次更新后本地备份仍只有一个稳定 ID，并继续验证最新备份恢复。
