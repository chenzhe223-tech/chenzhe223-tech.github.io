# DAVYLAB PPT Studio · P0

**By DAVYLAB｜把想法，做成能用的工具**

可独立运行的静态演示工作台，位于网站 `/ppt-studio/`，不改变现有首页、Radar、WorldToon 和 DesignOS。

## 已实现（真实功能）

- 创建空白幻灯片；TXT / Markdown 大纲转为可编辑幻灯片；导入 / 导出 JSON 项目。
- 文本编辑、复制 / 删除 / 调整页面顺序、封面 / 内容 / 章节 / 结束类型、四种主题。
- 自动保存到 **当前设备** 的 localStorage；演示模式；基础 QA（空标题、页数、长文本和行数）。
- 使用 PptxGenJS **浏览器端**生成原生、可编辑 PPTX（标题、正文、图形），而非截图；备注、资料来源尝试保留到 PPTX Notes。
- 适配桌面与手机；不需要后台账号或收费云服务。

## 未实现（不得宣称完成）

- DeepSeek / 多模型接入、自动生成内容和图片；Office/PDF 图文解析；模板母版高保真导入；多端登录同步；全对象 PPTX 导入编辑；图表原生编辑与动效；浏览器真实 PPTX 端到端验证。
- 事实与版权核验需要人工执行；基础 QA 不是完全排版审核。`PptxGenJS` 脚本由外部 CDN 加载，离线或受限网络会影响 PPTX 导出。

## 技术 / 测试

- 原生 ES modules + CSS，无构建依赖，可由 GitHub Pages 静态托管。
- `node --test ppt-studio/tests/core.test.mjs`
- 手工验收：打开→导入大纲→编辑→刷新恢复→JSON 备份/恢复→PPTX 导出→PowerPoint 中编辑文字。

## 选型依据

| 项目 | 状态 | 作用 |
| --- | --- | --- |
| [PptxGenJS](https://github.com/gitbrent/PptxGenJS) (MIT) | **P0 已实际使用** | 原生 PPTX 输出 |
| [ppt-master](https://github.com/hugohe3/ppt-master) (MIT) | P1 候选 | 复杂版式、模板和生成工作流，需单独适配执行后端 |
| [PPTAgent](https://github.com/icip-cas/PPTAgent) (MIT) | P1/P2 候选 | 规划、反思与布局 QA，不能仅添加 Skill 文件就算接入 |
| [MarkItDown](https://github.com/microsoft/markitdown) (MIT) | P1 候选 | 文档内容提取，需 Python 服务或隔离任务后端 |
| [PPTist](https://github.com/pipipi-pikachu/PPTist) (AGPL-3.0) | 独立研究，不复制进此项目 | 更丰富的在线编辑功能；如直接集成须先确认 AGPL 合规和产品开源策略 |

原帖（https://x.com/tynric_carter/status/2122546747457335787）对应的完整 39 项榜单在本次审阅时无法获取全文，不能将上述候选当成原作者原始名单。以上是独立核验的技术选型。

## 下一阶段

P1 后端隔离模型 API key、内容引擎、Markdown/Word/PDF 解析、生成队列及成本限额；P2 模板引擎与质量闭环；P3 多端登录同步与发布审计。收费资源与生产部署需先取得授权。