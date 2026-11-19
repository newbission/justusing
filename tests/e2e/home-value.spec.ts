/** 서비스 소개와 파일 보호 원리를 읽은 뒤 실제 결과를 둘러보는 홈. */
import { test, expect } from './test';

const locales = [
  {
    path: '/',
    choose: '무료 도구 보기',
    safety: '처리 방식 알아보기',
    prefix: '',
    scope: [/무료/, /앱 설치/, /가입/],
    noProcessingServer: /파일을 받아 처리하는 서버가 없/,
    localProcess: /파일을 고르는.*결과를 저장할.*내 기기/,
    receives: /도구를 실행하는 데 필요한 데이터/,
    staysOnDevice: /파일 내용과 이름은 서버로 보내지/,
    workspace: /내 파일을 다루는 공간/,
    outside: [/광고/, /사이트 개선.*방문 통계/, /파일 이름과 내용/, /읽을 수 없/],
    data: [/OCR|글자 인식/, /배경/, /모바일 데이터/, /용량/, /다시/],
  },
  {
    path: '/en/',
    choose: 'Explore free tools',
    safety: 'How it works',
    prefix: '/en',
    scope: [/free/i, /app/i, /account|sign.?up/i],
    noProcessingServer: /no server that processes your files/i,
    localProcess: /choosing a file.*saving the result.*on your device/i,
    receives: /what your browser needs to run the tool/i,
    staysOnDevice: /file (contents|names).*(names|contents).*server/i,
    workspace: /where your files are handled/i,
    outside: [
      /ads/i,
      /analytics to improve the site/i,
      /file (contents|names).*(names|contents)/i,
      /read/i,
    ],
    data: [/OCR|text recognition/i, /background/i, /mobile data/i, /size/i, /again/i],
  },
];

for (const locale of locales) {
  test(`${locale.path} 서비스와 처리 원리를 먼저 소개하고 사진과 GIF 결과를 보여준다`, async ({
    page,
  }) => {
    await page.goto(locale.path);
    const local = page.locator('.local-hero');
    for (const text of locale.scope) await expect(local).toContainText(text);
    await expect(local.getByRole('link')).toHaveCount(1);
    await expect(local.getByRole('heading', { level: 1 })).toBeVisible();

    const how = page.locator('.home-how');
    await expect(how.getByRole('heading')).toContainText(locale.noProcessingServer);
    const intro = how.locator('.how-intro p');
    await expect(intro).toHaveCount(2);
    await expect(intro.nth(0)).toContainText(locale.localProcess);
    await expect(intro.nth(1)).toContainText(locale.staysOnDevice);

    const proof = how.locator('.local-proof');
    await expect(proof).toBeVisible();
    await expect(proof.locator('.proof-source')).toBeVisible();
    await expect(proof.locator('.proof-source')).toContainText(locale.receives);
    const tool = proof.locator('.proof-device .proof-tool');
    await expect(tool).toContainText(locale.workspace);
    await expect(tool.locator('.proof-steps li')).toHaveCount(3);
    const outside = proof.locator('.proof-device .proof-tool ~ .proof-outside');
    await expect(outside).toBeVisible();
    for (const text of locale.outside) await expect(outside).toContainText(text);
    await expect(how.getByRole('link', { name: locale.safety })).toHaveAttribute(
      'href',
      `${locale.prefix}/safety/`,
    );

    const clip = page.locator('.home-video');
    await expect(clip.locator('video')).toHaveCount(1);
    await expect(clip.getByRole('link')).toHaveAttribute('href', `${locale.prefix}/video/to-gif/`);
    const dataNote = page.locator('.home-data-note');
    for (const text of locale.data) await expect(dataNote).toContainText(text);

    // 실제 화면의 읽기 순서와 각 내용의 구간 분리를 함께 확인한다.
    const sequence = [
      '.local-hero',
      '.home-how',
      '.home-data-note',
      '.feature-intro',
      '.home-video',
      '#examples',
      '#tools',
    ];
    const order = await page.evaluate((selectors) => {
      const regions = selectors.map((selector) => document.querySelector(selector));
      return regions.every((region, index) => {
        if (!region) return false;
        const next = regions[index + 1];
        return (
          index === regions.length - 1 ||
          (next &&
            !region.contains(next) &&
            Boolean(region.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING) &&
            region.getBoundingClientRect().top < next.getBoundingClientRect().top)
        );
      });
    }, sequence);
    expect(order, sequence.join(' → ')).toBe(true);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    const start = local.getByRole('link', { name: locale.choose });
    await start.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#directory-title')).toBeInViewport();
    const toolCount = await page.locator('#tools .card').count();
    await expect(local.locator('.story-scope')).toContainText(String(toolCount));
  });

  test(`${locale.path} 좁은 화면의 두 테마에서도 원리와 데이터 안내를 읽을 수 있다`, async ({
    page,
  }) => {
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      for (const colorScheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
        await page.goto(locale.path);
        for (const selector of [
          '.local-hero',
          '.feature-intro',
          '.local-proof',
          '.home-video',
          '.home-data-note',
        ]) {
          const section = page.locator(selector);
          await section.scrollIntoViewIfNeeded();
          await expect(section).toBeVisible();
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
          ).toBeLessThanOrEqual(width);
        }
        await expect(page.locator('.home-data-note')).toContainText(
          locale.prefix ? /mobile data/i : /모바일 데이터/,
        );
        await expect(page.locator('[data-proof-play]')).toBeHidden();
      }
    }
  });

  test(`${locale.path} 자바스크립트 없이도 차별점과 다운로드 안내가 남는다`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    try {
      // 실제 도구 실행 대신 정적 소개 자체의 대체 화면을 검증한다.
      await page.goto(new URL(locale.path, baseURL).href);
      await expect(page.locator('.local-hero h1')).toBeVisible();
      await expect(page.locator('.home-how .local-proof')).toBeVisible();
      await expect(page.locator('.proof-outside')).toBeVisible();
      await expect(page.locator('[data-proof-play]')).toBeHidden();
      await expect(page.locator('.home-video video')).toHaveAttribute('poster', /\.webp$/);
      await expect(page.locator('.story-scope')).toContainText(locale.prefix ? /free/i : /무료/);
      await expect(page.locator('.home-data-note')).toContainText(
        locale.prefix ? /mobile data/i : /모바일 데이터/,
      );
      await expect(
        page.locator('.local-hero').getByRole('link', { name: locale.choose }),
      ).toHaveAttribute('href', '#tools');
    } finally {
      await context.close();
    }
  });
}

