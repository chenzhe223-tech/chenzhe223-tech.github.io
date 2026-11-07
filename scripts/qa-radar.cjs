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
    for (const viewport of [{ name: 'desktop', width: 1440, height: 1000, mobile: false }, { name: 'mobile', width: 390, height: 844, mobile: true }]) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, isMobile: viewport.mobile, hasTouch: viewport.mobile });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      const response = await page.goto(base, { waitUntil: 'networkidle', timeout: 30000 });
      check(!!response && response.status() < 400, viewport.name + ': daily page loads', 'HTTP ' + (response && response.status()));
      await page.waitForSelector('#reportDate', { timeout: 10000 });
      await page.waitForTimeout(700);
      await page.locator('details.more-news, details.more-skills').evaluateAll(nodes => nodes.forEach(el => { el.open = true; }));
      check((await page.title()).includes('AI 前沿简报'), viewport.name + ': page title');
      const sourceNewsCount = await page.locator('#newsList .item').count();
      check(sourceNewsCount > 0, viewport.name + ': source news rendered', 'count=' + sourceNewsCount);
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
          const initialRankStateOk = initialOpacity < 0.1;
          check(initialRankStateOk, viewport.name + ': China AI rank is transparent before interaction on all devices', 'opacity=' + initialOpacity);
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
        const stories=[...(reportData?.top5||[]),...(reportData?.china_ai_news||[])];
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
        const initialRankStateOk = viewport.mobile ? initialOpacity <= 0.25 : initialOpacity < 0.1;
        check(initialRankStateOk, viewport.name + ': top-story rank is hidden on desktop and faint on touch devices before interaction', 'opacity=' + initialOpacity);
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
        await page.goto(base, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(500);
      }

      const firstCard = page.locator('#top5List .top5-card').first();
      const cardStyles = await firstCard.evaluate(el => ({ background: getComputedStyle(el).backgroundColor, text: getComputedStyle(el.querySelector('p')).color, title: getComputedStyle(el.querySelector('h3')).color }));
      check(cardStyles.background === 'rgb(255, 255, 255)', viewport.name + ': story card has solid light background', JSON.stringify(cardStyles));
      check(cardStyles.text === 'rgb(71, 85, 105)' && cardStyles.title === 'rgb(31, 41, 55)', viewport.name + ': story text uses the shared contrast tokens', JSON.stringify(cardStyles));
      const editorial = page.locator('#editorialCore');
      if (await editorial.count()) {
        const isVisible = await editorial.isVisible();
        const hasSynthesis = await page.evaluate(() => !!document.querySelector('#editorialCore strong'));
        if (!hasSynthesis) check(!isVisible, viewport.name + ': internal missing-analysis status is hidden from readers');
      }
      check(await page.locator('#featureTitle').innerText().then(x => x.trim().length > 0), viewport.name + ': lead feature has a headline');
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
            ratio:Number(worst.ratio.toFixed(2)),minimum,foreground:[Math.round(worst.foreground.r),Math.round(worst.foreground.g),Math.round(worst.foreground.b)].join(','),
            background:[Math.round(worst.background.r),Math.round(worst.background.g),Math.round(worst.background.b)].join(','),opacity:Number(opacity.toFixed(3))});
        }
        const failures=results.filter(x=>x.ratio+0.01<x.minimum);
        return {checked:results.length,failures:failures.slice(0,40),failureCount:failures.length,minimumRatio:results.length?Math.min(...results.map(x=>x.ratio)):null};
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
