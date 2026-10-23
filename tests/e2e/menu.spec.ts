/**
 * 머리글 메뉴 E2E. 데스크톱 펼침 메뉴(MegaMenu)와 휴대폰 메뉴(MobileMenu)가 열리고 닫히고,
 * 키보드로 쓸 수 있고, 모든 도구·가이드로 이어지는지 확인한다.
 */
import { expect, test, type Page } from './test';

const nav = (page: Page) => page.getByRole('navigation', { name: '도구 분류' });
const trigger = (page: Page, name: string) => nav(page).getByRole('button', { name, exact: true });

test('PDF 버튼을 누르면 묶음별 도구 판이 열리고 도구로 간다', async ({ page }) => {
  await page.goto('/');
  const button = trigger(page, 'PDF');
  await expect(button).toHaveAttribute('aria-expanded', 'false');
  await button.click();
  await expect(button).toHaveAttribute('aria-expanded', 'true');

  const panel = page.locator('#mega-pdf');
  await expect(panel).toBeVisible();
  // 묶음 순서대로 칸을 나눈다 (categories.ts의 sections)
  await expect(panel.locator('.group-title')).toHaveText([
    '보기·추출',
    '페이지 정리',
    '편집',
    '변환',
    '최적화',
    '보안',
  ]);
  // 도구마다 아이콘·이름·짧은 설명
  const merge = panel.getByRole('link', { name: /^PDF 합치기/ });
  await expect(merge).toContainText('여러 PDF를 원하는 순서로 하나로 합칩니다');
  await expect(merge.locator('svg.tool-icon')).toHaveCount(1);
  await expect(panel.getByRole('link', { name: 'PDF 도구 전체 보기' })).toHaveAttribute(
    'href',
    '/pdf/',
  );

  await merge.click();
  await expect(page).toHaveURL(/\/pdf\/merge\/$/);
  // 지금 페이지는 메뉴에 표시된다
  await trigger(page, 'PDF').click();
  await expect(page.locator('#mega-pdf a[aria-current="page"]')).toHaveAttribute(
    'href',
    '/pdf/merge/',
  );
});

test('판에는 카테고리의 모든 도구가 짧은 설명과 함께 있다', async ({ page }) => {
  for (const category of ['pdf', 'image']) {
    await page.goto(`/${category}/`);
    const cards = await page
      .locator('main .card')
      .evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute('href')));
    const items = page.locator(`#mega-${category} .item`);
    const hrefs = await items.evaluateAll((anchors) =>
      anchors.map((anchor) => anchor.getAttribute('href')),
    );
    expect(hrefs.sort()).toEqual(cards.sort());
    await expect(items.locator('.item-summary')).toHaveCount(hrefs.length);
  }
});

