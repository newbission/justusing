/** 구현과 별도로 검증하는 대표 동작: 멈춤·움직임 줄이기·좁은 화면·PDF 결과의 의미. */
import { expect, test } from './test';

for (const prefix of ['', '/en']) {
  test(`${prefix || '/'} 처음 보일 때 재생하고 키보드 일시정지는 실제로 멈춘다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 600 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(`${prefix}/`);
    const scenes = page.locator('.feature-demo');
    await expect(scenes).toHaveCount(4);
    for (const scene of await scenes.all()) {
      await expect(scene.locator('.demo-stage')).not.toBeInViewport();
      await expect(scene).toHaveAttribute('data-playback', 'idle');
      expect(
        await scene.evaluate(
          (el) =>
            el
              .getAnimations({ subtree: true })
              .filter((animation) => animation.playState === 'running').length,
        ),
      ).toBe(0);
    }

    const scene = scenes.filter({ has: page.locator('[data-motion-control]') }).first();
    const control = scene.locator('[data-motion-control]');
    await scene.locator('.demo-stage').evaluate((el) => {
      const box = el.getBoundingClientRect();
      window.scrollTo(0, window.scrollY + box.top - window.innerHeight + box.height * 0.4);
    });
    await expect(scene.locator('.demo-stage')).toBeInViewport({ ratio: 0.35 });
    await expect(scene).toHaveAttribute('data-playback', 'idle');
    await scene.locator('.demo-stage').scrollIntoViewIfNeeded();
    await expect(scene).toHaveAttribute('data-playback', 'playing');
    await expect
      .poll(() =>
        scene.evaluate(
          (el) =>
            el
              .getAnimations({ subtree: true })
              .filter((animation) => animation.playState === 'running').length,
        ),
      )
      .toBeGreaterThan(0);
    await control.focus();
    await page.keyboard.press('Enter');
    await expect(scene).toHaveAttribute('data-playback', 'paused');
    // WebKit의 CSS pause는 다음 프레임에서 확정된다. pending pause가 끝난 뒤 두 시점을 견준다.
    await scene.evaluate(async (el) => {
      await Promise.all(el.getAnimations({ subtree: true }).map((animation) => animation.ready));
    });
    const pausedTimes = await scene.evaluate((el) =>
      el.getAnimations({ subtree: true }).map((animation) => ({
        state: animation.playState,
        time: animation.currentTime,
      })),
    );
    expect(pausedTimes.length).toBeGreaterThan(0);
    expect(pausedTimes.every((animation) => animation.state !== 'running')).toBe(true);
    // 두 렌더링 시점 사이에도 시간이 흐르지 않아야 한다. 상태 문자열만 바뀌는 구현은 통과하지 못한다.
    await page.waitForTimeout(200);
    expect(
      await scene.evaluate((el) =>
        el.getAnimations({ subtree: true }).map((animation) => ({
          state: animation.playState,
          time: animation.currentTime,
        })),
      ),
    ).toEqual(pausedTimes);
    await page.keyboard.press('Enter');
    await expect(scene).toHaveAttribute('data-playback', 'playing');
    await expect(scene).toHaveAttribute('data-playback', 'done', { timeout: 7000 });
    const replayName = await control.getAttribute('aria-label');
    expect(replayName || (await control.innerText())).toMatch(prefix ? /again|replay/i : /다시/);
    await page.keyboard.press('Enter');
    await expect(scene).toHaveAttribute('data-playback', 'playing');
  });

  test(`${prefix || '/'} 네 장면은 각각 첫 노출에 한 번만 재생하고 다시 스크롤해도 반복하지 않는다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 600 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(`${prefix}/`);
    const scenes = page.locator('.feature-demo');
    for (const scene of await scenes.all()) {
      await expect(scene).toHaveAttribute('data-playback', 'idle');
      await scene.locator('.demo-stage').scrollIntoViewIfNeeded();
      await expect(scene).toHaveAttribute('data-playback', 'playing');
      await expect(page.locator('.feature-demo[data-playback="playing"]')).toHaveCount(1);
      // CSS 타이밍의 끝으로 이동해 animationend를 일으킨다. 노출·재진입 판단은 실제 스크롤로 확인한다.
      await scene.evaluate(async (el) => {
        const animations = el.getAnimations({ subtree: true });
        await Promise.all(animations.map((animation) => animation.ready));
        for (const animation of animations) animation.finish();
      });
      await expect(scene).toHaveAttribute('data-playback', 'done');
    }
    await page.locator('.local-hero').scrollIntoViewIfNeeded();
    for (const scene of await scenes.all()) {
      await scene.locator('.demo-stage').scrollIntoViewIfNeeded();
      await expect(scene).toHaveAttribute('data-playback', 'done');
      expect(
        await scene.evaluate(
          (el) =>
            el
              .getAnimations({ subtree: true })
              .filter((animation) => animation.playState === 'running').length,
        ),
      ).toBe(0);
    }
    const last = scenes.last();
    await last.locator('[data-motion-control]').click();
    await expect(last).toHaveAttribute('data-playback', 'playing');
  });

  test(`${prefix || '/'} 움직임 줄이기에서도 사진 여러 장의 결과가 PDF 한 파일임을 알 수 있다`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${prefix}/`);
    const scenes = page.locator('.feature-demo');
    await expect(scenes).toHaveCount(4);
    for (const scene of await scenes.all()) {
      await scene.scrollIntoViewIfNeeded();
      await expect(scene.locator('[data-motion-control]')).toBeHidden();
      expect(await scene.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
      await expect(scene.locator('.demo-stage')).toHaveAttribute('aria-label', /.+/);
    }
    const album = page.locator('[data-demo="album"]');
    const document = album.locator('.pdf-viewer');
    await expect(document).toHaveCount(1);
    await expect(document).toBeVisible();
    await expect(document.locator('.pdf-page')).toHaveCount(3);
    await expect(document).toContainText('PDF');
    await expect(document).toContainText(prefix ? /3\s*pages/i : /3\s*쪽/);
    await expect(album.locator('.demo-stage')).toHaveAttribute(
      'aria-label',
      prefix ? /one PDF|single PDF|1 PDF/i : /하나의 PDF|PDF 한|PDF 1/,
    );
  });

  test(`${prefix || '/'} 수동 정지를 자동 노출이 덮어쓰지 않고 한 장면씩만 움직인다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 600 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(`${prefix}/`);
    const album = page.locator('[data-demo="album"]');
    const cutout = page.locator('[data-demo="cutout"]');
    const albumControl = album.locator('[data-motion-control]');
    await expect(albumControl).toBeVisible();
    // 보조기술처럼 스크롤 없이 버튼을 활성화한 뒤 멈춘다. 이후 첫 노출이 이 선택을 덮어쓰면 안 된다.
    await albumControl.evaluate((button: HTMLButtonElement) => button.click());
    await expect(album).toHaveAttribute('data-playback', 'playing');
    await albumControl.evaluate((button: HTMLButtonElement) => button.click());
    await expect(album).toHaveAttribute('data-playback', 'paused');
    await album.locator('.demo-stage').scrollIntoViewIfNeeded();
    await expect(album).toHaveAttribute('data-playback', 'paused');
    await albumControl.click();
    await expect(album).toHaveAttribute('data-playback', 'playing');

    // 두 번째 장면의 자동 재생은 사용자가 재개한 첫 장면을 가로채지 않고 기다린다.
    await cutout.locator('.demo-stage').scrollIntoViewIfNeeded();
    await expect(cutout).toHaveAttribute('data-playback', 'idle');
    await expect(album).toHaveAttribute('data-playback', 'playing');
    await expect(album).toHaveAttribute('data-playback', 'done', { timeout: 7000 });
    await expect(cutout).toHaveAttribute('data-playback', 'playing');

    await albumControl.click();
    await expect(album).toHaveAttribute('data-playback', 'playing');
    await expect(cutout).toHaveAttribute('data-playback', 'paused');
    await cutout.locator('[data-motion-control]').click();
    await expect(cutout).toHaveAttribute('data-playback', 'playing');
    await expect(album).toHaveAttribute('data-playback', 'paused');
    await albumControl.click();
    await expect(album).toHaveAttribute('data-playback', 'playing');
    await expect(cutout).toHaveAttribute('data-playback', 'paused');
    await expect(page.locator('.feature-demo[data-playback="playing"]')).toHaveCount(1);
  });

  test(`${prefix || '/'} 320px 화면 두 테마에서 핵심 장면과 시작 링크가 잘리지 않는다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto(`${prefix}/`);
      for (const scene of await page.locator('.feature-demo').all()) {
        await scene.scrollIntoViewIfNeeded();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          320,
        );
        const stage = (await scene.locator('.demo-stage').boundingBox())!;
        expect(stage.x).toBeGreaterThanOrEqual(0);
        expect(stage.x + stage.width).toBeLessThanOrEqual(320);
        const link = scene.getByRole('link');
        await link.focus();
        await expect(link).toBeFocused();
        await expect(link).toBeInViewport();
        const button = (await link.boundingBox())!;
        expect(button.x).toBeGreaterThanOrEqual(0);
        expect(button.x + button.width).toBeLessThanOrEqual(320);
      }
    }
  });

  test.describe(`${prefix || '/'} 자바스크립트 없이`, () => {
    test.use({ javaScriptEnabled: false });

    test('정적 입력과 결과가 남고 작동하지 않는 재생 버튼은 숨긴다', async ({ page }) => {
      await page.goto(`${prefix}/`);
      const scenes = page.locator('.feature-demo');
      await expect(scenes).toHaveCount(4);
      for (const scene of await scenes.all()) {
        await scene.scrollIntoViewIfNeeded();
        await expect(scene.locator('.demo-stage')).toBeVisible();
        await expect(scene.locator('[data-motion-control]')).toBeHidden();
        await expect(scene.getByRole('link')).toBeVisible();
      }
      await expect(page.locator('[data-demo="album"] .pdf-viewer')).toContainText('PDF');
    });
  });
}
