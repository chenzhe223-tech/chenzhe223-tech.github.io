# Book-to-Skill × Cangjie — P0 增量验证记录

日期：2026-11-21

## 范围与结论

- 保留现有 PDF.js 本地提取、quality-core.js V2 条文结构、页码、原始 ZIP 的默认行为。
- 新增默认关闭的「仓颉 RIA-TV++ 候选能力包」复选框。
- 开启时基于原有 clause-index.json 追加候选卡、完整条文索引覆盖清单、PIPELINE_STATE、needs-review 和 JSON manifest。
- **不会调用 AI 模型，不会调用仓颉官方 Python CLI，不会生成 verified.yaml 或已审核的 active Skill。**
- P0 用于验证来源与候选资料结构，不代表 RIA-TV++ 端到端蒸馏完成。

## 测试材料

《上海市建设工程工程量清单计价应用规则（2025版）》PDF，仅在本地使用，原始资料不提交 GitHub。

- PDF 物理页：226。
- 可提取文字层页：225。
- 文字层字符：315,657。
- 独立 PyMuPDF 检测：PDF 物理 8–40 页、正文 1–12 章，183 个不同的编号条文（185 次命中）。
- 核对定位：1.0.1（第9页）、3.1.1（第14页）、3.2.1（第16页）、12.1.3（第39页）。
- SHA-256：219c4c5ccffc06c1234a87718c0b8f0e9bfaf99632b9f8099f6ba6c01ff8c670。

注意：独立 PDF 文字层扫描不是当前浏览器 PDF.js 路径的最终功能回归；上述计数也不是准确率，不表示全部条款已被正确恢复。第13章及附录表格未恢复结构。

## 已执行代码验证

- Cangjie 桥接文件 JavaScript 语法与函数运行：通过。
- 7 条模拟编号条款：全部候选保留来源，候选卡 NEEDS_REVIEW，active 技能计数=0。
- 覆盖审计全量包含已解析条文编号，未命中规则的条文仍保留在审计中。
- 未选择仓颉模式时，原有默认生成逻辑不变（代码静态检查）。
- 自动化回归脚本：book-to-skill/tests/cangjie-p0.test.cjs（供 Node 22+ 执行）。

## 未完成验收

- 实际浏览器端 226 页 pdf.js 全流程回归与下载 ZIP 验收。
- 官方仓颉五维 Agent 提取、语义复核、RIA 卡生成、Compiler 和压力测试。
- 第13章及附录复杂表格结构恢复。
- 完整生产环境线上验证。

## 权限与发布

这次只提交至 feat/cangjie-p0-20261121 开发分支，提交 PR 后再进行浏览器与生产验证。**不自动合并、不触发正式站点部署**。

## 项目来源

方法论参考：https://github.com/kangarooking/cangjie-skill （MIT，v2.5.0）。本适配器为 DAVYLAB 独立实现，未复制仓颉官方 Python 编译器源码。