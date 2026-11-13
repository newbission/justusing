import {chromium} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const path='.projectlens/home-reference-wireframes.html';
const old=execFileSync('git',['show','3eabcb72:'+path],{encoding:'utf8'});
const current=await readFile(path,'utf8');
const raw=/\b(?:GrayText|CanvasText|Canvas|ButtonFace)\b/;
assert.ok(raw.test(old),'기존기획HTML에서직접색지정을재현');
assert.ok(!raw.test(current),'수정본직접색지정없음');
assert.ok(current.includes('../src/styles/tokens.css'));
const browser=await chromium.launch({channel:'chrome'});
try{for(const colorScheme of ['light','dark']){
 const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(pathToFileURL(process.cwd()+'/'+path).href);
 const styles=await page.evaluate(()=>{const s=getComputedStyle(document.body);return{bg:s.backgroundColor,text:s.color,token:s.getPropertyValue('--color-bg'),sections:document.querySelectorAll('article').length};});
 assert.ok(styles.token.includes('light-dark'));assert.notEqual(styles.bg,'rgba(0, 0, 0, 0)');assert.equal(styles.sections,3);assert.deepEqual(errors,[]);
 await page.screenshot({path:`.projectlens/evidence/home-reference/wireframes-tokens-${colorScheme}.webp`,type:'webp',fullPage:true});
 console.log(colorScheme,JSON.stringify(styles));await context.close();
}}finally{await browser.close();}
console.log('기존직접색상재현/수정본공통토큰사용/두테마실제렌더3안통과');
