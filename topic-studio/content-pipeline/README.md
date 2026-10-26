# DAVYLAB 内容包队列

这个目录是 ChatGPT 与 WorkBuddy 之间的持久交接区。详细状态机、授权规则和发布步骤见 [CONTENT_PIPELINE.md](../CONTENT_PIPELINE.md)。

## 目录结构

```
content-pipeline/
  README.md
  queue.json                 # 内容包索引，不存密钥
  packages/
    <package-id>/
      manifest.json          # 元数据、审批、QA 与公众号操作回执
      proposal.md            # 待审批提案
      article.md             # 普通图文文章正文（需要时）
      caption.txt            # 贴图/朋友圈/摘要文案
      pages.json             # 贴图每页标题和文字
      source-notes.md        # 来源与事实核查
      qa-report.json         # 机器与人工 QA
      images/card-01.png     # 贴图图片；每页单独图片
      preview.png            # 整体预览（可选）
```

## 队列规则

- `queue.json` 是 package ID 与相对路径的索引；包的状态以每个包的 `manifest.json` 为准。
- `awaiting_approval` 是待用户审阅的提案；WorkBuddy 必须跳过它。
- 只有 `ready_for_workbuddy` 并且审批有效的包可下载处理。
- 只有 `approval.scope=draft_only` 或 `publish_after_approval` 时，WorkBuddy 才能进入公众号后台。
- `publish_after_approval` 必须对当前 package ID 和提案版本有明确授权，不能继承旧包的批准。
- 包只存公开的稿件材料。私密数据和任何凭证均禁止进入此目录。
- 图片、文章、状态更新统一通过 Git commit 版本化；改动前拉取最新 main，发生冲突时不得强制覆盖。

## 当前状态

初始队列为空。不要将先前在对话中生成、但尚未上传至本仓库的本地素材包误认为已经入队。创建新包时先在 ChatGPT 里完成提案审批流程，再同步实际生成的文件。
