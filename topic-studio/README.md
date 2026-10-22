# DAVYLAB 公众号选题工作台

线上地址（部署后）：https://chenzhe223-tech.github.io/topic-studio/

## 第一版功能
- 读取现有 Davy Radar 的公开 JSON：AI 新闻、中国 AI 新闻、GitHub Skill。
- 将素材收进本地选题池，并保留原始来源链接。
- 手动创建/编辑选题，选择栏目、形式、状态和计划日期。
- 从读者价值、时效性、实操性、差异化、品牌契合度五项评分。
- 生成面向 ChatGPT 的编辑指令，复制后继续准备方案和稿件。
- 选题搜索、状态筛选、排期视图、JSON 导入导出。

## 使用方式
1. 打开网站，在“选题发现”浏览今日素材。
2. 点击“收进选题池”保存候选，或点击“生成选题指令”准备编辑提示词。
3. 在“我的选题池”编辑角度、栏目、形式、评分和计划日期。
4. 更换设备时，在旧设备导出 JSON，再在新设备导入。

## 当前边界
- 这是无后端、无账号的本地优先 MVP；记录保存在当前浏览器，不会自动跨设备同步。
- “生成选题指令”是整理提示词，不是在页面内直接调用 AI 模型。
- 在线素材依赖 Davy Radar `radar/data/latest.json` 更新。平台不保证每条素材都适合 DAVYLAB；需阅读原文并判断价值。
- 不会自动操作或发布微信公众号；稿件仍需按 DAVYLAB 的 WorkBuddy 流程保存草稿并由作者本人最终确认。

## 数据来源
- Davy Radar：https://chenzhe223-tech.github.io/radar/daily/
- 今日 JSON：https://chenzhe223-tech.github.io/radar/data/latest.json
- Dashboard Studio：https://ds.dashboard-studio-1dp.pages.dev/

## 技术
纯 HTML/CSS/JavaScript，无需 npm build，沿用现有 GitHub Pages 工作流。
