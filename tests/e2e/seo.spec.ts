/**
 * 검색엔진용 구조화 데이터 E2E. 화면에 보이는 내용과 어긋나면 검색엔진이 잘못된 정보로 본다.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from './test';

interface JsonLd {
  '@type': string;
  [key: string]: unknown;
}

async function jsonLd(page: Page): Promise<JsonLd[]> {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  return blocks.map((text) => JSON.parse(text) as JsonLd);
}

test('홈에 사이트 정보가 있다', async ({ page }) => {
  await page.goto('/');
  const site = (await jsonLd(page)).find((data) => data['@type'] === 'WebSite');
  expect(site?.name).toBe('justusing');
});

test('도구 페이지의 FAQ 데이터가 화면의 질문과 같다', async ({ page }) => {
  await page.goto('/pdf/merge/');
  const faq = (await jsonLd(page)).find((data) => data['@type'] === 'FAQPage');
  const questions = (faq?.mainEntity as { name: string }[]).map((item) => item.name);
  const shown = await page.locator('.faq summary').allTextContents();
  expect(questions).toEqual(shown.map((text) => text.trim()));
  expect(questions.length).toBeGreaterThan(2);
});

test('도구 페이지에 무료 웹 도구 정보가 있고 제목과 이름이 같다', async ({ page }) => {
  await page.goto('/pdf/merge/');
  const app = (await jsonLd(page)).find((data) => data['@type'] === 'WebApplication');
  expect(app?.name).toBe(await page.getByRole('heading', { level: 1 }).textContent());
  expect(app?.isAccessibleForFree).toBe(true);
  expect(app?.url).toMatch(/\/pdf\/merge\/$/);
});

test('구조화 데이터가 문서 틀(<html>) 안에 있고 페이지가 표준 방식으로 그려진다', async ({
  page,
  request,
}) => {
  for (const path of ['/', '/pdf/merge/']) {
    const html = await (await request.get(path)).text();
    expect(html.indexOf('<html'), path).toBeLessThan(html.indexOf('application/ld+json'));
    await page.goto(path);
    expect(await page.evaluate(() => document.compatMode), path).toBe('CSS1Compat');
  }
});

test('사이트맵의 고친 날은 가이드 머리말 날짜이고, git 기록이 잘렸으면 도구 날짜를 적지 않는다', async ({
  request,
}) => {
  const sitemap = await (await request.get('/sitemap.xml')).text();
  const entries = new Map(
    [...sitemap.matchAll(/<loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?/g)].map((match) => [
      new URL(match[1]!).pathname,
      match[2],
    ]),
  );

  // 가이드: 한국어 글 머리말의 updated, 없으면 published (두 언어 주소 모두)
  const folder = fileURLToPath(new URL('../../src/content/guides/ko/', import.meta.url));
  const files = readdirSync(folder).filter((name) => name.endsWith('.md'));
  expect(files.length).toBeGreaterThan(0);
  for (const file of files) {
    const head = readFileSync(`${folder}${file}`, 'utf8');
    const date = (head.match(/^updated: (\S+)/m) ?? head.match(/^published: (\S+)/m))![1];
    const slug = file.replace(/\.md$/, '');
    expect(entries.get(`/guide/${slug}/`), slug).toBe(date);
    expect(entries.get(`/en/guide/${slug}/`), slug).toBe(date);
  }

  // 도구: git 기록이 다 있으면 날짜(YYYY-MM-DD), 얕은 clone(CI 등)이면 적지 않는다
  const shallow =
    execFileSync('git', ['rev-parse', '--is-shallow-repository'], { encoding: 'utf8' }).trim() ===
    'true';
  const tool = entries.get('/pdf/merge/');
  if (shallow) expect(tool).toBeUndefined();
  else expect(tool).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  // 날짜를 확실히 모르는 페이지(홈 등)에는 적지 않는다
  expect(entries.get('/')).toBeUndefined();
});
