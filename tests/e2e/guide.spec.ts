/**
 * 가이드 E2E. 목록·글·도구 페이지가 서로 이어지고, 두 언어판과 사이트맵이 맞는지 확인한다.
 */
import { expect, test } from './test';

test('머리글의 가이드에서 목록으로 가고, 글을 열어 도구로 간다', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: '도구 분류' });
  await nav.getByRole('button', { name: '가이드', exact: true }).click();
  await nav.getByRole('link', { name: '가이드 전체 보기' }).click();
  await expect(page).toHaveURL(/\/guide\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('가이드');

  await page.getByRole('link', { name: /PDF 용량 줄이는 방법/ }).click();
  await expect(page).toHaveURL(/\/guide\/compress-pdf\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'PDF 용량 줄이는 방법 (업로드 없이)',
  );
  await page.getByRole('link', { name: 'PDF 압축 열기' }).click();
  await expect(page).toHaveURL(/\/pdf\/compress\/$/);
});

test('도구 페이지에 그 도구의 가이드가 이어진다', async ({ page }) => {
  await page.goto('/image/resize/');
  const guides = page.locator('section.guides');
  await guides.getByRole('link', { name: '이미지 크기(픽셀) 바꾸는 방법' }).click();
  await expect(page).toHaveURL(/\/guide\/resize-image\/$/);
});

test('영어 가이드는 영어로 쓰여 있고 영어 도구로 이어진다', async ({ page }) => {
  await page.goto('/en/guide/sign-pdf/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'How to sign a PDF (no printer needed)',
  );
  await expect(page.getByRole('link', { name: 'Open Sign PDF' })).toHaveAttribute(
    'href',
    '/en/pdf/sign/',
  );
  // 글 안의 링크도 영어 페이지로 간다
  const links = await page
    .locator('article a')
    .evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute('href')));
  expect(links.length).toBeGreaterThan(0);
  for (const href of links) expect(href).toMatch(/^\/en\//);
});

test('가이드 글에 글 정보가 있고 날짜가 화면과 같다', async ({ page }) => {
  await page.goto('/guide/merge-pdf/');
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  const article = blocks
    .map((text) => JSON.parse(text) as Record<string, string>)
    .find((data) => data['@type'] === 'Article');
  expect(article?.headline).toBe(await page.getByRole('heading', { level: 1 }).textContent());
  expect(article?.datePublished).toMatch(/^2026-10-15/);
  // 고친 글은 고친 날을 보인다
  expect(article?.dateModified).toMatch(/^2026-10-19/);
  await expect(page.getByText('2026년 10월 19일 고침')).toBeVisible();
});

test('모든 가이드가 두 언어로 사이트맵에 있다', async ({ request, page }) => {
  await page.goto('/guide/');
  const hrefs = await page
    .locator('.guides a')
    .evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute('href')!));
  expect(hrefs.length).toBeGreaterThanOrEqual(6);
  const sitemap = await (await request.get('/sitemap.xml')).text();
  for (const href of ['/guide/', ...hrefs]) {
    expect(sitemap).toContain(`${href}</loc>`);
    expect(sitemap).toContain(`/en${href}</loc>`);
  }
});

test('가이드 그림은 설명(alt)과 크기가 있고 실제로 열린다', async ({ page }) => {
  await page.goto('/guide/');
  const hrefs = await page
    .locator('.guides a')
    .evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute('href')!));
  let total = 0;
  for (const href of [...hrefs, ...hrefs.map((href) => `/en${href}`)]) {
    await page.goto(href);
    const images = await page.locator('.doc img').all();
    total += images.length;
    for (const image of images) {
      // 화면 읽기용 설명이 있고, 크기를 적어 그림이 늦게 떠도 글이 밀리지 않는다
      await expect(image, href).toHaveAttribute('alt', /.{10,}/);
      await expect(image, href).toHaveAttribute('width', /^\d+$/);
      await expect(image, href).toHaveAttribute('height', /^\d+$/);
      await image.scrollIntoViewIfNeeded();
      await expect
        .poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth), {
          message: href,
        })
        .toBeGreaterThan(0);
    }
  }
  // 시범으로 그림을 넣은 4편 (나누기·모아찍기·압축·가리기) × 두 언어
  expect(total).toBeGreaterThanOrEqual(8);
});

// 움직이는 그림이 있는 가이드: [글 주소, 그림 이름]
const MOTION_GUIDES = [
  ['stitch-screenshots', 'stitched'],
  ['crop-rotate-photo', 'straightened'],
] as const;

