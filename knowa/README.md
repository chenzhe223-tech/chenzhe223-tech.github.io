# 知间 KNOWA · By DAVYLAB

基于 2026-11-17 真实 P0 源码包的增量升级（不是重新搭建）。采用单体 Cloudflare Worker + 原生 HTML，开源公共数据优先，默认零付费 AI 调用。

## P0 已实现
- 中英文品牌首页、精选问题、关键词类别卡、移动端响应式。
- **有据可查的静态精选答案**：长江源头、行星密度、青霉素发现者，引用中国科学院、国家林业和草原局、NASA 与 NobelPrize.org。
- **日本诺贝尔奖专题**：NobelPrize.org v2.1 API 完整分页取得官方全部获奖者，不使用未被证实支持的 `birthCountryNow` URL 查询参数，校验 `meta.count` 与 ID 去重，再使用每条 `birth.place.countryNow` 筛选现今日本出生地，逐项列年份/奖项/理由；数据不完整时拒绝输出数字。
- **严格区分口径**：出生在日本 ≠ 日本国籍。该专题只提供出生地口径，国籍定义须另建核验流程。
- 通用问题退化为 Wikipedia/Wikidata 相关检索，**不将搜索摘要冒充完整可信答案**。
- DeepSeek `deepseek-flash` 适配器保留，但默认 `AI_ENABLED=false`；仅存在真正原子扣费配额后才可启用，避免对外发布导致未授权成本。
- 服务端输入长度校验、Content Security Policy、输出转义、外部链接过滤。

## 本地测试

```bash
npm install
npm test
npm run check
npm run dev
```

已覆盖 19 项 Node.js 自动化测试、静态语法检查和桌面/手机 Chromium 排版检查（见 `qa/`）。自动化测试主要使用 Mock 接口，不等于真实 Nobel/DeepSeek 联调。

## 云端部署（2026-11-19 已通过 Cloudflare API 上传）

已在独立 Worker `davylab-knowa-p0` 部署 100%，并启用访问地址：`https://davylab-knowa-p0.chenzhe223.workers.dev/`。Cloudflare 上传/版本/绑定已验证，**站点实际 HTTP 回应尚未实测**，因此仍不得标为完整线上验收通过。源代码已提交至 `chenzhe223-tech/chenzhe223-tech.github.io` 的 `feat/knowa-p0-20261119` 分支之 `knowa/`，且 GitHub Actions 成功。

后续如需使用本地 CLI 手动更新部署，可在认证后执行:

```bash
npm run deploy
```

部署后必须分别请求 `/api/health`、`/api/ask` 并打开浏览器执行真实问答回归；没有通过真实 API 联调前不可标为 Production Verified。

## 重要限制

- Nobel 官方数据 `birthCountryNow` 记录的是**现今出生国**，不是国籍、族裔或工作单位。页面明确披露口径。
- Nobel 页面内容实时由官方提供，实际源数据可能遇到 API 限流/字段变化。翻页不完整时返回 HTTP 503，不猜数字。
- 中国科学院等静态精选答案附权威出处，但未建立持续内容同步机制。
- 通用问题还没有可稳定返回“完整事实答案”的免费推理/结构化检索引擎。
- 未配置真实 DeepSeek API key；AI 真实联调和原子用量闸门未完成。
- 代码已提交至现有 GitHub 仓库的隔离开发分支；独立的 `davylab-knowa` 仓库未创建。Cloudflare 已确认上线部署版本，但真实 HTTP/API 功能验收仍待人工/外部网络复核。

## 2026-11-19 P0 继续升级 · v0.3.0

- **统计纠错：** Nobel API 2.1 不直接请求 `birthCountryNow` 过滤参数，完整分页读取所有官方获奖者后根据 `birth.place.countryNow` 进行日本出生地计数，按唯一 ID 去重。分页不完整、重复 ID、人数不一致均中止，不输出估算数字。
- **口径纠错：** “日本有多少诺贝尔奖得主？”没有明确国籍/出生地定义时，不再返回可能误导的出生地人数。页面提供一键切换“出生于现今日本境内”的明确问题。
- **新增精选来源：** NOAA 马里亚纳海沟、全球大洋中脊，NASA 亚马孙雨林、英国图书馆有明确年代记录的《金刚经》。
- **交付保证：** 可重复构建的 `npm run build`，仓库根目录隔离 `.github/workflows/knowa-p0.yml`，GitHub Actions **19/19 测试通过**（run `44475060643`）。
- **部署状态：** Cloudflare Worker `davylab-knowa-p0` 上传成功，新部署 `7b6562a8-ec25-4214-a466-bdcbb7b0d895` 的版本 `4ff806b3-0b64-4cd4-9636-8917e785b3a8` 已获 Cloudflare API 确认为 100% 流量，workers.dev 子域名已开启。
- **验收未通过项目：** 执行环境无法直接访问公网 Worker 和 Nobel API，因此真实 HTTP/第三方数据全链路功能验收仍待独立验证；不把此项算作已通过。DeepSeek 计费功能始终关闭（`AI_ENABLED=false` 且每日额度 0）。
