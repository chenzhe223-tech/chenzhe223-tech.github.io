# Content packages

每个内容包都应放在独立的 `<package-id>/` 目录中。请勿把生成但未验收的素材直接标记为 `ready_for_workbuddy`。

包目录的必需内容取决于 `content_type`：贴图需要 `pages.json`、每页 PNG、配文、来源说明和 QA 报告；文章需要 `article.md`、文章封面/正文图片（如有）、配文、来源说明和 QA 报告。所有相对路径都相对于包目录。

正式包使用 `manifest.json`；模板见 `../templates/manifest.template.json`。
