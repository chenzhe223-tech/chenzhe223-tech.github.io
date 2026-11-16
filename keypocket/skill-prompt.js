'use strict';

const skillAgentInstructions = {
  ChatGPT: '先给出应用的输入、处理步骤和输出，再用一份示例数据走通主流程。在可执行的工作区中实现并运行；仅有对话能力时，提供完整项目文件和本地启动、验证步骤。',
  WorkBuddy: '在当前工作目录检查已有文件，将需求拆为 Skill 接入、界面和验证三项任务。逐项修改文件并运行，交付改动清单、启动命令和实际测试结果。',
  Claude: '先阅读项目约定与 Skill 文档，定位可复用的模块和入口。使用 Claude Code 时直接编辑并运行测试；使用 Claude 对话时，提供可运行的文件及对应命令，注明待本机验证的部分。'
};

function openSkillPrompt(project) {
  const profile = skillProfile(project);
  const repo = canonicalSkillRepoUrl(project.repoUrl);
  const catalog = repo && kpHotSkillData?.repositories.find(item => item.url.toLowerCase() === repo.toLowerCase());
  const options = Object.keys(skillAgentInstructions).map(name => '<option>'+name+'</option>').join('');
  openModal('<h2>生成开发指令</h2><p class="sub">'+esc(project.name)+'</p>'+
    '<div class="field"><label for="promptAgent">使用平台</label><select id="promptAgent">'+options+'</select></div>'+
    '<div class="field"><label for="promptGoal">想开发什么应用（选填）</label><input id="promptGoal" maxlength="500" placeholder="例如：把这个 Skill 做成手机可用的工具"></div>'+
    '<div class="field"><label for="promptOutput">开发指令</label><textarea id="promptOutput" readonly rows="8"></textarea></div>'+
    '<p class="sub" role="status" id="promptStatus"></p><div class="modal-actions"><button class="btn" data-action="close">关闭</button><button class="btn primary" id="copySkillPrompt">复制指令</button></div>');
  const platform = $('#promptAgent'), goal = $('#promptGoal'), output = $('#promptOutput'), status = $('#promptStatus');
  function generate() {
    const purpose = project.skillProfile?.manualSummary || catalog?.description || skillMetaLines(project).purpose?.replace(/^[^：]+：/, '') || '';
    const details = [
      'Skill 名称：'+project.name,
      '项目来源：'+(repo || project.repoUrl),
      purpose && '收录的用途说明：'+purpose,
      '分类线索：'+profile.domain+' / '+profile.subcategory,
      project.stack && '收录的技术栈：'+project.stack,
      project.tags && '标签：'+project.tags,
      catalog?.skillFiles?.length && '仓库中的候选入口：'+catalog.skillFiles.slice(0,4).join('、')
    ].filter(Boolean);
    output.value = [
      '请在 '+platform.value+' 中，基于以下 Skill 开发一个可运行的应用。',
      details.join('\n'),
      '应用目标：'+(goal.value.trim() || '围绕该 Skill 最明确的一项能力，做一个支持输入示例、执行处理、查看和导出结果的轻量 Web 工具。'),
      '先核对原仓库 README、对应的 SKILL.md、依赖与许可证。以上收录信息只用于定位；若仓库包含多个 Skill，说明选择哪个入口以及理由。',
      '把文档中的真实输入、处理规则和输出映射到界面与实现。可复用脚本时接入脚本，属于操作指南时实现其工作流。列出必要配置；如依赖服务不可用，显示具体原因。',
      skillAgentInstructions[platform.value],
      '验收：用一个符合该 Skill 的样例演示从输入到输出，再验证一个无效输入。交付启动方法、样例结果、已验证项目与待验证项目。'
    ].join('\n\n');
    status.textContent='';
  }
  platform.addEventListener('change',generate);
  goal.addEventListener('input',generate);
  $('#copySkillPrompt').addEventListener('click',async () => {
    try {
      await navigator.clipboard.writeText(output.value);
      status.textContent='已复制，可粘贴到 '+platform.value+'。';
    } catch {
      output.focus();output.select();output.setSelectionRange(0,output.value.length);
      status.textContent='指令已选中，可使用系统复制。';
    }
  });
  generate();
}
