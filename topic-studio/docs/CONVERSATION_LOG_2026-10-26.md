# 对话与决策日志｜2026-10-26

## 需求
用户希望建立可复用的公众号内容生产链路：结合 Topic Studio 与 GitHub 中的真实素材，由 ChatGPT 分析选题并提出方案；用户批准后生成文章/贴图成果、同步 GitHub；WorkBuddy 接收指令后下载内容并在个人公众号后台执行发布流程。

## 方案决策
- 复用现有仓库 `chenzhe223-tech/chenzhe223-tech.github.io`、`topic-studio/`、现有产品规则和同步指南，不重复建站。
- 新增 `topic-studio/CONTENT_PIPELINE.md` 作为流程规范；新增 `topic-studio/content-pipeline/queue.json` 与 manifest 模板，定义 ChatGPT → GitHub → WorkBuddy 的持久交接格式。
- 新增 `topic-studio/scripts/validate-content-package.mjs` 与 GitHub Actions，对内容包状态、授权范围、贴图标题与字符数、图片路径及 1080×1440 PNG 尺寸执行校验。
- 审批绑定 package ID 和提案版本。默认“批准”只允许生成并保存草稿；“批准生成并发布”才可能授权当前明确包自动发布，且仍要求内容包、QA、公众号后台回查与手机预览一致。
- GitHub Pages 仓库是公开的，只允许存公开内容；禁止存 AppSecret、access_token、Cookie、密码和隐私信息。
- Topic Studio 当前选题池的一部分保存在浏览器 localStorage，不能被其他会话/设备自动读取；要使用这些本地记录需主动导出/分享，或后续另建带身份鉴权的云端同步。
- 不宣称公众号官方 API 已接通。WorkBuddy 浏览器登录、后台草稿与发布行为必须通过实际执行及回执确认。

## 当前 GitHub 变更
- `topic-studio/CONTENT_PIPELINE.md`
- `topic-studio/content-pipeline/README.md`
- `topic-studio/content-pipeline/queue.json`
- `topic-studio/content-pipeline/templates/manifest.template.json`
- `topic-studio/content-pipeline/packages/README.md`
- `topic-studio/scripts/validate-content-package.mjs`
- `.github/workflows/validate-content-packages.yml`
- 更新 Topic Studio README 与运营上下文以链接新流程。

## 验收记录与待办
- GitHub 文件创建/更新操作返回成功；仍需检查新增 GitHub Actions 的实际运行结果与校验脚本运行输出。
- 内容包队列初始化为空；当前不代表此前生成的贴图已同步入队。
- 端到端 WorkBuddy 下载、公众号草稿保存、手机预览及正式发布尚未在本次任务中执行。
