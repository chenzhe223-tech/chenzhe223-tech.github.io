# DAVYLAB Radar｜新闻图片质量与来源约束 V1

生效：2026-11-07。适用：每日正式简报网页、正文新闻卡、1200×1800 网站海报；已取消的微信六图不恢复。

## 核心决策

1. **有图不等于合格。** 官方新闻原图、产品截图优先；无可靠、完整图像时，使用与新闻事实绑定的 DAVYLAB **信息卡**，不要强行用通用图库填满。
2. **图片不得冒充事实。** Unsplash / Openverse / 主题示意图一律不作为具体新闻的现场摄影展示；品牌信息卡必须包含“非新闻现场”。数据库保留原图来源、许可及 SHA256 以供追溯。
3. **不强制 center-crop。** 实际新闻图片使用 contain，保留人物、设备、产品 UI 与可辨文字；低分辨率、极端长宽比和竖版人像改为信息卡。任何数据截图不能裁成只有部分词汇。
4. **不得在浏览器请求失败后临时替换为另一张未检验图库图。** 发生加载错误时显示来源信息卡。
5. **不声称没有执行的语义识别。** 当前 V1 为确定性的来源类型、像素、宽高比及版权标记检查；没有实测图像语义 AI、OCR、脸部检测、页面截图内容逐项比对。语义不明的图库素材保守转为信息卡，而非伪造相似度高分。

## 真实实现

- 选图及去重：`radar/scripts/news_image_match.py`，优先原文和发布方素材。它提供的主题图库素材会在展示阶段被抑制。
- SHA256 / pHash：`radar/scripts/quality_gate.py`（保留以前本周禁重复及所有新闻 P0）。
- 像素质量：`radar/scripts/image_visual_quality.py`（`2026-11-07.1`），依照确切校验过的字节检查：
  - 最短边 <230 px 或像素总数 <100000，转信息卡。
  - 宽高比 >3.3 或 <0.55，转信息卡。
  - 宽高比 <0.78 的竖版图片用于横向卡片时，转信息卡。
  - 灰度标准差 <8（近乎均匀空白），转信息卡。
  - 主题图库图、无确认新闻关联的插画：转信息卡。
  - 无法解析或与已验 SHA256 不一致：P0 阻断并尝试下一候选，不伪造成功。
- 数据字段：`image_visual_quality.policy_version`、`display_mode`、`reasons`、`width`、`height`、`aspect_ratio`、`luminance_stddev`、`content_digest_sha256`、`semantic_match_model_verified=false`。汇总记录进入 `test-results/radar/news-image-quality-gate.json` 的 `images.visual_decisions`。
- 网站：`radar/daily/index.html`，对可靠原图使用 contain；若是主题图库、低质量、缺图或加载失败，则显示新闻标题和来源的信息卡，不再自动调用通用 Unsplash 兜底。
- 海报：`radar/scripts/generate_poster.py`，相同策略；验收元数据区分 `verified_photo` 与 `info_card`，并明确记录原图校验摘要和卡片像素摘要。
- 生产：`.github/workflows/pages.yml` 必须在 QA 与最终图、QR、移动端测试全 PASS 后才能提交，不得绕过或覆盖上一有效版。视觉策略版本变化会触发正式重新验收。

## 进阶项（不得标记为已完成）

真实图像主体检测、语义相似度模型与可追溯的视觉模型评分、识别内部水印及截图文字、用户一键换图审核台尚未完成。这些需要额外模型/运行依赖和真实图片样本验收，不能仅凭元数据声称合格。V1 的保守信息卡策略先消除明显乱配图。

## 验收证据

执行 `python -m unittest radar.scripts.test_image_visual_quality radar.scripts.test_quality_gate radar.scripts.test_poster_generation -v`，再执行 `node scripts/qa-radar.cjs`（需 Playwright / 本地静态服务），最终确认 GitHub Actions 的数据、主海报二维码、线上图像及浏览器检查均 PASS。

视觉信息卡不能当作新闻图片新闻现场。不得恢复已取消的 900×1200 微信六图与专题海报。
