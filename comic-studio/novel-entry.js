/* WORLD/TOON · By DAVYLAB — P0 visible novel distillation entry.
   Reuse existing projects and WTNovelStudio: do not upload or export source automatically. */
'use strict';
(function(){
  const priorDashboard=dashboard;
  function creationCards(){
    return '<section class="wt-entry-launch" aria-label="开始漫画创作">'+
      '<div class="wt-entry-eyebrow">CREATE / 开始创作</div>'+
      '<h2>从这里，开始一部漫画</h2>'+
      '<p>选择一种创作方式，随后进入统一的作品制作流程。</p>'+
      '<div class="wt-entry-grid">'+
        '<a class="wt-entry-card" href="#/live"><span class="wt-entry-symbol">◉</span><strong>热点改编</strong><small>从新闻和全球热点选题</small><span class="wt-entry-arrow">→</span></a>'+
        '<button type="button" class="wt-entry-card" data-action="new"><span class="wt-entry-symbol">✦</span><strong>一句话创作</strong><small>快速新建，AI 辅助扩写</small><span class="wt-entry-arrow">→</span></button>'+
        '<button type="button" class="wt-entry-card wt-entry-novel" data-wt-novel-start><span class="wt-entry-symbol">▤</span><strong>小说蒸馏</strong><small>上传小说，提炼章节与人物线索</small><span class="wt-entry-arrow">→</span></button>'+
        '<a class="wt-entry-card" href="#/workspace"><span class="wt-entry-symbol">▧</span><strong>自主创作</strong><small>自行定义故事与人物</small><span class="wt-entry-arrow">→</span></a>'+
      '</div></section>';
  }
  dashboard=function(){return creationCards()+priorDashboard()};
  function showNovelPanel(){
    const detail=document.querySelector('[data-novel-panel]');
    if(!detail){notify('已创建小说项目，请在 AI 编剧阶段打开小说蒸馏面板');return}
    detail.open=true;
    detail.scrollIntoView({block:'start',behavior:'smooth'});
    const source=detail.querySelector('[data-novel-file]');
    if(source)source.setAttribute('aria-label','选择小说文件以建立本地结构索引');
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-wt-novel-start]');
    if(!button)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    // A novel is a new work by default, never overwrite or unlock a previous project.
    newProject();
    const p=selected();
    if(p){
      p.creationSource='novel';
      p.title='未命名小说导读';
      ui.wt4Step=1;
      persist();
      nav('workspace/'+p.id+'/1');
      requestAnimationFrame(showNovelPanel);
    }
  },true);
  if(location.hash==='#/dashboard')queueMicrotask(()=>render());
})();