for (const prefix of ['', '/en']) {
  for (const [slug, name] of MOTION_GUIDES) {
    const locale = prefix ? 'en' : 'ko';
    test(`${locale} ${slug} 가이드 그림은 움직이고, 움직임 줄이기를 켜면 멈춘 그림이다`, async ({
      page,
      request,
    }) => {
      const motionUrl = `/guide-motion/${locale}/${slug}/${name}.webp`;
      const stillUrl = `/guide-motion/${locale}/${slug}/${name}-still.webp`;
      const image = page.locator('.doc picture img');
      const currentSrc = () => image.evaluate((node: HTMLImageElement) => node.currentSrc);
      const naturalSize = () =>
        image.evaluate((node: HTMLImageElement) => [node.naturalWidth, node.naturalHeight]);

      // 움직임을 줄이지 않았을 때: 움직이는 그림을 그린다
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.goto(`${prefix}/guide/${slug}/`);
      await image.scrollIntoViewIfNeeded();
      await expect.poll(currentSrc).toContain(motionUrl);
      await expect.poll(async () => (await naturalSize())[0]).toBeGreaterThan(0);

      // 움직임 줄이기: 멈춘 그림
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.reload();
      await image.scrollIntoViewIfNeeded();
      await expect.poll(currentSrc).toContain(stillUrl);
      await expect.poll(async () => (await naturalSize())[0]).toBeGreaterThan(0);

      // 멈춘 그림 크기가 적어 둔 width/height와 같아 글이 밀리지 않는다
      const width = Number(await image.getAttribute('width'));
      const height = Number(await image.getAttribute('height'));
      expect(await naturalSize()).toEqual([width, height]);
      const still = await (await request.get(stillUrl)).body();
      expect(still.length).toBeLessThan(150 * 1024);

      // 움직이는 파일은 정말 애니메이션이고 크기가 같으며, 한 편에 몇백 KB 이하다
      const bytes = await (await request.get(motionUrl)).body();
      expect(bytes.subarray(0, 4).toString()).toBe('RIFF');
      expect(bytes.subarray(8, 12).toString()).toBe('WEBP');
      expect(bytes.subarray(12, 16).toString()).toBe('VP8X');
      expect(bytes[20]! & 0x02, '애니메이션 표시').toBe(0x02);
      expect(1 + bytes.readUIntLE(24, 3)).toBe(width);
      expect(1 + bytes.readUIntLE(27, 3)).toBe(height);
      expect(bytes.toString('latin1').split('ANMF').length - 1, '프레임 수').toBeGreaterThanOrEqual(
        10,
      );
      expect(bytes.length).toBeLessThan(500 * 1024);
    });
  }
}

test('가이드 목록은 카테고리별로 나뉘고 카테고리 가이드 페이지로 간다', async ({ page }) => {
  await page.goto('/guide/');
  await expect(page.locator('main h2')).toHaveText([
    'PDF 가이드',
    '이미지 가이드',
    '텍스트·CSV 가이드',
    '동영상 가이드',
  ]);
  await page.getByRole('link', { name: '이미지 가이드 묶음별로 보기' }).click();
  await expect(page).toHaveURL(/\/guide\/image\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('이미지 가이드');
});

test('카테고리 가이드 페이지는 그 카테고리 가이드를 도구 묶음별로 보인다', async ({ page }) => {
  await page.goto('/guide/pdf/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('PDF 가이드');
  // 묶음 소제목은 categories.ts 순서다 (가이드 없는 묶음은 빠진다)
  await expect(page.locator('main h2')).toHaveText([
    '보기·추출',
    '페이지 정리',
    '편집',
    '변환',
    '최적화',
    '보안',
  ]);
  const optimize = page.locator('section', { has: page.getByRole('heading', { name: '최적화' }) });
  await expect(optimize.getByRole('link', { name: /PDF 용량 줄이는 방법/ })).toHaveAttribute(
    'href',
    '/guide/compress-pdf/',
  );
  // 이미지 가이드는 없다
  await expect(page.getByRole('link', { name: /이미지 크기\(픽셀\) 바꾸는 방법/ })).toHaveCount(0);
  // 위치 표시: 홈 › 가이드 › PDF 가이드
  const breadcrumb = page.getByRole('navigation', { name: '현재 위치' });
  await expect(breadcrumb.getByRole('listitem')).toHaveText(['홈', '가이드', 'PDF 가이드']);

  // 영어판
  await page.goto('/en/guide/image/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Image guides');
  const links = await page
    .locator('.guides a')
    .evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute('href')));
  expect(links.length).toBeGreaterThan(0);
  for (const href of links) expect(href).toMatch(/^\/en\/guide\//);
});

test('가이드 글의 위치 표시가 카테고리 가이드를 거친다', async ({ page }) => {
  await page.goto('/guide/resize-image/');
  const breadcrumb = page.getByRole('navigation', { name: '현재 위치' });
  await breadcrumb.getByRole('link', { name: '이미지 가이드' }).click();
  await expect(page).toHaveURL(/\/guide\/image\/$/);
});

test('카테고리 가이드 페이지가 두 언어로 사이트맵에 있다', async ({ request }) => {
  const sitemap = await (await request.get('/sitemap.xml')).text();
  for (const path of ['/guide/pdf/', '/guide/image/']) {
    expect(sitemap).toContain(`${path}</loc>`);
    expect(sitemap).toContain(`/en${path}</loc>`);
  }
});