test('키보드로 열고, Tab으로 판 안을 지나고, Esc로 닫으면 버튼으로 돌아간다', async ({ page }) => {
  await page.goto('/');
  const button = trigger(page, 'PDF');
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#mega-pdf')).toBeVisible();

  await page.keyboard.press('Tab');
  await expect(page.locator('#mega-pdf').getByRole('link', { name: /^PDF 보기/ })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(page.locator('#mega-pdf')).toBeHidden();
  await expect(button).toHaveAttribute('aria-expanded', 'false');
  await expect(button).toBeFocused();
});

test('Tab으로 판 밖으로 나가면 닫힌다', async ({ page }) => {
  await page.goto('/');
  await trigger(page, '이미지').focus();
  await page.keyboard.press('Enter');
  const links = page.locator('#mega-image a');
  const count = await links.count();
  for (let i = 0; i < count; i++) await page.keyboard.press('Tab');
  await expect(links.last()).toBeFocused();
  // 다음 메뉴 버튼(가이드)으로 넘어가면 이미지 판은 닫힌다
  await page.keyboard.press('Tab');
  await expect(trigger(page, '가이드')).toBeFocused();
  await expect(page.locator('#mega-image')).toBeHidden();
});

test('마우스를 올리면 잠깐 뒤 열리고, 떠나면 닫힌다. 바깥을 누르면 닫힌다', async ({ page }) => {
  await page.goto('/');
  const button = trigger(page, '이미지');
  await button.hover();
  await expect(page.locator('#mega-image')).toBeVisible();
  // 다른 버튼으로 옮기면 바로 바뀐다
  await trigger(page, '가이드').hover();
  await expect(page.locator('#mega-guide')).toBeVisible();
  await expect(page.locator('#mega-image')).toBeHidden();
  // 판 위로 내려가도 닫히지 않는다
  await page.locator('#mega-guide').getByRole('link', { name: '가이드 전체 보기' }).hover();
  await expect(page.locator('#mega-guide')).toBeVisible();
  // 메뉴를 떠나면 닫힌다
  await page.mouse.move(5, 700);
  await expect(page.locator('#mega-guide')).toBeHidden();

  // 눌러서 연 판은 마우스가 떠나도 남고, 바깥을 누르면 닫힌다
  await trigger(page, 'PDF').click();
  await page.mouse.move(5, 700);
  await page.waitForTimeout(400);
  await expect(page.locator('#mega-pdf')).toBeVisible();
  await page.mouse.click(5, 700);
  await expect(page.locator('#mega-pdf')).toBeHidden();
});

test('가이드 판은 PDF·이미지 가이드로 나뉘고 카테고리 가이드 페이지로 간다', async ({ page }) => {
  await page.goto('/');
  await trigger(page, '가이드').click();
  const panel = page.locator('#mega-guide');
  await expect(panel.locator('.group-title')).toHaveText(['PDF 가이드', '이미지 가이드']);
  await expect(panel.getByRole('link', { name: '가이드 전체 보기' })).toHaveAttribute(
    'href',
    '/guide/',
  );
  await panel.getByRole('link', { name: '이미지 가이드' }).click();
  await expect(page).toHaveURL(/\/guide\/image\/$/);
});

test('영어 페이지의 메뉴는 영어로 쓰여 있고 영어 주소로 간다', async ({ page }) => {
  await page.goto('/en/');
  const english = page.getByRole('navigation', { name: 'Tool categories' });
  await english.getByRole('button', { name: 'Image', exact: true }).click();
  const link = page.locator('#mega-image').getByRole('link', { name: /^Compress Image/ });
  await expect(link).toContainText('Make JPG, PNG and WebP files smaller');
  await expect(link).toHaveAttribute('href', '/en/image/compress/');
  await english.getByRole('button', { name: 'Guides', exact: true }).click();
  await expect(
    page.locator('#mega-guide').getByRole('link', { name: 'See all guides' }),
  ).toHaveAttribute('href', '/en/guide/');
});

test.describe('휴대폰', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('☰ 버튼으로 전체 화면 메뉴를 열고, 카테고리를 펼쳐 도구로 간다', async ({ page }) => {
    await page.goto('/pdf/merge/');
    // 넓은 화면용 펼침 메뉴는 숨는다
    await expect(trigger(page, 'PDF')).toBeHidden();

    const open = page.getByRole('button', { name: '메뉴 열기' });
    await open.click();
    const dialog = page.getByRole('dialog', { name: '메뉴' });
    await expect(dialog).toBeVisible();
    // 맨 위 층(top layer)이라 하단 고정 광고보다 위에 뜨고, 화면 전체를 덮는다
    expect(await dialog.evaluate((node) => node.matches(':modal'))).toBe(true);
    const box = (await dialog.boundingBox())!;
    expect(box.width).toBe(390);
    expect(box.height).toBe(844);

    // 지금 페이지의 카테고리가 펼쳐져 있다
    await expect(dialog.getByRole('link', { name: 'PDF 합치기' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    // 다른 카테고리를 펼치면 앞의 것은 닫힌다
    await dialog.getByText('이미지', { exact: true }).click();
    await expect(dialog.getByRole('link', { name: 'PDF 합치기' })).toBeHidden();
    await dialog.getByRole('link', { name: '이미지 압축' }).click();
    await expect(page).toHaveURL(/\/image\/compress\/$/);
  });

  test('Esc나 닫기 버튼으로 닫으면 ☰ 버튼으로 돌아간다', async ({ page }) => {
    await page.goto('/');
    const open = page.getByRole('button', { name: '메뉴 열기' });
    const dialog = page.getByRole('dialog', { name: '메뉴' });

    await open.click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(open).toBeFocused();

    await open.click();
    await dialog.getByRole('button', { name: '메뉴 닫기' }).click();
    await expect(dialog).toBeHidden();
    await expect(open).toBeFocused();
  });

  test('가이드를 펼치면 카테고리 가이드 페이지와 가이드 목록으로 간다', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '메뉴 열기' }).click();
    const dialog = page.getByRole('dialog', { name: '메뉴' });
    await dialog.getByText('가이드', { exact: true }).click();
    await expect(dialog.getByRole('link', { name: '가이드 전체 보기' })).toHaveAttribute(
      'href',
      '/guide/',
    );
    await dialog.getByRole('link', { name: 'PDF 가이드' }).click();
    await expect(page).toHaveURL(/\/guide\/pdf\/$/);
  });
});