test('GIF 결과 재생 전에는 포스터만 받고, 재생하면 같은 사이트의 짧은 영상을 받는다', async ({
  page,
}) => {
  const videoRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith('.mp4')) videoRequests.push(request.url());
  });
  await page.goto('/', { waitUntil: 'networkidle' });
  const video = page.locator('.home-video video');
  await video.scrollIntoViewIfNeeded();
  await expect(video).toBeInViewport();
  await expect(video).toHaveAttribute('preload', 'none');
  await expect(video).toHaveAttribute('poster', /\.webp$/);
  const initial = await video.evaluate((media: HTMLVideoElement) => ({
    active: !media.paused || media.autoplay || media.loop,
    controls: media.controls,
    inline: media.playsInline,
  }));
  expect(initial).toEqual({ active: false, controls: true, inline: true });
  expect(videoRequests).toEqual([]);

  // 브라우저별로 모습이 다른 기본 재생 버튼 대신 같은 미디어 동작을 직접 시작한다.
  await video.evaluate((media: HTMLVideoElement) => media.play());
  await expect
    .poll(() => video.evaluate((media: HTMLVideoElement) => media.currentTime))
    .toBeGreaterThan(0);
  const played = await video.evaluate((media: HTMLVideoElement) => {
    media.pause();
    return { src: media.currentSrc, width: media.videoWidth, height: media.videoHeight };
  });
  expect(new URL(played.src).origin).toBe(new URL(page.url()).origin);
  expect(videoRequests).toContain(played.src);
  expect({ width: played.width, height: played.height }).toEqual({ width: 480, height: 270 });
});

test('키보드로 재생하면 작업 공간 열기, 바깥 접근 차단, 파일 처리가 차례로 보인다', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/en/#how-title');
  const proof = page.locator('[data-local-proof]');
  const replay = page.locator('[data-proof-play]');
  const scene = () =>
    proof.evaluate((diagram) => {
      const shown = (selector: string) =>
        diagram.querySelector(selector)?.checkVisibility({
          opacityProperty: true,
          visibilityProperty: true,
        }) ?? false;
      return {
        stage: diagram.getAttribute('data-stage'),
        files: shown('.proof-tool .proof-steps'),
        barrier: shown('.proof-tool ~ .proof-attempt'),
      };
    });
  const idle = { stage: null, files: true, barrier: false };
  await replay.scrollIntoViewIfNeeded();
  await expect(replay).toBeVisible();
  expect(await scene()).toEqual(idle);

  await replay.press('Enter');
  await expect.poll(scene).toEqual({ stage: 'open', files: false, barrier: false });
  await expect.poll(scene).toEqual({ stage: 'blocked', files: false, barrier: true });
  await expect(proof.locator('.proof-attempt')).toBeInViewport({ ratio: 1 });
  await expect.poll(scene).toEqual({ stage: 'files', files: true, barrier: true });
  await expect.poll(scene).toEqual(idle);

  await replay.press('Enter');
  await expect.poll(scene).toEqual({ stage: 'open', files: false, barrier: false });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(replay).toBeHidden();
  await expect.poll(scene).toEqual(idle);
});
