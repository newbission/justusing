/** 실제 용량 맞추기 도구로 홈 사진 결과를 만든다. 먼저 build + preview. */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const source = `${root}scripts/home/aloe.jpg`;
const out = `${root}src/assets/home/`;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL });
try {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.route(
    /googlesyndication|doubleclick|adtrafficquality|google-analytics|cloudflareinsights/,
    (route) => route.abort(),
  );
  await page.goto(`${process.env.BASE_URL ?? 'http://localhost:4322'}/image/target-size/`);
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles(source);
  await frame.getByText('100KB', { exact: true }).click();
  await frame.getByRole('button', { name: '용량 맞추기', exact: true }).click();
  await frame
    .getByText('완료: 1장 모두 100KB 이하입니다.', { exact: true })
    .waitFor({ timeout: 30000 });
  const pending = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드', exact: true }).click();
  const download = await pending;
  const result = await readFile(await download.path());
  const original = await readFile(source);
  if (result.length > 100000 || result.length >= original.length)
    throw new Error(
      `용량 맞추기 실패: ${original.length} → ${result.length}, ${download.suggestedFilename()}, header ${[...result.slice(0, 8)]}`,
    );
  // 화면용 견본만 축소한다. 표시하는 용량은 실제 원본·도구 결과의 바이트 수다.
  await sharp(original).resize({ width: 560 }).webp({ quality: 68 }).toFile(`${out}original.webp`);
  await sharp(result).resize({ width: 400 }).webp({ quality: 68 }).toFile(`${out}result.webp`);
  await writeFile(
    `${out}result.json`,
    JSON.stringify(
      { inputBytes: original.length, outputBytes: result.length, targetKB: 100 },
      null,
      2,
    ) + '\n',
  );
  await mkdir(`${root}.cache/home-refresh/`, { recursive: true });
  await copyFile(await download.path(), `${root}.cache/home-refresh/result.jpg`);
  console.log(`실제 도구 결과: ${original.length} → ${result.length} bytes. 홈 WebP 생성 완료.`);
} finally {
  await browser.close();
}
