# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: home-motion-review.spec.ts >> / 자바스크립트 없이 >> 정적 입력과 결과가 남고 작동하지 않는 재생 버튼은 숨긴다
- Location: tests/e2e/home-motion-review.spec.ts:212:5

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('.feature-demo')
Expected: 4
Received: 0
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" locator('.feature-demo') with timeout 5000ms
  - waiting for locator('.feature-demo')
    14 × locator resolved to 0 elements
       - unexpected value "0"

```

# Test source

```ts
  115 |     await expect(last).toHaveAttribute('data-playback', 'playing');
  116 |   });
  117 | 
  118 |   test(`${prefix || '/'} 움직임 줄이기에서도 사진 여러 장의 결과가 PDF 한 파일임을 알 수 있다`, async ({
  119 |     page,
  120 |   }) => {
  121 |     await page.emulateMedia({ reducedMotion: 'reduce' });
  122 |     await page.goto(`${prefix}/`);
  123 |     const scenes = page.locator('.feature-demo');
  124 |     await expect(scenes).toHaveCount(4);
  125 |     for (const scene of await scenes.all()) {
  126 |       await scene.scrollIntoViewIfNeeded();
  127 |       await expect(scene.locator('[data-motion-control]')).toBeHidden();
  128 |       expect(await scene.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
  129 |       await expect(scene.locator('.demo-stage')).toHaveAttribute('aria-label', /.+/);
  130 |     }
  131 |     const album = page.locator('[data-demo="album"]');
  132 |     const document = album.locator('.pdf-viewer');
  133 |     await expect(document).toHaveCount(1);
  134 |     await expect(document).toBeVisible();
  135 |     await expect(document.locator('.pdf-page')).toHaveCount(3);
  136 |     await expect(document).toContainText('PDF');
  137 |     await expect(document).toContainText(prefix ? /3\s*pages/i : /3\s*쪽/);
  138 |     await expect(album.locator('.demo-stage')).toHaveAttribute(
  139 |       'aria-label',
  140 |       prefix ? /one PDF|single PDF|1 PDF/i : /하나의 PDF|PDF 한|PDF 1/,
  141 |     );
  142 |   });
  143 | 
  144 |   test(`${prefix || '/'} 수동 정지를 자동 노출이 덮어쓰지 않고 한 장면씩만 움직인다`, async ({
  145 |     page,
  146 |   }) => {
  147 |     await page.setViewportSize({ width: 390, height: 600 });
  148 |     await page.emulateMedia({ reducedMotion: 'no-preference' });
  149 |     await page.goto(`${prefix}/`);
  150 |     const album = page.locator('[data-demo="album"]');
  151 |     const cutout = page.locator('[data-demo="cutout"]');
  152 |     const albumControl = album.locator('[data-motion-control]');
  153 |     await expect(albumControl).toBeVisible();
  154 |     // 보조기술처럼 스크롤 없이 버튼을 활성화한 뒤 멈춘다. 이후 첫 노출이 이 선택을 덮어쓰면 안 된다.
  155 |     await albumControl.evaluate((button: HTMLButtonElement) => button.click());
  156 |     await expect(album).toHaveAttribute('data-playback', 'playing');
  157 |     await albumControl.evaluate((button: HTMLButtonElement) => button.click());
  158 |     await expect(album).toHaveAttribute('data-playback', 'paused');
  159 |     await album.locator('.demo-stage').scrollIntoViewIfNeeded();
  160 |     await expect(album).toHaveAttribute('data-playback', 'paused');
  161 |     await albumControl.click();
  162 |     await expect(album).toHaveAttribute('data-playback', 'playing');
  163 | 
  164 |     // 두 번째 장면의 자동 재생은 사용자가 재개한 첫 장면을 가로채지 않고 기다린다.
  165 |     await cutout.locator('.demo-stage').scrollIntoViewIfNeeded();
  166 |     await expect(cutout).toHaveAttribute('data-playback', 'idle');
  167 |     await expect(album).toHaveAttribute('data-playback', 'playing');
  168 |     await expect(album).toHaveAttribute('data-playback', 'done', { timeout: 7000 });
  169 |     await expect(cutout).toHaveAttribute('data-playback', 'playing');
  170 | 
  171 |     await albumControl.click();
  172 |     await expect(album).toHaveAttribute('data-playback', 'playing');
  173 |     await expect(cutout).toHaveAttribute('data-playback', 'paused');
  174 |     await cutout.locator('[data-motion-control]').click();
  175 |     await expect(cutout).toHaveAttribute('data-playback', 'playing');
  176 |     await expect(album).toHaveAttribute('data-playback', 'paused');
  177 |     await albumControl.click();
  178 |     await expect(album).toHaveAttribute('data-playback', 'playing');
  179 |     await expect(cutout).toHaveAttribute('data-playback', 'paused');
  180 |     await expect(page.locator('.feature-demo[data-playback="playing"]')).toHaveCount(1);
  181 |   });
  182 | 
  183 |   test(`${prefix || '/'} 320px 화면 두 테마에서 핵심 장면과 시작 링크가 잘리지 않는다`, async ({
  184 |     page,
  185 |   }) => {
  186 |     await page.setViewportSize({ width: 320, height: 740 });
  187 |     for (const colorScheme of ['light', 'dark'] as const) {
  188 |       await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
  189 |       await page.goto(`${prefix}/`);
  190 |       for (const scene of await page.locator('.feature-demo').all()) {
  191 |         await scene.scrollIntoViewIfNeeded();
  192 |         expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
  193 |           320,
  194 |         );
  195 |         const stage = (await scene.locator('.demo-stage').boundingBox())!;
  196 |         expect(stage.x).toBeGreaterThanOrEqual(0);
  197 |         expect(stage.x + stage.width).toBeLessThanOrEqual(320);
  198 |         const link = scene.getByRole('link');
  199 |         await link.focus();
  200 |         await expect(link).toBeFocused();
  201 |         await expect(link).toBeInViewport();
  202 |         const button = (await link.boundingBox())!;
  203 |         expect(button.x).toBeGreaterThanOrEqual(0);
  204 |         expect(button.x + button.width).toBeLessThanOrEqual(320);
  205 |       }
  206 |     }
  207 |   });
  208 | 
  209 |   test.describe(`${prefix || '/'} 자바스크립트 없이`, () => {
  210 |     test.use({ javaScriptEnabled: false });
  211 | 
  212 |     test('정적 입력과 결과가 남고 작동하지 않는 재생 버튼은 숨긴다', async ({ page }) => {
  213 |       await page.goto(`${prefix}/`);
  214 |       const scenes = page.locator('.feature-demo');
> 215 |       await expect(scenes).toHaveCount(4);
      |                            ^ Error: expect(locator).toHaveCount(expected) failed
  216 |       for (const scene of await scenes.all()) {
  217 |         await scene.scrollIntoViewIfNeeded();
  218 |         await expect(scene.locator('.demo-stage')).toBeVisible();
  219 |         await expect(scene.locator('[data-motion-control]')).toBeHidden();
  220 |         await expect(scene.getByRole('link')).toBeVisible();
  221 |       }
  222 |       await expect(page.locator('[data-demo="album"] .pdf-viewer')).toContainText('PDF');
  223 |     });
  224 |   });
  225 | }
  226 | 
```