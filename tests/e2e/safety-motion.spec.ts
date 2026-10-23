/**
 * /safety/의 네 장면짜리 움직이는 그림(SafetyMotion) E2E.
 * 한 장면씩 보이고 장면 버튼으로 옮기며, 일시정지할 수 있고, 진행 막대가 다 차면 다음 장면으로 넘어간다.
 * 움직임 줄이기를 켜면 장면 넷을 멈춘 그림 + 글로 차례로 보인다.
 */
import type { Locator } from '@playwright/test';
import { expect, test, type Page } from './test';

const locales = [
  {
    path: '/safety/',
    title: '그림으로 보기: 파일이 지나가는 길',
    scenes: [
      '한 페이지 안의 두 칸',
      '벽을 세우는 두 가지',
      '파일은 도구 칸 안에서만',
      '결과 파일은 곧장 내 기기로',
    ],
    names: ['두 칸', '막는 법', '처리', '받기'],
    pause: '일시정지',
    play: '재생',
    replay: '처음부터 다시 보기',
  },
  {
    path: '/en/safety/',
    title: 'See it step by step: where your file goes',
    scenes: [
      'Two areas on one page',
      'Two things build the wall',
      'Files stay inside the tool area',
      'The result goes straight to your device',
    ],
    names: ['Two areas', 'The seal', 'Processing', 'Download'],
    pause: 'Pause',
    play: 'Play',
    replay: 'Play again from the start',
  },
];

/** 장면 버튼(라디오 버튼의 이름표)을 누른다 */
async function pick(motion: Locator, name: string) {
  await motion.locator('label.seg').filter({ hasText: name }).click();
}

/** 지금 장면의 진행 막대를 끝까지 채운다 (장면 길이만큼 기다리지 않고 다음 장면으로) */
async function finishScene(page: Page) {
  await page.locator('[data-safety-motion] .seg.run .fill').evaluate((el) => {
    for (const animation of el.getAnimations()) animation.finish();
  });
}

for (const { path, title, scenes, names, pause, play, replay } of locales) {
  test(`${path} 움직이는 그림은 한 장면씩 보이고 장면을 옮기거나 멈출 수 있다`, async ({
    page,
  }) => {
    await page.goto(path);
    const motion = page.getByRole('region', { name: title });
    await motion.scrollIntoViewIfNeeded();

    // 첫 장면만 보이고, 보일 때 움직인다
    await expect(motion.getByRole('heading', { name: scenes[0] })).toBeVisible();
    for (const scene of scenes.slice(1)) {
      await expect(motion.getByRole('heading', { name: scene })).toBeHidden();
    }
    await expect(motion.locator('.scene.run')).toHaveCount(1);
    await expect(motion).not.toHaveClass(/paused/);
    const playButton = motion.getByRole('button', { name: pause });
    await expect(playButton).toBeVisible();

    // 장면 버튼으로 셋째 장면
    await pick(motion, names[2]);
    await expect(motion.getByRole('heading', { name: scenes[2] })).toBeVisible();
    await expect(motion.getByRole('heading', { name: scenes[0] })).toBeHidden();

    // 일시정지: 그림과 진행 막대가 멈춘다
    await playButton.click();
    await expect(motion).toHaveClass(/paused/);
    await expect(motion.getByRole('button', { name: play })).toBeVisible();
    const states = await motion
      .locator('#safety-scene-3')
      .evaluate((el) => el.getAnimations({ subtree: true }).map((a) => a.playState));
    expect(states.length).toBeGreaterThan(0);
    expect(states.every((state) => state === 'paused')).toBe(true);

    // 멈춘 채 다른 장면을 고르면 그 장면의 마지막 그림을 보인다
    await pick(motion, names[1]);
    await expect(motion.getByRole('heading', { name: scenes[1] })).toBeVisible();
    await expect(motion.locator('.scene.run')).toHaveCount(0);

    // 다시 재생하면 그 장면부터 움직인다
    await motion.getByRole('button', { name: play }).click();
    await expect(motion).not.toHaveClass(/paused/);
    await expect(motion.locator('#safety-scene-2')).toHaveClass(/run/);
    await expect(motion.getByRole('button', { name: pause })).toBeVisible();
  });

  test(`${path} 장면이 끝나면 다음 장면으로, 마지막 장면에서 멈춘다`, async ({ page }) => {
    await page.goto(path);
    const motion = page.getByRole('region', { name: title });
    await motion.scrollIntoViewIfNeeded();
    await expect(motion.locator('#safety-scene-1')).toHaveClass(/run/);

    await finishScene(page);
    await expect(motion.getByRole('radio', { name: names[1] })).toBeChecked();
    await expect(motion.getByRole('heading', { name: scenes[1] })).toBeVisible();

    await pick(motion, names[3]);
    await finishScene(page);
    await expect(motion.getByRole('button', { name: replay })).toBeVisible();
    await expect(motion.getByRole('heading', { name: scenes[3] })).toBeVisible();

    // 처음부터 다시
    await motion.getByRole('button', { name: replay }).click();
    await expect(motion.getByRole('radio', { name: names[0] })).toBeChecked();
    await expect(motion.locator('#safety-scene-1')).toHaveClass(/run/);
  });

  test(`${path} 움직임 줄이기에서는 장면 넷을 멈춘 그림과 글로 보인다`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(path);
    const motion = page.getByRole('region', { name: title });
    for (const scene of scenes) {
      await expect(motion.getByRole('heading', { name: scene })).toBeVisible();
    }
    // 장면 버튼은 쓰지 않는다
    await expect(motion.locator('[data-go]')).toHaveCount(4);
    for (const radio of await motion.locator('[data-go]').all()) await expect(radio).toBeHidden();
    await expect(motion.locator('[data-play]')).toBeHidden();
    const running = await motion.evaluate((el) => el.getAnimations({ subtree: true }).length);
    expect(running).toBe(0);
  });
}
