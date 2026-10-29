-- AI Field Notes V2 migration 0002: real V1 knowledge catalog + AI atlas regions
-- Safe to apply repeatedly. Seeded course content is derived from the V1 page content.

CREATE TABLE IF NOT EXISTS atlas_regions (
  region_key TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  tags_json TEXT NOT NULL DEFAULT '[]',
  default_state TEXT NOT NULL DEFAULT 'unknown' CHECK (default_state IN ('known','exploring','unknown')),
  track_id TEXT REFERENCES learning_tracks(id) ON DELETE SET NULL,
  primary_lesson_id TEXT REFERENCES lessons(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_frontier INTEGER NOT NULL DEFAULT 0 CHECK (is_frontier IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_atlas_regions_order ON atlas_regions(sort_order);
CREATE INDEX IF NOT EXISTS idx_atlas_regions_track ON atlas_regions(track_id);

INSERT OR IGNORE INTO learning_tracks (id, slug, title, description, access_tier, status, sort_order)
VALUES
('track-model','model','模型山脉：模型与上下文','理解模型如何根据上下文生成内容，以及能力边界与事实核验。','free','published',1),
('track-agent','agent','Agent 群岛：从回答到行动','理解 Agent 的目标导向、多步行动与工具调用。','free','published',2),
('track-skill','skill','技能工坊：可复用的工作方法','理解 Skill 如何组织任务流程、约束、资源与验收标准。','free','published',3),
('track-hook','hook','触发机制：关键节点自动检查','理解 Hook 在事件或生命周期节点触发检查与动作的方式。','free','published',4),
('track-mcp','mcp','工具连接：MCP 与外部能力','理解 MCP 如何连接 AI 应用与工具、资源等能力。','free','published',5),
('track-harness','harness','执行环境：Harness 与系统可靠性','理解上下文管理、工具循环、权限、校验与恢复策略。','free','published',6);

INSERT OR IGNORE INTO knowledge_releases
(id,track_id,version_label,version_seq,status,release_notes,source_manifest_json,content_hash,created_at,published_at)
VALUES
('release-v1-model','track-model','V1.0',1,'published','来自 AI Field Notes 第一版：模型究竟在做什么？','{"source":"ai-field-notes/index.html","source_type":"first_party_v1"}','v1-model-001','2026-10-29 00:00:00','2026-10-29 00:00:00'),
('release-v1-agent','track-agent','V1.0',1,'published','来自 AI Field Notes 第一版：从回答到完成任务。','{"source":"ai-field-notes/index.html","source_type":"first_party_v1"}','v1-agent-001','2026-10-29 00:00:00','2026-10-29 00:00:00'),
('release-v1-skill','track-skill','V1.0',1,'published','来自 AI Field Notes 第一版：把经验变成可复用方法。','{"source":"ai-field-notes/index.html","source_type":"first_party_v1"}','v1-skill-001','2026-10-29 00:00:00','2026-10-29 00:00:00'),
('release-v1-hook','track-hook','V1.0',1,'published','来自 AI Field Notes 第一版：在关键节点自动检查。','{"source":"ai-field-notes/index.html","source_type":"first_party_v1"}','v1-hook-001','2026-10-29 00:00:00','2026-10-29 00:00:00'),
('release-v1-mcp','track-mcp','V1.0',1,'published','来自 AI Field Notes 第一版：让 AI 接上外部工具。','{"source":"ai-field-notes/index.html","source_type":"first_party_v1"}','v1-mcp-001','2026-10-29 00:00:00','2026-10-29 00:00:00'),
('release-v1-harness','track-harness','V1.0',1,'published','来自 AI Field Notes 第一版：模型之外，还有整套系统。','{"source":"ai-field-notes/index.html","source_type":"first_party_v1"}','v1-harness-001','2026-10-29 00:00:00','2026-10-29 00:00:00');

INSERT OR IGNORE INTO lessons
(id,release_id,slug,title,summary,content_markdown,content_json,access_tier,estimated_minutes,sort_order,created_at)
VALUES
('lesson-v1-model','release-v1-model','model-context','模型究竟在做什么？','理解大语言模型如何根据上下文生成内容，以及为什么它既有能力边界，也可能产生错误。','## 建立直觉\n把模型想成一个读过大量资料、擅长接话和归纳的伙伴。它能帮忙思考，但不等于永远知道事实。\n\n## 理解原理与边界\n理解大语言模型如何根据上下文生成内容，以及为什么它既有能力边界，也可能产生错误。模型会根据学到的模式生成看似合理的内容，不保证每个输出都经过事实核验。重要信息仍需检查来源。\n\n## 思考题\n为什么 AI 有时会一本正经地说错话？','{"easy":"把模型想成一个读过大量资料、擅长接话和归纳的伙伴。它能帮忙思考，但不等于永远知道事实。","pro":"理解大语言模型如何根据上下文生成内容，以及为什么它既有能力边界，也可能产生错误。","question":"为什么 AI 有时会一本正经地说错话？","answer":"模型会根据学到的模式生成看似合理的内容，不保证每个输出都经过事实核验。重要信息仍需检查来源。","tags":["LLM","上下文","幻觉"]}','free',8,1,'2026-10-29 00:00:00'),
('lesson-v1-agent','release-v1-agent','agent-action','从回答到完成任务','Agent 通常围绕目标规划步骤、调用工具、观察结果并继续执行。','## 建立直觉\n普通聊天像问路；Agent 更像拿着目标去办事的人：拆任务、用工具、看结果，必要时调整办法。\n\n## 理解原理与边界\nAgent 通常围绕目标规划步骤、调用工具、观察结果并继续执行。自主程度取决于系统设计与权限。\n\n## 思考题\nAgent 与普通聊天最关键的区别是什么？','{"easy":"普通聊天像问路；Agent 更像拿着目标去办事的人：拆任务、用工具、看结果，必要时调整办法。","pro":"Agent 通常围绕目标规划步骤、调用工具、观察结果并继续执行。自主程度取决于系统设计与权限。","question":"Agent 与普通聊天最关键的区别是什么？","answer":"重点不只是回答内容，而是围绕目标进行多步行动，并可能使用外部工具、根据反馈继续推进。","tags":["Agent","Workflow","工具调用"]}','free',10,2,'2026-10-29 00:00:00'),
('lesson-v1-skill','release-v1-skill','reusable-skill','把经验变成可复用方法','Skill 将某类任务的流程、约束、工具用法与输出标准组织起来。','## 建立直觉\n像给新同事一份 SOP：遇到什么任务、按什么步骤做、交付前检查什么，都写清楚。\n\n## 理解原理与边界\nSkill 将某类任务的流程、约束、工具用法与输出标准组织起来，让智能体在适当情境下复用。\n\n## 思考题\nSkill 的价值只是多一段提示词吗？','{"easy":"像给新同事一份 SOP：遇到什么任务、按什么步骤做、交付前检查什么，都写清楚。","pro":"Skill 将某类任务的流程、约束、工具用法与输出标准组织起来，让智能体在适当情境下复用。","question":"Skill 的价值只是多一段提示词吗？","answer":"不止于提示文本。高质量 Skill 会组织任务流程、约束、资源与验收标准，使执行更可复用。","tags":["Skill","提示词","工作流"]}','free',8,3,'2026-10-29 00:00:00'),
('lesson-v1-hook','release-v1-hook','event-hooks','在关键节点自动检查','Hook 通常在预设生命周期或事件节点触发脚本、校验或动作。','## 建立直觉\n像流水线上的质检员：每当某个步骤发生，就自动检查一次，不必每次都靠人提醒。\n\n## 理解原理与边界\nHook 通常在预设生命周期或事件节点触发脚本、校验或动作。具体含义取决于所用工具的实现。\n\n## 思考题\nHook 和普通手动操作有什么不同？','{"easy":"像流水线上的质检员：每当某个步骤发生，就自动检查一次，不必每次都靠人提醒。","pro":"Hook 通常在预设生命周期或事件节点触发脚本、校验或动作。具体含义取决于所用工具的实现。","question":"Hook 和普通手动操作有什么不同？","answer":"Hook 会在设定的事件或生命周期节点自动触发；它不是万能的自主决策者，能做什么取决于具体配置。","tags":["Hook","自动化","事件"]}','free',7,4,'2026-10-29 00:00:00'),
('lesson-v1-mcp','release-v1-mcp','model-context-protocol','让 AI 接上外部工具','MCP 是连接 AI 应用与外部数据源、工具或能力的一种开放协议。','## 建立直觉\n像统一规格的插头与接口，让 AI 应用能按约定连接不同工具，而不必为每个连接从零设计。\n\n## 理解原理与边界\nMCP 是连接 AI 应用与外部数据源、工具或能力的一种开放协议；实际权限和能力由服务端实现决定。\n\n## 思考题\nMCP 本身是不是一个 AI 模型？','{"easy":"像统一规格的插头与接口，让 AI 应用能按约定连接不同工具，而不必为每个连接从零设计。","pro":"MCP 是连接 AI 应用与外部数据源、工具或能力的一种开放协议；实际权限和能力由服务端实现决定。","question":"MCP 本身是不是一个 AI 模型？","answer":"不是。它是连接应用与工具、资源等能力的协议，不负责替代底层模型。","tags":["MCP","工具","协议"]}','free',8,5,'2026-10-29 00:00:00'),
('lesson-v1-harness','release-v1-harness','execution-harness','模型之外，还有整套系统','Harness 可指围绕模型组织的执行框架与控制机制。','## 建立直觉\n模型像发动机，Harness 更像整辆车的控制系统：方向盘、仪表、刹车、安全带都影响它能否可靠工作。\n\n## 理解原理与边界\nHarness 可指围绕模型组织的执行框架与控制机制，例如上下文管理、工具循环、权限、校验与恢复策略；具体边界因项目而异。\n\n## 思考题\n为什么模型很强，应用仍可能不好用？','{"easy":"模型像发动机，Harness 更像整辆车的控制系统：方向盘、仪表、刹车、安全带都影响它能否可靠工作。","pro":"Harness 可指围绕模型组织的执行框架与控制机制，例如上下文管理、工具循环、权限、校验与恢复策略；具体边界因项目而异。","question":"为什么模型很强，应用仍可能不好用？","answer":"真实应用还依赖上下文、工具、权限、状态管理、错误处理和评估等工程环节。","tags":["Harness","上下文","可靠性"]}','free',9,6,'2026-10-29 00:00:00');

INSERT OR IGNORE INTO atlas_regions
(region_key,title,subtitle,description,tags_json,default_state,track_id,primary_lesson_id,sort_order,is_frontier)
VALUES
('origin','起点营地','从好奇出发','把一个具体问题作为起点，先建立基础认知，再决定下一条探索路线。','["学习路线","问题意识","AI 基础"]','known','track-model','lesson-v1-model',0,0),
('models','模型山脉','模型与上下文','理解模型如何根据上下文生成内容，以及能力边界与事实核验。','["LLM","上下文","幻觉"]','known','track-model','lesson-v1-model',1,0),
('prompt','提示词峡谷','表达与上下文设计','探索如何把问题说清楚、组织上下文、要求可检查的输出。该地图区域是未来专项的导航入口；V1 当前内容主要覆盖模型基础。','["提示词","上下文设计","输出结构"]','exploring','track-model','lesson-v1-model',2,0),
('agent','Agent 群岛','从回答到行动','理解目标导向、多步行动、工具调用与基于反馈调整行动。','["Agent","Workflow","工具调用"]','exploring','track-agent','lesson-v1-agent',3,0),
('tools','工具调用港湾','工具与连接协议','理解 MCP 与外部工具能力的连接关系，并留意实际权限由服务端实现决定。','["MCP","工具","权限"]','unknown','track-mcp','lesson-v1-mcp',4,0),
('knowledge','知识库森林','检索、来源与知识管理','面向未来的知识库与 RAG 专项区域。当前属于待扩充的学习入口，不代表 V1 已有完整课程。','["知识库","RAG","来源验证"]','unknown',NULL,NULL,5,0),
('workflow','自动化边境','工作流与自动化','面向任务拆解、自动化与质量验收的后续专项区域。部分相关概念可从 Agent 和 Skill 课程开始。','["自动化","质量检查","业务流程"]','unknown','track-skill','lesson-v1-skill',6,0),
('creator','创造者之城','从念头到应用','围绕个人项目与真实问题构建 AI 应用的实践区域，V1 提供项目挑战入口，后续继续细化实操课程。','["产品构建","实战项目","个人创造"]','unknown',NULL,NULL,7,0),
('unknown','未知海域','尚未绘制的边界','新方法、新模型与新问题持续出现。此区域保留开放，不试图用一份固定大纲定义 AI 世界的全部边界。','["未知","想象力","未来探索"]','unknown',NULL,NULL,8,1);

INSERT OR IGNORE INTO schema_migrations(version,name) VALUES ('0002','seed_v1_knowledge_and_ai_atlas_regions');
