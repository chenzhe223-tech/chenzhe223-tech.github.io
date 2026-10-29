-- AI Field Notes V2 migration 0008: preserve existing region IDs and personal progress semantics.
-- The preview originally exposed "workflow" as Automation Edge. Keep that identity intact.
-- Add a separate "skill" region for the V1 Skill course instead of reinterpreting stored workflow progress.

UPDATE atlas_regions
SET title='自动化边境',
    subtitle='工作流与自动化',
    description='从一个重复任务开始，设计触发条件、步骤、工具权限、异常处理与验收标准，让自动化稳妥地进入真实工作。',
    tags_json='["工作流","自动化","质量检查"]',
    track_id=NULL,
    primary_lesson_id=NULL,
    sort_order=6
WHERE region_key='workflow';

UPDATE atlas_regions SET sort_order=7 WHERE region_key='hook';
UPDATE atlas_regions SET sort_order=8 WHERE region_key='harness';

INSERT OR IGNORE INTO atlas_regions
(region_key,title,subtitle,description,tags_json,default_state,track_id,primary_lesson_id,sort_order,is_frontier)
VALUES
('skill','技能工坊','Skill · 可复用的任务方法','把经验变成可复用的 Skill：整理任务流程、约束、工具用法与输出标准，并通过练习持续改进。','["Skill","流程","验收标准"]','unknown','track-skill','lesson-v1-skill',9,0);

UPDATE atlas_regions SET sort_order=10 WHERE region_key='creator';
UPDATE atlas_regions SET sort_order=11 WHERE region_key='unknown';
INSERT OR IGNORE INTO schema_migrations(version,name) VALUES ('0008','preserve_workflow_region_and_add_skill_region');
