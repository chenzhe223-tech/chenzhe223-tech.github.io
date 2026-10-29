-- AI Field Notes V2 migration 0007: align map regions with the actual six V1 learning topics.
-- Existing personal progress uses region keys, so the Skill region keeps the stable "workflow" key.

UPDATE atlas_regions
SET title='技能工坊',
    subtitle='可复用的方法',
    description='把经验变成可复用的 Skill：整理任务流程、约束、工具用法与输出标准，并通过练习持续改进。',
    tags_json='["Skill","流程","验收标准"]',
    track_id='track-skill',
    primary_lesson_id='lesson-v1-skill',
    sort_order=6
WHERE region_key='workflow';

UPDATE atlas_regions
SET title='知识库森林',
    subtitle='尚待探索的知识领域',
    description='面向后续知识库与 RAG 专题的开放区域。整理资料、检索、引用和评估的完整课程尚未发布。',
    tags_json='["知识库","RAG","来源验证"]',
    track_id=NULL,
    primary_lesson_id=NULL,
    sort_order=5
WHERE region_key='knowledge';

UPDATE atlas_regions
SET title='创造者之城',
    subtitle='从念头到应用',
    description='当知识与实践相遇，你可以构建自己的小应用、工具和工作系统。这里的地图由你的真实成果决定。',
    tags_json='["产品构建","实战项目","个人创造"]',
    track_id=NULL,
    primary_lesson_id=NULL,
    sort_order=9
WHERE region_key='creator';

INSERT OR IGNORE INTO atlas_regions
(region_key,title,subtitle,description,tags_json,default_state,track_id,primary_lesson_id,sort_order,is_frontier)
VALUES
('hook','触发机制台地','Hook · 事件与自动检查','理解 Hook 如何在特定事件或生命周期节点触发脚本、校验或动作；具体能力取决于所用工具的实现。','["Hook","事件触发","自动检查"]','unknown','track-hook','lesson-v1-hook',7,0),
('harness','执行环境高原','Harness · 可靠的执行系统','理解模型之外的执行循环、上下文管理、工具权限、结果校验与错误恢复。不同项目对 Harness 的范围可能有所不同。','["Harness","执行环境","可靠性"]','unknown','track-harness','lesson-v1-harness',8,0);

UPDATE atlas_regions SET sort_order=10 WHERE region_key='unknown';
INSERT OR IGNORE INTO schema_migrations(version,name) VALUES ('0007','align_v1_knowledge_topics_to_personal_atlas');
