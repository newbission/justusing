import { chromium, webkit } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const base = process.env.REVIEW_BASE ?? 'http://localhost:8862';
const out = '.projectlens/evidence/home-reference/independent';
await mkdir(out, {recursive:true});
const engine = process.env.REVIEW_ENGINE ?? 'chromium';
const browser = await (engine === 'webkit' ? webkit : chromium).launch(engine === 'webkit' ? {} : {channel:'chrome'});
const results = [];
try {
  for (const language of ['ko','en']) for (const width of [1280,390,320]) for (const theme of ['light','dark']) for (const mode of ['normal','reduced','nojs']) {
    const key = `${engine}-${language}-${width}-${theme}-${mode}`;
    const context = await browser.newContext({viewport:{width,height:844},colorScheme:theme,reducedMotion:mode === 'reduced' ? 'reduce' : 'no-preference',javaScriptEnabled:mode !== 'nojs'});
    await context.route(/googlesyndication|doubleclick|adtrafficquality|googletagservices|cloudflareinsights/, route=>route.fulfill({contentType:'text/javascript',body:''}));
    const page = await context.newPage();
    const errors=[], csp=[], requests=[];
    page.on('pageerror', e=>errors.push(String(e)));
    page.on('console', m=> {if(m.text().startsWith('[independent-csp]')) csp.push(m.text())});
    page.on('request', r=>requests.push(r.url()));
    await page.addInitScript(()=>addEventListener('securitypolicyviolation', e=>console.debug('[independent-csp]'+JSON.stringify({directive:e.effectiveDirective,blocked:e.blockedURI}))));
    const response=await page.goto(base+(language === 'en'?'/en/':'/'),{waitUntil:'networkidle'});
    assert.equal(response.status(),200,key);
    await page.screenshot({path:`${out}/${key}-top.webp`,type:'webp'});
    await page.locator('.home-value-story').screenshot({path:`${out}/${key}-story.webp`,type:'webp'});
    const details=await page.evaluate(()=> {
      const text=[...document.querySelectorAll('.home-value-story *')].filter(el=>[...el.childNodes].some(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim())).map(el=> {
        const cs=getComputedStyle(el),b=el.getBoundingClientRect();
        return {tag:el.tagName,text:el.textContent.trim(),size:parseFloat(cs.fontSize),weight:cs.fontWeight,color:cs.color,width:b.width,left:b.left,right:b.right,hidden:cs.display==='none'||cs.visibility==='hidden'};
      }).filter(el=>!el.hidden&&el.width>0);
      const primary=document.querySelector('.local-hero .primary').getBoundingClientRect();
      return {scrollWidth:document.documentElement.scrollWidth,h1:document.querySelectorAll('h1').length,primary:{top:primary.top,bottom:primary.bottom,width:primary.width,height:primary.height},text,theme:getComputedStyle(document.documentElement).colorScheme};
    });
    assert.ok(details.scrollWidth<=width,`${key} overflow ${details.scrollWidth}`);
    assert.equal(details.h1,1,key);
    assert.ok(details.primary.bottom<=844,`${key} primary below first viewport`);
    assert.ok(details.text.every(el=>el.size>=12),`${key} unreadably small story text`);
    assert.ok(details.text.every(el=>el.left>=-1&&el.right<=width+1),`${key} story text beyond viewport`);
    assert.deepEqual(errors,[],key+' page errors');
    assert.deepEqual(csp,[],key+' CSP violations');
    const heavy=requests.filter(url=>new URL(url).origin===new URL(base).origin&&/\/(data|vendor)\/|\.worker-|\/pdf\.[\w-]+\.js/.test(url));
    assert.deepEqual(heavy,[],key+' unexpected heavy files');
    if(mode!=='normal') {
      assert.equal(await page.locator('[data-motion-control]:visible').count(),0,key+' controls without motion');
    }
    results.push({key,status:'pass',errors,csp,heavy,...details});
    await context.close();
  }
} finally {
 await browser.close();
 await writeFile(`${out}/${engine}-render-review.json`,JSON.stringify({base,created:new Date().toISOString(),results},null,2));
}
console.log(`${results.length} render cases passed (${engine}); screenshots and metrics in ${out}`);
