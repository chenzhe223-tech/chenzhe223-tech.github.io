# KeyPocket — 未完成任务

最后更新：2026-11-02（UTC+8）
按优先级执行；完成后必须更新 `keypocket/PROJECT_CONTEXT.md` 与 `HANDOFF.md`。

## P0｜可靠性与多端同步验收
- [ ] 读取 `DAVYLAB Browser QA` run `41415872653` 最终状态与失败日志，定位页面刷新后主密码解锁未显示主界面的根因。
- [ ] 在 Playwright 隔离 profile 复现：创建本地库 → 新增 2 条合成 API Key → 刷新 → 输入相同密码 → 断言解锁完成、记录完整。
- [ ] 为 API Key 软删除/恢复、快照创建/恢复、错误备份密码拒绝、错误同步口令拒绝补齐测试。
- [ ] 使用 Supabase 测试账号和两套隔离浏览器完成真实双向同步 E2E：设备登记、首轮同步、另一端拉取、新增/编辑、删除 tombstone、恢复、冲突、云端快照。
- [ ] 确认未登录、错误口令、已撤销设备无法写入；任何失败不得覆盖本地/云端已有数据。
- [ ] 不使用真实 API Key，不将明文密钥写入 CI 日志、截图或 artifact。

## P1｜生产能力完善
- [ ] 完成设备管理/撤销 UI；撤销后在服务端验证 RPC 拒绝该设备。
- [ ] 完成 iPhone Safari 与微信浏览器专项验收。
- [ ] Skill Radar 保持每日采集，历史积累不足时月/季/年榜单必须提示“历史积累中”，不得虚构增长热度。
- [ ] 评估并决定 GitHub App + OAuth/Worker + 私有 Vault 仓库是否进入本轮范围；未配置前保持“未绑定”状态。

## P2｜长期维护
- [ ] 统一仓库 migration 文件与 Supabase 远端 migration history（先只读核对，禁止盲目 db push）。
- [ ] 编写账号迁移/恢复指引、数据冲突说明与云备份恢复演练记录。
- [ ] 定期重新运行 Supabase Security/Performance Advisors，区分 KeyPocket 项目告警与同库 Dashboard Studio 其他对象。

## 已完成（本轮）
- [x] 复核 GitHub 最新提交、目录、README、连续性档案、最近 Actions 与正式 Pages 部署。
- [x] 核验 KeyPocket 专项 Skill Handoff QA run `41408780134` 成功。
- [x] 核验正式 Pages run `41408779662` 成功。
- [x] 生产数据库启用 RLS 的 KeyPocket 同步表进行权限核验。
- [x] 应用最小权限修复：收回无用 TRUNCATE/REFERENCES/TRIGGER 和旧 RPC 权限。
- [x] 进一步关闭 sync_items 客户端直接写入，只保留 authenticated SELECT，唯一写入口为经身份和设备校验的 RPC。
- [x] 将 RPC 设置为 SECURITY DEFINER、固定空 search_path，并移除 sync_items INSERT/UPDATE RLS policy；匿名无 EXECUTE。
- [x] SQL 回查确认 sync_items 仅 SELECT、RLS=true、RPC authenticated EXECUTE=true/anon=false。
- [x] 为整站 Browser QA 重载解锁阶段增加具体诊断日志（commit `3848c1b`）；等待新 Actions 结果。
- [x] 将可复现的最终权限状态加入仓库 Supabase migration 文件。
