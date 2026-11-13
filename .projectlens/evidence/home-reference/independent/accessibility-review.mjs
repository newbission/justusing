import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome'});
const results=[];
try {
for(const locale of ['ko','en']) for(const width of [1280,390,320]) for(const theme of ['light','dark']) {
 const context=await browser.newContext({viewport:{width,height:844},colorScheme:theme,reducedMotion:'reduce'});
 await context.route(/googlesyndication|doubleclick|adtrafficquality|googletagservices|cloudflareinsights/,r=>r.fulfill({contentType:'text/javascript',body:''}));
 const page=await context.newPage();await page.goto('http://localhost:8862'+(locale==='en'?'/en/':'/'),{waitUntil:'networkidle'});
 const data=await page.evaluate(()=>{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');
  const parse=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].map((v,i)=>i===3?v/255:v);};
  const over=(top,bottom)=>{const a=top[3]+bottom[3]*(1-top[3]);return [...[0,1,2].map(i=>(top[i]*top[3]+bottom[i]*bottom[3]*(1-top[3]))/a),a];};
  const lum=c=>c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  return [...document.querySelectorAll('.home-value-story *')].filter(el=>!el.closest('[aria-hidden="true"]')&&[...el.childNodes].some(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim())).map(el=>{
   const cs=getComputedStyle(el);const b=el.getBoundingClientRect();if(!b.width||cs.display==='none'||cs.visibility==='hidden')return null;
   const parents=[];for(let at=el;at;at=at.parentElement)parents.unshift(at);let bg=[255,255,255,1];for(const p of parents)bg=over(parse(getComputedStyle(p).backgroundColor),bg);
   const fg=over(parse(cs.color),bg),l=[lum(fg),lum(bg)].sort((a,b)=>b-a),ratio=(l[0]+.05)/(l[1]+.05),size=parseFloat(cs.fontSize),weight=parseInt(cs.fontWeight),required=size>=24||(size>=18.66&&weight>=700)?3:4.5;
   return {text:el.textContent.trim(),size,ratio,required,color:cs.color,bg,tag:el.tagName};
  }).filter(Boolean);
 });
 assert.ok(data.every(x=>x.ratio+.03>=x.required),JSON.stringify({locale,width,theme,failures:data.filter(x=>x.ratio+.03<x.required)}));
 const links=page.locator('.story-copy a');const focus=[];
 for(const link of await links.all()){
  await link.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');
  const item=await link.evaluate(el=>{const cs=getComputedStyle(el),b=el.getBoundingClientRect();return {name:el.textContent.trim(),focused:document.activeElement===el,outline:cs.outlineStyle,outlineWidth:cs.outlineWidth,width:b.width,height:b.height,href:el.getAttribute('href')};});
  assert.ok(item.focused,item.name+' focus');assert.notEqual(item.outline,'none',item.name+' focus outline');assert.ok(item.height>=24,item.name+' target height');focus.push(item);
 }
 const note=await page.locator('.home-data-note').evaluate(el=>{const cs=getComputedStyle(el);return {padding:cs.padding,font:getComputedStyle(el.querySelector('h2')).fontSize,body:getComputedStyle(el.querySelector('p')).fontSize}});
 assert.ok(parseFloat(note.padding)>=16);assert.equal(note.body,'14px');
 results.push({locale,width,theme,text:data,focus,note});await context.close();
}
}finally{await browser.close();await writeFile('.projectlens/evidence/home-reference/independent/accessibility-review.json',JSON.stringify({created:new Date().toISOString(),results},null,2));}
console.log(`${results.length} accessibility cases passed; contrast, keyboard focus, target size and download note readability`);
