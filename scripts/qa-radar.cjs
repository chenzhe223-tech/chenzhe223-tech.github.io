const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const base = process.env.RADAR_TEST_URL || 'http://127.0.0.1:4173/radar/daily/';
const out = 'test-results/radar';
fs.mkdirSync(out, { recursive: true });
const results = [];
function check(ok, name, detail = '') {
  results.push({ status: ok ? 'PASS' : 'FAIL', name, detail: String(detail) });
  console.log('[' + (ok ? 'PASS' : 'FAIL') + '] ' + name + (detail ? ' — ' + detail : ''));
}
(async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    for (const viewport of [{ name: 'desktop', width: 1440, height: 1000, mobile: false }, { name: 'desktop-1440x900', width: 1440, height: 900, mobile: false }, { name: 'desktop-1280', width: 1280, height: 800, mobile: false }, { name: 'mobile', width: 390, height: 844, mobile: true }, { name: 'mobile-360', width: 360, height: 800, mobile: true }]) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, isMobile: viewport.mobile, hasTouch: viewport.mobile });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      const response = await page.goto(base, { waitUntil: 'networkidle', timeout: 30000 });
      check(!!response && response.status() < 400, viewport.name + ': daily page loads', 'HTTP ' + (response && response.status()));
      await page.waitForSelector('#reportDate', { timeout: 10000 });
      await page.waitForTimeout(700);
      await page.evaluate(async () => { const selectedDate=new URLSearchParams(location.search).get('date'); const source=selectedDate?'../data/archive/'+encodeURIComponent(selectedDate)+'.json':'../data/latest.json'; window.__qaRadarData=await fetch(source,{cache:'no-store'}).then(response=>{if(!response.ok)throw Error('QA report data unavailable: '+response.status);return response.json()}); });
      await page.locator('details.more-news, details.more-skills').evaluateAll(nodes => nodes.forEach(el => { el.open = true; }));
      check((await page.title()).includes('AI 前沿简报'), viewport.name + ': page title');
      const browserThemeAudit = await page.evaluate(() => ({
        themeColor: document.querySelector('meta[name="theme-color"]')?.content?.trim().toLowerCase() || '',
        paperToken: getComputedStyle(document.documentElement).getPropertyValue('--paper').trim().toLowerCase()
      }));
      check(browserThemeAudit.themeColor === browserThemeAudit.paperToken && browserThemeAudit.paperToken !== '',
        viewport.name + ': browser theme color matches the shared paper token', JSON.stringify(browserThemeAudit));
      const heroImageAudit = await page.evaluate(() => {
        const story = window.__qaRadarData?.top5?.[0];
        const declared = document.documentElement.style.getPropertyValue('--hero-photo').trim();
        const eligible = story?.image_match_status === 'article_image' && /^https:\/\//.test(story?.image_url || '');
        return { eligible, hasLeadImage: eligible ? declared.includes(new URL(story.image_url).href) : declared === 'none', status: story?.image_match_status || 'missing', declaration: declared };
      });
      check(heroImageAudit.hasLeadImage, viewport.name + ': hero only uses a verified lead article image', JSON.stringify(heroImageAudit));
      const sourceNewsCount = await page.locator('#newsList .item').count();
      check(sourceNewsCount > 0, viewport.name + ': source news rendered', 'count=' + sourceNewsCount);
      const xnewsFixtureAudit = await page.evaluate(() => {
        const original = window.__qaRadarData?.xnews_voices;
        const fixture = {
          url: 'https://example.com/qa-source',
          curated_url: 'https://xnews.qiaomu.ai/qa-fixture',
          title: 'Synthetic X News QA fixture',
          title_zh: '合成 X News QA <script>window.__xss=1</script>',
          summary_zh: '仅用于本地自动化验证的合成样本。',
          published: '2026-11-11T00:00:00Z'
        };
        renderXnewsVoices([
          fixture,
          { url: 'javascript:alert(1)', curated_url: 'https://xnews.qiaomu.ai/invalid', title: 'invalid scheme' }
        ]);
        const section = document.querySelector('#xnewsVoicesSection');
        const root = document.querySelector('#xnewsVoices');
        const article = root?.querySelector('.item');
        const title = article?.querySelector('h3')?.textContent || '';
        const source = article?.querySelector('a[target="_blank"]');
        const editorial = [...(article?.querySelectorAll('a[target="_blank"]') || [])].find(a => a.href.startsWith('https://xnews.qiaomu.ai/'));
        const audit = {
          visible: Boolean(section && getComputedStyle(section).display !== 'none'),
          count: root?.querySelectorAll('.item').length || 0,
          literalEscapedTitle: title === fixture.title_zh && !article?.querySelector('script'),
          sourceSafe: source?.href === fixture.url && source.rel.includes('noopener') && source.rel.includes('noreferrer'),
          editorialSafe: Boolean(editorial && editorial.href === fixture.curated_url && editorial.rel.includes('noopener') && editorial.rel.includes('noreferrer')),
          deepReadRoute: article?.querySelector('h3 a')?.getAttribute('href') || ''
        };
        renderXnewsVoices([]);
        audit.emptyHidden = Boolean(section && getComputedStyle(section).display === 'none' && root?.querySelectorAll('.item').length === 0);
        renderXnewsVoices(original || []);
        return audit;
      });
      check(xnewsFixtureAudit.visible && xnewsFixtureAudit.count === 1, viewport.name + ': X News fixture shows only valid HTTPS entries', JSON.stringify(xnewsFixtureAudit));
      check(xnewsFixtureAudit.literalEscapedTitle, viewport.name + ': X News content is rendered as text, not executable HTML');
      check(xnewsFixtureAudit.sourceSafe && xnewsFixtureAudit.editorialSafe, viewport.name + ': X News original and editorial links use safe HTTPS destinations');
      check(xnewsFixtureAudit.deepReadRoute.includes('type=xnews') && xnewsFixtureAudit.emptyHidden, viewport.name + ': X News deep-read route and truthful empty state work');
      const typeRoles = await page.evaluate(() => ({
        sectionHeading: getComputedStyle(document.querySelector('.section-head h2')).fontFamily,
        kicker: getComputedStyle(document.querySelector('.hero-kicker')).fontFamily,
        rank: getComputedStyle(document.querySelector('.top5-rank')).fontFamily,
        reportDate: getComputedStyle(document.querySelector('#reportDate')).fontFamily,
        dockIndex: getComputedStyle(document.querySelector('.mobile-dock a span')).fontFamily,
        metadata: getComputedStyle(document.querySelector('.meta')).fontVariantNumeric
      }));
      check(/Georgia|Times New Roman/.test(typeRoles.sectionHeading) && /Georgia|Times New Roman/.test(typeRoles.kicker),
        viewport.name + ': English editorial headings use the serif type role', JSON.stringify(typeRoles));
      check(/monospace/.test(typeRoles.rank) && /monospace/.test(typeRoles.reportDate) && (!viewport.mobile || /monospace/.test(typeRoles.dockIndex)) && typeRoles.metadata.includes('tabular-nums'),
        viewport.name + ': ranks, report dates, navigation numerals and metadata use aligned data typography', JSON.stringify(typeRoles));
      check(await page.locator('#chinaAI').count() === 1, viewport.name + ': China AI developments module exists');
      check(await page.locator('#chinaAINewsList').isVisible(), viewport.name + ': China AI module is visible');
      const chinaGridColumns = await page.locator('#chinaAINewsList').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
      check(chinaGridColumns === (viewport.mobile ? 1 : 2), viewport.name + ': China AI card grid uses balanced columns', 'columns=' + chinaGridColumns);
      const chinaCards = page.locator('#chinaAINewsList .china-ai-card');
      const chinaCount = await chinaCards.count();
      if (chinaCount > 0) {
        check(await page.locator('#chinaAINewsList a[href^="https://"]').count() >= chinaCount, viewport.name + ': China AI stories have HTTPS source links', 'cards=' + chinaCount);
        check(await page.locator('#chinaAINewsList .china-category').count() === chinaCount, viewport.name + ': China AI stories have topic labels');
        check(await page.locator('#chinaAINewsList .story-image').count() <= chinaCount, viewport.name + ': no fabricated image when a China AI source has no verified photograph');
        check(await page.locator('#chinaAINewsList .story-image img:not([src^="https://"])').count() === 0, viewport.name + ': used photographs have HTTPS sources');
        check(await page.locator('#chinaAINewsList .story-topic-illustration, #chinaAINewsList .story-info-card').count() === 0, viewport.name + ': no repeated synthetic illustration templates in China news');
        check(await page.locator('#chinaAINewsList .china-story-source').count() === chinaCount, viewport.name + ': each China AI card shows source and publication metadata');
        check(await page.locator('#chinaAINewsList .story-image .image-credit').count() === 0, viewport.name + ': no source badge overlays China AI thumbnails');
        if (chinaCount > 0) {
          const chinaCard = chinaCards.first();
          const initialOpacity = Number(await chinaCard.evaluate(el => getComputedStyle(el.querySelector('.top5-rank')).opacity));
          const initialRankStateOk = initialOpacity > 0.9;
          check(initialRankStateOk, viewport.name + ': China AI rank remains visible in the approved editorial card', 'opacity=' + initialOpacity);
          await chinaCard.hover();
          await page.waitForTimeout(240);
          const hoverState = await chinaCard.evaluate(el => ({ hovered: el.matches(':hover'), active: el.classList.contains('rank-active'), opacity: Number(getComputedStyle(el.querySelector('.top5-rank')).opacity) }));
          check(hoverState.opacity > 0.5, viewport.name + ': China AI card rank appears on hover', JSON.stringify(hoverState));
        }
      } else {
        check((await page.locator('#chinaAINewsList').innerText()).length > 0, viewport.name + ': empty China AI state explains no qualifying stories');
      }
      const cards = page.locator('#top5List .top5-card');
      const count = await cards.count();
      check(count === 5, viewport.name + ': five story cards visible', 'count=' + count);
      check(await page.locator('#top5List .story-image').count() <= 5, viewport.name + ': news without verified photographs stays text-first');
      check(await page.locator('#top5List .story-image img:not([src^="https://"])').count() === 0, viewport.name + ': all visible news photos use HTTPS sources');
      check(await page.locator('#top5List .story-topic-illustration, #top5List .story-info-card').count() === 0, viewport.name + ': repetitive blue AI icon placeholders removed');
      const imageDuplicates = await page.evaluate(() => {
        const seen=new Map(),duplicates=[];
        const stories=[...(window.__qaRadarData?.top5||[]),...(window.__qaRadarData?.china_ai_news||[])];
        for(const item of stories){
          if(!item?.image_url || ['thematic_fallback','image_unavailable','thematic_fallback_budget_exhausted'].includes(item.image_match_status))continue;
          if(item.image_display_mode==='info_card')continue;
          let identity;
          try{const u=new URL(item.image_url);identity=u.hostname.replace(/^www\./,'')+u.pathname.replace(/-\d{2,5}x\d{2,5}(?=\.[a-z0-9]+$)/i,'');}
          catch{continue;}
          const story=item.source_url||item.url||item.title_zh||'';
          if(seen.has(identity) && seen.get(identity)!==story)duplicates.push(identity);
          else seen.set(identity,story);
        }
        return duplicates;
      });
      check(imageDuplicates.length===0,viewport.name+': no duplicate verified thumbnails across different news stories',JSON.stringify(imageDuplicates));
      const visualPolicy = await page.evaluate(async () => {
        const image = document.querySelector('#top5List .story-image--verified img');
        const element = document.createElement('div');
        element.innerHTML = storyImageMarkup({title_zh:'MaaS 模型推理优化',image_match_status:'thematic_fallback',image_source:'Unsplash topic illustration',image_url:'https://images.unsplash.com/photo-123'});
        const h200=document.createElement('div');
        h200.innerHTML=storyImageMarkup({
          title_zh:'纽约时报调查称美国批准 Nvidia H200 销售给空壳中国公司',
          image_match_status:'thematic_fallback',
          image_source:'Unsplash topic illustration',
          image_url:'https://images.unsplash.com/photo-any'
        });
        const matched=document.createElement('div');
        matched.innerHTML=storyImageMarkup({
          title_zh:'OpenAI Assistant dashboard product launch',
          image_match_status:'searched_image',
          image_url:'https://images.example.com/assistant-dashboard.jpg',
          image_page_url:'https://commons.wikimedia.org/wiki/File:OpenAI_dashboard',
          image_credit:'Example contributor',
          image_license:'CC BY 4.0'
        });
        const mock = document.createElement('div');
        mock.className='story-image story-image--verified';
        mock.style.width='348px';mock.style.height='160px';
        const portrait=document.createElement('img');
        portrait.dataset.subject='1';portrait.dataset.cropMode='protected_full_bleed';
        portrait.src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="900"><rect width="300" height="900" fill="blue"/></svg>');
        mock.appendChild(portrait);document.body.appendChild(mock);
        await new Promise(resolve => {if(portrait.complete && portrait.naturalWidth)resolve();else portrait.addEventListener('load',resolve,{once:true});});
        radarImageLoaded(portrait);
        const subjectMode=mock.classList.contains('story-image--protect');
        const backdrop=mock.style.getPropertyValue('--radar-image-bleed');
        const coverFit=image?getComputedStyle(image).objectFit:null;
        const portraitFit=getComputedStyle(portrait).objectFit;
        mock.remove();
        return {coverFit,subjectMode,portraitFit,backdrop,
                stockSuppressed:!element.innerHTML.trim(),
                h200Graphic:Boolean(h200.querySelector('.story-topic-illustration svg')),
                h200RelevantLabel:h200.textContent.includes('H200 / GPU'),
                h200NotNews:h200.textContent.includes('非新闻现场'),
                stockImage:Boolean(element.querySelector('img')),
                matchedSearchPicture:Boolean(matched.querySelector('.story-image--verified img')),
                searchedImageDisclaimer:matched.querySelector('.story-search-attribution')?.textContent||'',
                searchedImageSource:matched.querySelector('.story-search-attribution')?.getAttribute('href')||''};
      });
      check(visualPolicy.coverFit === null || ['cover','contain'].includes(visualPolicy.coverFit), viewport.name + ': verified news photo uses adaptive cover or protected contain');
      check(visualPolicy.subjectMode && visualPolicy.portraitFit === 'contain' && visualPolicy.backdrop.startsWith('url('), viewport.name + ': portrait subjects remain whole with a full-bleed same-photo backdrop');
      check(visualPolicy.stockSuppressed && !visualPolicy.stockImage, viewport.name + ': unrelated stock illustration suppressed without generating template art');
      check(!visualPolicy.h200Graphic && !visualPolicy.h200RelevantLabel && !visualPolicy.h200NotNews,
        viewport.name + ': H200 story never renders a repeating synthetic GPU icon template');
      check(visualPolicy.matchedSearchPicture && /非新闻现场|Not event footage/.test(visualPolicy.searchedImageDisclaimer)
        && visualPolicy.searchedImageSource.startsWith('https://'),
        viewport.name + ': licensed searched photos are displayed with a traceable non-event label');
      check(await page.locator('#top5List .story-image .image-credit').count() === 0, viewport.name + ': no source badge overlays top-story thumbnails');
      if (count > 0) {
        const topStoryCard = cards.first();
        const initialOpacity = Number(await topStoryCard.evaluate(el => getComputedStyle(el.querySelector('.top5-rank')).opacity));
        const initialRankStateOk = initialOpacity > 0.9;
        check(initialRankStateOk, viewport.name + ': Top5 rank is visible before interaction as shown in the approved design', 'opacity=' + initialOpacity);
        await topStoryCard.hover();
        await page.waitForTimeout(240);
        const hoverState = await topStoryCard.evaluate(el => ({ hovered: el.matches(':hover'), active: el.classList.contains('rank-active'), opacity: Number(getComputedStyle(el.querySelector('.top5-rank')).opacity) }));
        check(hoverState.opacity > 0.5, viewport.name + ': top-story rank appears on hover', JSON.stringify(hoverState));
      }
      check(await page.locator('#top5List a[href^="http"]').count() >= 5, viewport.name + ': each story has source link');
      check(await page.locator('#featuredSkill h3').count() === 1, viewport.name + ': daily Skill recommendation is rendered');
      const featuredSkillText = await page.locator('#featuredSkill').innerText();
      check(featuredSkillText.includes('为什么值得一试') || featuredSkillText.toLowerCase().includes('why recommend') || featuredSkillText.toLowerCase().includes('why recommend it'), viewport.name + ': Skill recommendation explains why');
      check(featuredSkillText.includes('今天可以这样试') || featuredSkillText.toLowerCase().includes('try it today'), viewport.name + ': Skill use cases shown');
      check(await page.locator('#featuredSkill [data-nb-skill-save]').count() === 1, viewport.name + ': featured Skill has one-click NianBox save action');
      check(await page.locator('#skillList [data-nb-skill-save]').count() > 0, viewport.name + ': ranked Skills have NianBox save actions');
      check((await page.locator('#featuredSkill [data-nb-skill-save]').getAttribute('href') || '').includes('/niantou-box-app/'), viewport.name + ': NianBox action points to the real app URL');
      const skillSaveAudit = await page.evaluate(() => {
        const nianbox = document.querySelector('#featuredSkill [data-nb-skill-save]');
        const keypocket = document.querySelector('#featuredSkill [data-kp-skill-save]');
        if (!nianbox || !keypocket) return { available: false };
        const expectedName = nianbox.dataset.skillName || '';
        const expectedUrl = nianbox.dataset.skillUrl || '';
        const expectedDate = nianbox.dataset.reportDate || '';
        localStorage.removeItem('nb.radar.pending-skill.v1');
        localStorage.removeItem('kp.radar.pending-skills.v1');
        const clickWithoutNavigation = link => {
          link.addEventListener('click', event => event.preventDefault(), { once: true });
          link.click();
        };
        clickWithoutNavigation(nianbox);
        clickWithoutNavigation(keypocket);
        let nianboxQueue = [], keypocketQueue = [];
        try { nianboxQueue = JSON.parse(localStorage.getItem('nb.radar.pending-skill.v1') || '[]'); } catch {}
        try { keypocketQueue = JSON.parse(localStorage.getItem('kp.radar.pending-skills.v1') || '[]'); } catch {}
        let importLinkPayload = null;
        try {
          const encoded = new URL(keypocket.href).searchParams.get('kp_capture');
          importLinkPayload = encoded ? JSON.parse(encoded) : null;
        } catch {}
        const nb = nianboxQueue[0], kp = keypocketQueue[0];
        let nbUrl = null, nbSourcePage = null;
        try { nbUrl = new URL(nb?.url || ''); } catch {}
        try { nbSourcePage = new URL(nb?.sourcePage || ''); } catch {}
        const nianboxReceiverContract = Boolean(
          nb && typeof nb.id === 'string' && nb.id.startsWith('davy-radar-') &&
          nb.source === 'davy-radar' && Number.isFinite(nb.createdAt) &&
          typeof nb.name === 'string' && nb.name.length > 0 && nb.name.length <= 180 &&
          nbUrl?.protocol === 'https:' && nbUrl.hostname === 'github.com' &&
          !nbUrl.username && !nbUrl.password && nbUrl.pathname.split('/').filter(Boolean).length >= 2 &&
          (nb.description || '').length <= 2400 && (nb.topics || '').length <= 500 &&
          nb.reportDate === expectedDate &&
          nbSourcePage?.pathname.startsWith('/radar/daily')
        );
        return {
          available: true,
          nianboxQueued: nianboxQueue.length === 1 && nb?.source === 'davy-radar' && nb?.name === expectedName && nb?.url === expectedUrl && nb?.reportDate === expectedDate,
          nianboxReceiverContract,
          keypocketQueued: keypocketQueue.length === 1 && kp?.source === 'davy-radar' && kp?.name === expectedName && kp?.url === expectedUrl && kp?.reportDate === expectedDate,
          keypocketImportLink: Boolean(importLinkPayload && importLinkPayload.source === 'davy-radar' && importLinkPayload.name === expectedName && importLinkPayload.url === expectedUrl && importLinkPayload.reportDate === expectedDate)
        };
      });
      check(skillSaveAudit.available, viewport.name + ': Skill save actions exist before interaction');
      check(skillSaveAudit.nianboxQueued, viewport.name + ': clicking the featured Skill writes its matching NianBox queue record', JSON.stringify(skillSaveAudit));
      check(skillSaveAudit.nianboxReceiverContract, viewport.name + ': NianBox queue record meets the receiving app import contract', JSON.stringify(skillSaveAudit));
      check(skillSaveAudit.keypocketQueued && skillSaveAudit.keypocketImportLink, viewport.name + ': clicking the featured Skill writes its matching KeyPocket queue and preserves the import link payload', JSON.stringify(skillSaveAudit));
      check(await page.locator('#archiveDate option').count() >= 2, viewport.name + ': history date options loaded');
      const posterUrl = new URL('../posters/latest.png', base).href;
      const posterResponse = await page.request.get(posterUrl);
      check(posterResponse.ok() && (posterResponse.headers()['content-type'] || '').includes('image/png'), viewport.name + ': generated poster asset is published', posterUrl);
      const currentReportDate = (await page.locator('#reportDate').innerText()).trim();
      const archiveOptionCount = await page.locator('#archiveDate option').count();
      const archiveOption = await page.locator('#archiveDate option').nth(archiveOptionCount > 2 ? 2 : 1).getAttribute('value');
      if (archiveOption) {
        await page.locator('#archiveDate').selectOption(archiveOption);
        await page.waitForTimeout(500);
        check(new URL(page.url()).searchParams.get('date') === archiveOption, viewport.name + ': history selection updates URL', page.url());
        await page.waitForFunction(date => window.__qaRadarData?.report_date === date, archiveOption, { timeout: 10000 });
        const archivedSkillHandoff = await page.evaluate(() => {
          const nianbox = document.querySelector('#featuredSkill [data-nb-skill-save]');
          const keypocket = document.querySelector('#featuredSkill [data-kp-skill-save]');
          if (!nianbox || !keypocket) return { available: false };
          localStorage.removeItem('nb.radar.pending-skill.v1');
          localStorage.removeItem('kp.radar.pending-skills.v1');
          for (const link of [nianbox, keypocket]) {
            link.addEventListener('click', event => event.preventDefault(), { once: true });
            link.click();
          }
          let nianboxQueue = [], keypocketQueue = [];
          try { nianboxQueue = JSON.parse(localStorage.getItem('nb.radar.pending-skill.v1') || '[]'); } catch {}
          try { keypocketQueue = JSON.parse(localStorage.getItem('kp.radar.pending-skills.v1') || '[]'); } catch {}
          const result = {
            available: true,
            renderedDate: window.__qaRadarData?.report_date || '',
            nianboxDate: nianboxQueue[0]?.reportDate || '',
            keypocketDate: keypocketQueue[0]?.reportDate || ''
          };
          localStorage.removeItem('nb.radar.pending-skill.v1');
          localStorage.removeItem('kp.radar.pending-skills.v1');
          return result;
        });
        check(archivedSkillHandoff.available && archivedSkillHandoff.renderedDate === archiveOption,
          viewport.name + ': selected archive data replaces the current report before Skill save', JSON.stringify(archivedSkillHandoff));
        check(archivedSkillHandoff.nianboxDate === archiveOption && archivedSkillHandoff.keypocketDate === archiveOption,
          viewport.name + ': archived Skill save preserves the selected issue date in both handoff queues', JSON.stringify(archivedSkillHandoff));
        await page.goto(base, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(500);
      }

      const firstCard = page.locator('#top5List .top5-card').first();
      const editorialLayoutAudit = await page.evaluate(() => ({
        leadBackground: getComputedStyle(document.querySelector('#leadStory')).backgroundColor,
        leadTitle: getComputedStyle(document.querySelector('#leadStory h2')).color,
        leadImage: !!document.querySelector('#leadStory .story-image img'),
        top5Background: getComputedStyle(document.querySelector('#top5List .top5-card')).backgroundColor,
        top5Title: getComputedStyle(document.querySelector('#top5List .top5-card h3')).color
      }));
      check(editorialLayoutAudit.leadBackground === 'rgb(32, 35, 32)' && editorialLayoutAudit.leadTitle === 'rgb(255, 255, 255)' && editorialLayoutAudit.leadImage === heroImageAudit.eligible,
        viewport.name + ': lead story uses only a verified article image when one exists, with a readable overlay title', JSON.stringify({ ...editorialLayoutAudit, imageEligible: heroImageAudit.eligible }));
      check(editorialLayoutAudit.top5Background === 'rgba(0, 0, 0, 0)' && editorialLayoutAudit.top5Title === 'rgb(32, 35, 32)',
        viewport.name + ': Top5 is a transparent editorial list with ink titles', JSON.stringify(editorialLayoutAudit));
      check(await page.locator('#leadStory a[href*="type=top5"]').count() === 1, viewport.name + ': lead story opens the matching deep-read route');
      const editorial = page.locator('#editorialCore');
      if (await editorial.count()) {
        const isVisible = await editorial.isVisible();
        const hasSynthesis = await page.evaluate(() => !!document.querySelector('#editorialCore strong'));
        if (!hasSynthesis) check(!isVisible, viewport.name + ': internal missing-analysis status is hidden from readers');
      }
      check(await page.locator('#featureTitle').innerText().then(x => x.trim().length > 0), viewport.name + ': lead feature has a headline');
      const heroEditorialStyles = await page.evaluate(() => {
        const title = getComputedStyle(document.querySelector('#featureTitle'));
        const action = getComputedStyle(document.querySelector('.hero-actions>a:not(.secondary)'));
        return { titleBackground: title.backgroundImage, titleColor: title.webkitTextFillColor || title.color, actionBackground: action.backgroundImage, actionColor: action.backgroundColor };
      });
      check(heroEditorialStyles.titleBackground === 'none' && heroEditorialStyles.titleColor === 'rgb(32, 35, 32)', viewport.name + ': global masthead uses solid editorial ink', JSON.stringify(heroEditorialStyles));
      check(heroEditorialStyles.actionBackground === 'none' && heroEditorialStyles.actionColor === 'rgb(135, 86, 51)', viewport.name + ': primary hero action uses accessible copper', JSON.stringify(heroEditorialStyles));
      const storyLabel = await page.locator('#top5List .story-label').first().innerText();
      if (storyLabel.includes('暂不可用') || storyLabel.includes('UNAVAILABLE')) {
        const cardsText = await cards.allInnerTexts();
        check(cardsText.every(x => !x.includes('/50') && !x.includes('/10')), viewport.name + ': source fallback does not display fabricated scores');
        const internalAIStatus = page.locator('#aiList');
        check(!(await internalAIStatus.isVisible()), viewport.name + ': internal AI-unavailable note stays hidden');
      }
      const contrastAudit = await page.evaluate(() => {
        const parseColor = value => {
          if (!value) return null;
          const s = String(value).trim().toLowerCase();
          if (s === 'transparent') return {r:0,g:0,b:0,a:0};
          const hex = s.match(/^#([0-9a-f]{3,8})$/i);
          if (hex) {
            let h=hex[1];
            if (h.length===3 || h.length===4) h=[...h].map(ch=>ch+ch).join('');
            if (h.length===6 || h.length===8) return {r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4,6),16),a:h.length===8?parseInt(h.slice(6,8),16)/255:1};
          }
          const rgb=s.match(/rgba?\(([^)]+)\)/i);
          if (!rgb) return null;
          const values=rgb[1].replace(/\s*\/\s*/g,',').split(/[\s,]+/).filter(Boolean);
          const channel=v=>v.endsWith('%')?Math.round(parseFloat(v)*2.55):parseFloat(v);
          return {r:channel(values[0]),g:channel(values[1]),b:channel(values[2]),a:values[3]===undefined?1:(values[3].endsWith('%')?parseFloat(values[3])/100:parseFloat(values[3]))};
        };
        const composite=(top,bottom,overrideAlpha) => {
          const a=overrideAlpha===undefined?top.a:overrideAlpha;
          return {r:top.r*a+bottom.r*(1-a),g:top.g*a+bottom.g*(1-a),b:top.b*a+bottom.b*(1-a),a:1};
        };
        const luminance=c=>{
          const f=v=>{v=v/255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)};
          return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b);
        };
        const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
        const unique=colors=>{
          const seen=new Set();return colors.filter(c=>{const k=[Math.round(c.r),Math.round(c.g),Math.round(c.b)].join(',');if(seen.has(k))return false;seen.add(k);return true;});
        };
        const backgroundColors=el=>{
          const chain=[];for(let n=el;n&&n.nodeType===1;n=n.parentElement)chain.unshift(n);
          let candidates=[parseColor(getComputedStyle(document.body).backgroundColor)||parseColor('#F5F6F8')];
          for(const node of chain){
            const st=getComputedStyle(node);
            const parentCandidates=candidates;
            const bg=parseColor(st.backgroundColor);
            const bases=parentCandidates.map(old=>bg&&bg.a>0?composite(bg,old):old);
            if(st.backgroundImage&&st.backgroundImage!=='none'){
              const stopStrings=st.backgroundImage.match(/rgba?\([^)]+\)|#[0-9a-f]{3,8}|transparent/gi)||[];
              const stops=stopStrings.map(parseColor).filter(Boolean);
              if(stops.length){
                const imageCandidates=[];
                for(const stop of stops){
                  const basesForStop=stop.a<.999?bases:parentCandidates;
                  for(const base of basesForStop) imageCandidates.push(composite(stop,base));
                }
                candidates=stops.every(x=>x.a>=.999)?imageCandidates:[...bases,...imageCandidates];
              }else candidates=bases;
            }else candidates=bases;
            const opacity=parseFloat(st.opacity);
            if(Number.isFinite(opacity)&&opacity<.999&&opacity>=0){
              candidates=candidates.map((bg,i)=>composite(bg,parentCandidates[Math.min(i,parentCandidates.length-1)]||bg,opacity));
            }
            candidates=unique(candidates);
          }
          return candidates;
        };
        const visible=el=>{
          if(!el||!el.getClientRects().length)return false;
          for(let n=el;n&&n.nodeType===1;n=n.parentElement){
            const s=getComputedStyle(n);
            if(s.display==='none'||s.visibility==='hidden'||s.visibility==='collapse')return false;
            if(n.tagName==='DETAILS'&&!n.open&&el!==n)return false;
          }
          return true;
        };
        const results=[];
        const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
        while(walker.nextNode()){
          const node=walker.currentNode;
          const text=node.nodeValue.replace(/\s+/g,' ').trim();
          const el=node.parentElement;
          if(!text||!visible(el)||el.closest('script,style,svg,canvas,noscript,template,[aria-hidden="true"]'))continue;
          const st=getComputedStyle(el);
          let fg=parseColor(st.webkitTextFillColor)||parseColor(st.color);
          if(!fg||fg.a<.01)continue; // transparent gradient text is audited by its stop colors separately
          let opacity=1;
          for(let n=el;n&&n.nodeType===1;n=n.parentElement){
            const o=parseFloat(getComputedStyle(n).opacity);
            if(Number.isFinite(o))opacity*=o;
          }
          if(opacity<.01)continue;
          const bgs=backgroundColors(el);
          let worst={ratio:Infinity,foreground:fg,background:bgs[0]};
          for(const bg of bgs){
            const renderedFg=composite(fg,bg,fg.a*opacity);
            const ratio=contrast(renderedFg,bg);
            if(ratio<worst.ratio)worst={ratio,foreground:renderedFg,background:bg};
          }
          const size=parseFloat(st.fontSize)||16,weight=parseInt(st.fontWeight,10)||400;
          const large=size>=24||(size>=18.66&&weight>=700);
          const minimum=large?3:4.5;
          results.push({text:text.slice(0,90),selector:el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+(el.classList.length?'.'+[...el.classList].slice(0,3).join('.'):''),
            ratio:Number(worst.ratio.toFixed(2)),rawRatio:worst.ratio,minimum,foreground:[Math.round(worst.foreground.r),Math.round(worst.foreground.g),Math.round(worst.foreground.b)].join(','),
            background:[Math.round(worst.background.r),Math.round(worst.background.g),Math.round(worst.background.b)].join(','),opacity:Number(opacity.toFixed(3))});
        }
        const failures=results.filter(x=>x.rawRatio<x.minimum);
        const worst=results.reduce((current,x)=>!current||x.rawRatio<current.rawRatio?x:current,null);
        return {checked:results.length,failures:failures.slice(0,40),failureCount:failures.length,minimumRatio:worst?worst.rawRatio:null,worst};
      });
      check(contrastAudit.checked > 50, viewport.name + ': contrast audit checked rendered text', 'checked=' + contrastAudit.checked);
      check(contrastAudit.failureCount === 0, viewport.name + ': WCAG AA text contrast passes for all visible text (4.5:1 normal, 3:1 large)', JSON.stringify({checked:contrastAudit.checked,minimumRatio:contrastAudit.minimumRatio,failureCount:contrastAudit.failureCount,failures:contrastAudit.failures.slice(0,12)}));
      const overflow = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
      check(overflow.document <= overflow.viewport + 2, viewport.name + ': no horizontal page overflow', JSON.stringify(overflow));
      const bodyColor = await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor);
      check(bodyColor !== 'rgba(0, 0, 0, 0)', viewport.name + ': page has computed background', bodyColor);
      await page.screenshot({ path: path.join(out, viewport.name + '.png'), fullPage: true });
      await page.getByRole('button', { name: 'EN' }).click();
      check(await page.locator('html').getAttribute('lang') === 'en', viewport.name + ': language switch works');
      check((await page.locator('#chinaAI h2').innerText()).includes('China AI'), viewport.name + ': China AI module localizes to English');
      await page.getByRole('button', { name: '中文' }).click();
      check(await page.locator('html').getAttribute('lang') === 'zh-CN', viewport.name + ': language switches back');
      check(errors.length === 0, viewport.name + ': no JavaScript errors', errors.join('; '));
      const deepReadLink = page.locator('#top5List a[href*="../read/"]').first();
      check(await deepReadLink.count() === 1, viewport.name + ': first story has a deep-reader route');
      if (await deepReadLink.count()) {
        await deepReadLink.click();
        await page.locator('#content .title').waitFor({ state: 'visible', timeout: 10000 });
        check(new URL(page.url()).pathname.includes('/radar/read/'), viewport.name + ': story opens in the deep reader', page.url());
        await page.goBack({ waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForSelector('#reportDate', { timeout: 10000 });
        check(new URL(page.url()).pathname.endsWith('/radar/daily/') && (await page.locator('#reportDate').innerText()).includes('2026-11-12'), viewport.name + ': browser back restores the briefing', page.url());
      }
      await page.close();
    }
    for (const viewport of [
      { name: 'reader-desktop', width: 1440, height: 1000, mobile: false, date: '2026-11-12' },
      { name: 'reader-desktop-1440x900', width: 1440, height: 900, mobile: false, date: '2026-11-12' },
      { name: 'reader-mobile', width: 390, height: 844, mobile: true, date: '2026-11-12' },
      { name: 'reader-archive-360', width: 360, height: 800, mobile: true, date: '2026-11-11' }
    ]) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, isMobile: viewport.mobile, hasTouch: viewport.mobile });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      const readerUrl = new URL('../read/', base);
      readerUrl.search = new URLSearchParams({ type: 'top5', id: '0', date: viewport.date }).toString();
      const response = await page.goto(readerUrl.href, { waitUntil: 'networkidle', timeout: 30000 });
      check(!!response && response.status() < 400, viewport.name + ': deep reader loads', 'HTTP ' + (response && response.status()));
      await page.locator('#content .title').waitFor({ state: 'visible', timeout: 10000 });
      check((await page.locator('#content .title').innerText()).length > 8, viewport.name + ': real story title is visible');
      const readerTypeRoles = await page.evaluate(() => ({
        title: getComputedStyle(document.querySelector('#content .title')).fontFamily,
        score: getComputedStyle(document.querySelector('#content .score b')).fontFamily,
        provenanceNumeric: getComputedStyle(document.querySelector('#content .provenance')).fontVariantNumeric
      }));
      check(/Georgia|Times New Roman/.test(readerTypeRoles.title), viewport.name + ': deep-read title uses the editorial serif role', JSON.stringify(readerTypeRoles));
      check(/monospace/.test(readerTypeRoles.score) && readerTypeRoles.provenanceNumeric.includes('tabular-nums'),
        viewport.name + ': deep-read scores and provenance use aligned data typography', JSON.stringify(readerTypeRoles));
      check(await page.locator('#content .provenance').isVisible(), viewport.name + ': source and date provenance is visible');
      check((await page.locator('.rail').innerText()).includes(viewport.date), viewport.name + ': requested briefing date is shown in reader rail');
      check(await page.locator('#content .scores').isVisible(), viewport.name + ': five-dimension assessment is visible');
      check(await page.locator('.rail-links a[href^="../daily/"]').count() === 1, viewport.name + ': return-to-briefing link is present');
      const overflow = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
      check(overflow.document <= overflow.viewport + 2, viewport.name + ': deep reader has no horizontal overflow', JSON.stringify(overflow));
      await page.screenshot({ path: path.join(out, viewport.name + '.png'), fullPage: true });
      await page.getByRole('button', { name: 'EN' }).click();
      check(await page.locator('html').getAttribute('lang') === 'en', viewport.name + ': deep reader language switch works');
      check((await page.locator('#content').innerText()).includes('Five dimensions'), viewport.name + ': assessment is localized in English');
      check(errors.length === 0, viewport.name + ': deep reader has no JavaScript errors', errors.join('; '));
      await page.close();
    }
    const xnewsDeepReadCases = [
      { name: 'xnews-reader-desktop', width: 1440, height: 900, mobile: false, date: '2026-11-12' },
      { name: 'xnews-reader-mobile', width: 390, height: 844, mobile: true, date: '2026-11-12' },
      { name: 'xnews-reader-archive-360', width: 360, height: 800, mobile: true, date: '2026-11-11' }
    ];
    for (const viewport of xnewsDeepReadCases) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, isMobile: viewport.mobile, hasTouch: viewport.mobile });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      const fixture = {
        url: 'https://example.com/qa-xnews-original',
        source_url: 'https://example.com/qa-xnews-original',
        curated_url: 'https://xnews.qiaomu.ai/qa-fixture',
        title: 'Synthetic X News QA fixture',
        title_zh: '合成 X News 深读验收样本',
        title_en: 'Synthetic X News deep-read fixture',
        summary_zh: '用于验证真实页面路由、原始来源和中文编辑链接的合成测试内容。',
        summary_en: 'Synthetic content for verifying the real page route, original source and Chinese editorial link.',
        published: '2026-11-11T00:00:00Z',
        source: 'X News · 海外发现',
        source_kind: 'curated_secondary',
        verification_status: 'source_not_independently_verified'
      };
      let report;
      const endpoint = 'archive/' + viewport.date;
      const homeTarget = new URL('../daily/', base);
      homeTarget.search = new URLSearchParams({ date: viewport.date }).toString();
      const homeResponse = await page.goto(homeTarget.href, { waitUntil: 'networkidle', timeout: 30000 });
      check(!!homeResponse && homeResponse.status() < 400, viewport.name + ': dated daily homepage loads before X News selection', 'HTTP ' + (homeResponse && homeResponse.status()));
      report = await page.evaluate(({ item, date }) => {
        const data = JSON.parse(JSON.stringify(window.__qaRadarData || {}));
        data.report_date = date;
        data.xnews_voices = [item];
        return data;
      }, { item: fixture, date: viewport.date });
      await page.evaluate(item => renderXnewsVoices([item]), fixture);
      const storyLink = page.locator('#xnewsVoices .item h3 a');
      const storyCount = await storyLink.count();
      check(storyCount === 1, viewport.name + ': homepage displays the X News fixture as a selectable story');
      const storyHref = storyCount === 1 ? await storyLink.getAttribute('href') : '';
      check(Boolean(storyHref && storyHref.includes('type=xnews') && storyHref.includes('date=' + viewport.date)),
        viewport.name + ': homepage X News story links to its dated deep-read route', storyHref || '');
      let fixtureResponseServed = false;
      const dataRequests = [];
      await page.route('**/*', async route => {
        const requestUrl = route.request().url();
        const pathname = new URL(requestUrl).pathname;
        if (requestUrl.includes('/radar/data/')) dataRequests.push(requestUrl);
        if (pathname.endsWith('/radar/data/' + endpoint + '.json')) {
          fixtureResponseServed = true;
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(report) });
        } else {
          await route.continue();
        }
      });
      let readerResponse = null;
      if (storyCount === 1) {
        [readerResponse] = await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }),
          storyLink.click()
        ]);
      }
      check(!!readerResponse && readerResponse.status() < 400, viewport.name + ': clicking the X News story opens its deep reader', 'HTTP ' + (readerResponse && readerResponse.status()) + ' ' + page.url());
      check(new URL(page.url()).pathname === '/radar/read/', viewport.name + ': X News click reaches the reader route', page.url());
      check(fixtureResponseServed, viewport.name + ': matching dated archive X News fixture is served', JSON.stringify(dataRequests));
      const readerTarget = new URL(page.url());
      const titleLocator = page.locator('#content .title');
      const titleCount = await titleLocator.count();
      check(titleCount === 1, viewport.name + ': X News deep reader renders a story title', JSON.stringify({ url: readerTarget.href, dataRequests, content: await page.locator('#content').innerText() }));
      if (titleCount === 1) {
        check((await titleLocator.innerText()).trim() === fixture.title_zh, viewport.name + ': X News deep reader shows the matching story title');
        check((await page.locator('#content').innerText()).includes(fixture.summary_zh), viewport.name + ': X News deep reader renders the supplied summary');
        check(await page.locator('.story .section').count() === 1,
          viewport.name + ': real-shape X News fixture renders only the supplied summary section without invented editorial fields');
        check(await page.locator('.story .scores').count() === 0,
          viewport.name + ': X News deep reader omits unavailable assessment scores');
        check((await page.locator('#content .category').innerText()).includes(fixture.source),
          viewport.name + ': missing category falls back to the real X News source label');
        check((await page.locator('.rail').innerText()).includes(viewport.date), viewport.name + ': X News deep reader preserves the requested briefing date');
      } else {
        check(false, viewport.name + ': X News deep reader shows the matching story title');
        check(false, viewport.name + ': X News deep reader renders the supplied summary');
        check(false, viewport.name + ': X News deep reader preserves the requested briefing date');
      }
      const sourceLinks = page.locator('.rail-links a[target="_blank"]');
      check(titleCount === 1 && await sourceLinks.count() === 2, viewport.name + ': original and curated X News links are both visible');
      if (titleCount === 1 && await sourceLinks.count() === 2) {
        const links = await sourceLinks.evaluateAll(nodes => nodes.map(a => ({ href: a.href, rel: a.rel })));
        check(links[0].href === fixture.url && links[0].rel.includes('noopener') && links[0].rel.includes('noreferrer'),
          viewport.name + ': original X News source link is HTTPS and opener-safe', JSON.stringify(links[0]));
        check(links[1].href === fixture.curated_url && links[1].rel.includes('noopener') && links[1].rel.includes('noreferrer'),
          viewport.name + ': X News editorial link is host-restricted and opener-safe', JSON.stringify(links[1]));
      }
      const returnHref = await page.locator('.rail-links a[href^="../daily/"]').getAttribute('href');
      check(titleCount === 1 && returnHref === '../daily/?date=' + viewport.date, viewport.name + ': X News deep reader returns to the matching issue', returnHref || '');
      await page.getByRole('button', { name: 'EN' }).click();
      check(titleCount === 1 && (await titleLocator.innerText()).trim() === fixture.title_en, viewport.name + ': X News deep reader switches to English');
      check(titleCount === 1 && (await page.locator('#content').innerText()).includes(fixture.summary_en), viewport.name + ': X News deep reader localizes the supplied summary');
      await page.getByRole('button', { name: '中文' }).click();
      const overflow = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
      check(overflow.document <= overflow.viewport + 2, viewport.name + ': X News deep reader has no horizontal overflow', JSON.stringify(overflow));
      await page.screenshot({ path: path.join(out, viewport.name + '.png'), fullPage: true });
      const returnLink = page.locator('.rail-links a[href^="../daily/"]');
      const [returnResponse] = await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }),
        returnLink.click()
      ]);
      check(!!returnResponse && returnResponse.status() < 400, viewport.name + ': clicking return opens the daily briefing', 'HTTP ' + (returnResponse && returnResponse.status()) + ' ' + page.url());
      const returnedUrl = new URL(page.url());
      check(returnedUrl.pathname.endsWith('/radar/daily/') && returnedUrl.searchParams.get('date') === viewport.date,
        viewport.name + ': return click restores the matching issue URL', page.url());
      await page.locator('#reportDate').waitFor({ state: 'visible', timeout: 10000 });
      const returnedDate = await page.locator('#reportDate').innerText();
      check(returnedDate.includes(viewport.date), viewport.name + ': returned daily page shows the matching date', returnedDate);
      check(errors.length === 0, viewport.name + ': X News deep reader and return navigation have no JavaScript errors', errors.join('; '));
      await page.close();
    }
  } catch (error) {
    check(false, 'test runner completed', error.stack || error.message);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ target: base, results, passed: results.filter(x => x.status === 'PASS').length, failed: results.filter(x => x.status === 'FAIL').length }, null, 2));
  if (results.some(x => x.status === 'FAIL')) process.exitCode = 1;
})();
