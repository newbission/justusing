/**
 * 도구 페이지 아래쪽 글 E2E. 모든 도구 페이지가 같은 틀만 보이지 않게, 도구마다 다른 글이 제자리에 있는지 본다.
 * 도구 목록은 사이트맵에서 읽는다 (레지스트리의 live 도구가 모두 실린다).
 */
import { expect, test } from './test';

/** 사이트맵에 실린 도구 페이지 주소 (예: /pdf/merge/, /en/pdf/merge/) */
async function toolPaths(request: import('@playwright/test').APIRequestContext) {
  const xml = await (await request.get('/sitemap.xml')).text();
  return (
    [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map((match) => new URL(match[1]!).pathname)
      // 도구 주소는 (언어 앞머리를 뺀 뒤) /<카테고리>/<이름>/ 두 단계다. 같은 모양의 가이드 글만 뺀다
      // (카테고리를 적어 두면 새 카테고리를 놓친다)
      .filter((path) => {
        const rest = path.replace(/^\/en(?=\/)/, '');
        return /^\/[^/]+\/[^/]+\/$/.test(rest) && !rest.startsWith('/guide/');
      })
  );
}

const COMMON_FIRST_QUESTION = {
  ko: '파일이 서버로 올라가나요?',
  en: 'Are my files uploaded to a server?',
};

test('모든 도구 페이지에 쓰임새 3개가 사용법 앞에 있고, FAQ는 도구 질문으로 시작한다', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const paths = await toolPaths(request);
  expect(paths.length).toBeGreaterThanOrEqual(2 * 27);

  for (const path of paths) {
    const locale = path.startsWith('/en/') ? 'en' : 'ko';
    await page.goto(path);
    const name = (await page.getByRole('heading', { level: 1 }).textContent())!.trim();
    const uses = page.getByRole('heading', {
      level: 2,
      name: locale === 'ko' ? `${name}, 이럴 때 쓰세요` : `When to use ${name}`,
    });
    await expect(uses, path).toBeVisible();
    await expect(page.locator('.uses h3'), path).toHaveCount(3);
    for (const text of await page.locator('.uses p').allTextContents()) {
      expect(text.trim().length, path).toBeGreaterThan(20);
    }

    // 쓰임새가 사용법보다 앞에 있다
    const howTo = page.locator('.how-to h2');
    const [usesBox, howToBox] = [await uses.boundingBox(), await howTo.boundingBox()];
    expect(usesBox!.y, path).toBeLessThan(howToBox!.y);

    const first = (await page.locator('.faq summary').first().textContent())!.trim();
    expect(first, path).not.toBe(COMMON_FIRST_QUESTION[locale]);
  }
});
