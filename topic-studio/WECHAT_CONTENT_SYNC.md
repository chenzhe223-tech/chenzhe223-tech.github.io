# DAVYLAB 公众号已发表内容同步指南（WorkBuddy）

## 目标
将 DAVYLAB 公众号后台的真实已发表文章同步到：
`topic-studio/data/published-articles.json`
使 `https://chenzhe223-tech.github.io/topic-studio/` 的「已发内容」页可以显示文章列表。

## 重要边界
- 只能从当前登录的 DAVYLAB 公众号后台核验已发表记录；不要以选题池、待发布草稿或预览链接当作已发表内容。
- 不得绕过登录、验证码或安全检查。遇到扫码、验证码、重新登录时暂停，提示账号所有者本人完成验证。
- 不要求用户把密码、AppSecret、Cookie 或 access_token 粘贴到聊天，也不能将其提交到 GitHub。
- 如果账号有权限使用官方「获取已发布内容列表」接口，后续应由 Cloudflare Worker 在服务端安全调用；禁止把 AppSecret 写入静态网页。
- 如果官方 API 权限不可用（可能与账号主体/认证类型有关），用已登录浏览器后台的「已发表/发表记录」页面做人工核验；不得调用未授权的私有接口或对第三方页面做绕过限制的抓取。
- 仅同步页面可见并可核验的数据。缺失字段留空，不推测、不造假。

## 每次同步步骤
1. 在浏览器中打开 https://mp.weixin.qq.com/ 并确认登录账号显示为 DAVYLAB。
2. 进入公众号后台的「内容管理」/「已发表」或「发表记录」（菜单名称可能随后台版本变化）。
3. 遍历已发表文章列表，尽可能记录标题、原文永久链接、发表日期、栏目（可选）、形式（文章/贴图/视频/其他）、摘要（可选）、封面图片 URL（可选）。
4. 打开文章详情或“复制链接”，核对链接确实是该公众号已发表的文章。不要把预览链接或编辑链接作为永久文章 URL。
5. 下载或读取仓库现有 `topic-studio/data/published-articles.json`，保留历史条目，以文章 URL 去重；不能删除未在当前分页看到的旧记录。
6. 写入下面的 schema 并提交 GitHub 变更。每次同步时将 `last_synced_at` 更新为当前 ISO 时间，将 `sync_status` 设为 `synced_via_browser`。
7. 完成后重新打开工作台的「已发内容」，点“刷新共享档案”，核对数量、日期和原文链接。
8. 向用户汇报实际同步条数、去重条数、失败/缺失字段、后台账号名、最后同步时间。不要仅报告“成功”而不给数量。

## 数据结构
```json
{
  "schema_version": 1,
  "account_name": "DAVYLAB",
  "account_ghid": "",
  "sync_method": "workbuddy-browser",
  "sync_status": "synced_via_browser",
  "last_synced_at": "2026-10-23T03:45:00+08:00",
  "articles": [
    {
      "id": "稳定且唯一的文章 ID",
      "title": "公众号文章正式标题",
      "url": "https://mp.weixin.qq.com/s/真实永久链接",
      "publishedAt": "YYYY-MM-DD",
      "column": "从念头到产品",
      "format": "文章",
      "summary": "可选的简短摘要",
      "coverUrl": "https://真实封面图片地址",
      "source": "WeChat Official Account backend"
    }
  ]
}
```

## 后续可升级为官方 API 同步
先在公众平台后台确认账号「接口权限」是否能调用获取已发表内容列表与文章详情的接口。只有确认有权限后，才由服务端实现 API；凭证放入 Cloudflare Worker Secret，增加手动同步按钮、失败状态、分页游标、去重与最近同步时间。未完成权限确认前，前端必须显示“尚未直接连接微信公众号 API”，不要造成已自动关联的误解。
