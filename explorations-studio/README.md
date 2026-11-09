# AI Explorations Studio · By DAVYLAB

独立入口：`/explorations-studio/`。不修改每日 AI Radar 的数据与自动化。

## 产品定位

围绕 AI Explorations 的完整内容生命周期：启动专题 → 核验选题 → 建立编辑素材 → 修订与审校 → 输出 WorkBuddy 交接单 → 核实发布 → 历史归档与知识关联。

## 已实现（首期静态 MVP）

- 编辑首页与最新素材概览
- 素材新建、修改、分类、标签、状态、来源 URL、图片 URL、DAVY'S NOTE
- 素材版本操作日志（不是逐字段完整快照），每次保存追加一条记录
- 历史归档室、检索与恢复
- 基于记录的专题与标签关系图谱，节点点击打开详情
- 本地 JSON 完整导入/导出、WorkBuddy Markdown 任务单导出
- 手机端响应式排版

## 安全、存储与真实执行边界

- 当前使用 localStorage，**不提供登录和多端同步**，清除浏览器数据可能导致记录丢失。
- 图片使用 URL 引用，当前没有上传或永久储存图像的能力。
- 目前生成的是**交接任务单**，不代表已触发 WorkBuddy 执行、发布了微信公众号文章或调用 AI 生图。
- 示例数据仅为首期演示记录，所有条目默认未核验为正式线上已发布。
- 版本记录仅保存修改说明，不是可回滚的全量文件历史；未来采用后端版本表。
- JSON 备份可能包含未公开内容，请勿随意分享。

## 待开发阶段

P1: Supabase 新加坡区 Auth / RLS / Storage / 结构化数据模型 + 多设备同步；迁移与冲突解决。
P2: AI 新闻采集、去重、素材生成编排和审校流水线；可编辑版式源文件。
P3: GitHub/WorkBuddy 接收回执、公众号草稿预览与上线验证；完整发布证据。
P4: 图谱扩充：来源事实、素材版本、衍生图、专题、品牌规范、Skill、发布记录之间的可追溯实体关系与查询。

## 发布与 QA

- 文件路径 `explorations-studio/index.html`
- 仓库源码已提交；生产 URL 必须独立打开并验证后才可标记 Production Deployed。
- 测试范围包括：创建/编辑、版本操作日志、归档/恢复、检索、关系图谱、JSON 导入导出、任务单下载、移动端适配。
- 状态标签：Code Completed；GitHub 提交完成；Live Runtime / Functional Test / Production Deployment 待验证。
