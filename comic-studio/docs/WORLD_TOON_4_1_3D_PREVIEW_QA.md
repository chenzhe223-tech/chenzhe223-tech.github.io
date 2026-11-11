# WORLD/TOON 4.1.2 · 3D 风格预览补图验收

日期：2026-11-11。目的：修复 STYLE 22–25 只有文字、缺少视觉效果图的问题。

## 已提交的真实图片

| ID | 风格 | 静态图片 |
| --- | --- | --- |
| 22 | 电影级 3D 拟人角色 | `comic-studio/assets/style-22-3d-cinematic.webp` |
| 23 | 高级 3D 卡通拟人 | `comic-studio/assets/style-23-3d-toon.webp` |
| 24 | 时尚杂志 3D 图像小说 | `comic-studio/assets/style-24-3d-editorial.webp` |
| 25 | 爆款短剧 3D 漫画 | `comic-studio/assets/style-25-3d-drama.webp` |

资源文件均已经通过 GitHub commit 6ccc61ac083cc78eb1d173376f954fb1d1b31d03 实际入仓。style-v3.js 3.2.1 中含四个不同的 first-party 图片路径和 SHA256 元数据。此四图均标记 `original_guide`，不冒充已通过的平台生产模型测试样张（`sample.status=not_generated`）。

## 代码和展示逻辑检查

- 25 风格图鉴，4 个新分类条目均建立独立 URL。
- `WTStyleV3.cards()` 的四种卡片 HTML 都包含正确的 WebP 文件地址及图片标签；`WTStyleV3.detail()` 也包含每个选中风格的真实参考图。
- `isGuide()` 校验来源域内路径、SHA256 格式及使用范围。
- 图鉴 CSS 定义 3D 图片独立的 object-fit、对齐、文字覆盖层和小屏响应式样式；移动端导航和画廊横向溢出规则已在 CSS 4.1.2 修订。
- Worker 正式脚本源于 GitHub 原始静态资源，WebP 在静态文件路由许可范围内，HTML 引用 style-v3.js/style-v3.css 3.2.1。
- 仓库回归脚本 `tests/worldtoon-3d-drama-smoke.cjs` 包含图像签名、真实文件字节 SHA256、>18000B 体量、25 款卡片、详情图及移动端样式断言。此文档写入时脚本存在，但不能据此声称云端 GitHub Actions run 已通过。

## 验收结论与尚待执行

- **通过**：四张文件真实入仓、图片与风格一一对应、渲染代码检查、Worker 路由配置、样式源代码检查。
- **未独立验证**：登录真实浏览器的桌面与手机端页面截图/点击显示；GitHub Actions 真实云端运行成功结论；WebP 静态端点 HTTP 200 和响应字节的实时独立校验。上述节点不能虚报“全量验收成功”。

人工复核入口：https://worldtoon.chenzhe223.workers.dev/#/director 。浏览器有旧缓存时强制刷新。

By DAVYLAB