import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ channel: 'chrome' });
const results = [];
try {
  for (const [locale, width, theme] of [['ko', 1280, 'light'], ['en', 1280, 'dark'], ['ko', 390, 'light'], ['en', 320, 'dark']]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, colorScheme: theme, reducedMotion: 'reduce' });
    await context.route(/googlesyndication|doubleclick|adtrafficquality|googletagservices|cloudflareinsights/, route => route.fulfill({ contentType: 'text/javascript', body: '' }));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    const response = await page.goto(`http://localhost:8862/${locale === 'en' ? 'en/' : ''}`, { waitUntil: 'networkidle' });
    assert.equal(response.status(), 200);
    await page.screenshot({ path: `.projectlens/evidence/home-reference/independent/final-independent-${locale}-${width}-${theme}-top.webp`, type: 'webp' });
    await page.locator('.home-value-story').screenshot({ path: `.projectlens/evidence/home-reference/independent/final-independent-${locale}-${width}-${theme}-story.webp`, type: 'webp' });
    const value = await page.evaluate(() => ({
      title: document.querySelector('h1').textContent,
      scrollWidth: document.documentElement.scrollWidth,
      notePadding: getComputedStyle(document.querySelector('.home-data-note')).padding,
      noteFont: getComputedStyle(document.querySelector('.home-data-note p')).fontSize,
      proofOutsideColor: getComputedStyle(document.querySelector('.proof-outside')).color,
      dataTextColor: getComputedStyle(document.querySelector('.home-data-note p')).color,
      steps: [...document.querySelectorAll('.proof-steps li')].map(element => element.textContent.trim()),
      caption: document.querySelector('.local-proof figcaption').textContent,
      sceneCount: document.querySelectorAll('.feature-demo').length,
    }));
    assert.ok(value.scrollWidth <= width);
    assert.equal(value.sceneCount, 4);
    assert.deepEqual(errors, []);
    results.push({ locale, width, theme, http: response.status(), errors, ...value });
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile('.projectlens/evidence/home-reference/independent/final-independent-render.json', JSON.stringify({ created: new Date().toISOString(), results }, null, 2));
}
console.log('4 targeted independent final render cases passed');
