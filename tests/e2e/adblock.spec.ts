/**
 * 광고 스크립트와 광고 차단 안내 창 E2E.
 *
 * 광고 차단 상태는 광고 주소로 가는 요청을 끊어서 만든다 (차단 프로그램·차단 DNS와 같은 결과).
 * 안내 창은 어느 페이지에서나, 도구를 쓸 때마다 뜨지만 언제든 닫을 수 있고 하던 일을 막지 않는다.
 */
import { fileURLToPath } from 'node:url';
import { AD_HOSTS, expect, test, type Page } from './test';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));
const AD_SCRIPT = 'script[src*="googlesyndication"]';
const notice = (page: Page) => page.getByRole('dialog', { name: '광고 차단을 꺼 주세요' });

async function blockAds(page: Page) {
  await page.route(AD_HOSTS, (route) => route.abort());
}

test('광고 스크립트는 바깥 페이지에만 있고 도구 frame에는 없다', async ({ page }) => {
  await page.goto('/pdf/merge/');
  await expect(page.locator(AD_SCRIPT)).toHaveCount(1);
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').first().waitFor({ state: 'attached' });
  await expect(frame.locator(AD_SCRIPT)).toHaveCount(0);
  await expect(frame.locator('[data-adblock-notice]')).toHaveCount(0);
});

test('광고 차단이 없으면 안내 창이 뜨지 않는다', async ({ page }) => {
  await page.goto('/pdf/merge/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame
    .locator('input[type=file]')
    .first()
    .setInputFiles([fixture('three-pages.pdf')]);
  await expect(frame.getByText('합칠 PDF를 2개 이상 넣어 주세요.')).toBeVisible();
  // 미끼 칸 검사(0.5초)가 끝난 뒤에도 뜨지 않아야 한다
  await page.waitForTimeout(800);
  await expect(notice(page)).toBeHidden();
});

for (const path of ['/', '/pdf/', '/pdf/merge/', '/about/']) {
  test(`광고 차단이 켜져 있으면 ${path} 에서 안내 창이 뜬다`, async ({ page }) => {
    await blockAds(page);
    await page.goto(path);
    await expect(notice(page)).toBeVisible();
  });
}

test('안내 창은 ×, 닫기 버튼, Esc, 바깥 누르기로 닫는다', async ({ page }) => {
  await blockAds(page);
  const closers = [
    () => notice(page).getByRole('button', { name: '닫기' }).first().click(), // 오른쪽 위 ×
    () => notice(page).getByRole('button', { name: '닫기' }).last().click(),
    () => page.keyboard.press('Escape'),
    () => page.mouse.click(5, 5),
  ];
  for (const close of closers) {
    await page.goto('/');
    await expect(notice(page)).toBeVisible();
    await close();
    await expect(notice(page)).toBeHidden();
  }
});

test('도구를 쓸 때마다 다시 뜨고, 닫아도 하던 일은 그대로 된다', async ({ page }) => {
  await blockAds(page);
  await page.goto('/pdf/merge/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  const close = async () => {
    await expect(notice(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(notice(page)).toBeHidden();
  };
  await close(); // 페이지를 열 때

  await frame
    .locator('input[type=file]')
    .first()
    .setInputFiles([fixture('three-pages.pdf'), fixture('korean.pdf')]);
  await close(); // 파일을 고를 때

  await frame.getByRole('button', { name: 'PDF 합치기' }).click();
  await close(); // 실행할 때
  await expect(frame.getByRole('button', { name: '다운로드' })).toBeVisible();

  const download = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
  await close(); // 다운로드할 때
});

test('"껐어요, 새로 고침"은 페이지를 다시 열고, 광고가 받아지면 더는 뜨지 않는다', async ({
  page,
}) => {
  await blockAds(page);
  await page.goto('/');
  await expect(notice(page)).toBeVisible();

  // 광고 차단을 끈 것처럼 다시 받아지게 한다
  await page.unroute(AD_HOSTS);
  await page.route(AD_HOSTS, (route) =>
    route.fulfill({ contentType: 'text/javascript', body: '' }),
  );
  await notice(page).getByRole('button', { name: '껐어요, 새로 고침' }).click();
  await expect(page.locator(AD_SCRIPT)).toHaveCount(1);
  await page.waitForTimeout(800);
  await expect(notice(page)).toBeHidden();
});

test('도구 frame이 보내는 신호에는 내용이 없다', async ({ page }) => {
  await page.goto('/pdf/merge/');
  await page.evaluate(() => {
    const seen: unknown[] = [];
    (window as unknown as { seen: unknown[] }).seen = seen;
    addEventListener('message', (event) => {
      if (event.data?.type === 'activity') seen.push(event.data);
    });
  });
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame
    .locator('input[type=file]')
    .first()
    .setInputFiles([fixture('three-pages.pdf'), fixture('korean.pdf')]);
  await frame.getByRole('button', { name: 'PDF 합치기' }).click();
  await expect(frame.getByRole('button', { name: '다운로드' })).toBeVisible();

  const seen = await page.evaluate(() => (window as unknown as { seen: unknown[] }).seen);
  expect(seen.length).toBeGreaterThanOrEqual(2);
  for (const message of seen) expect(message).toEqual({ type: 'activity' });
});
