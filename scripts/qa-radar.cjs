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
        check(await page.locator('#chinaAINewsList .story-image img').count() === chinaCount, viewport.name + ': every China AI card shows a picture');
        check(await page.locator('#chinaAINewsList .story-image img[src^="https://"]').count() === chinaCount, viewport.name + ': every China AI picture uses an HTTPS image source');
        check(await page.locator('#chinaAINewsList .image-placeholder').count() === 0, viewport.name + ': no China AI card displays a no-image placeholder');
        check(await page.locator('#chinaAINewsList .china-story-source').count() === chinaCount, viewport.name + ': each China AI card shows source and publication metadata');
      } else {
        check((await page.locator('#chinaAINewsList').innerText()).length > 0, viewport.name + ': empty China AI state explains no qualifying stories');
      }
      const cards = page.locator('#top5List .top5-card');
      const count = await cards.count();
      check(count === 5, viewport.name + ': five story cards visible', 'count=' + count);
      check(await page.locator('#top5List .story-image img').count() === 5, viewport.name + ': all five stories show a picture');
      check(await page.locator('#top5List .story-image img[src^="https://"]').count() === 5, viewport.name + ': every story picture uses an HTTPS image source');
      check(await page.locator('#top5List .image-placeholder').count() === 0, viewport.name + ': no top story displays a no-image placeholder');
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
        check(!(await page.locator('#editorialCore').isVisible()), viewport.name + ': internal AI-unavailable note stays hidden');
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
