/** 홈 대표 기능: 실제 도구의 결과를 받아 화면용 전후 이미지를 만든다. build + preview 필요. */
import { chromium } from 'playwright';
import { PDFDocument } from '@cantoo/pdf-lib';
import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../../', import.meta.url));
const work = `${root}.cache/home-showcase`;
const out = `${root}src/assets/home/showcase`;
const base = process.env.BASE_URL ?? 'http://localhost:4322';
await mkdir(`${work}/raw`, { recursive: true });
await mkdir(out, { recursive: true });
const source = (name) => `${root}scripts/home/${name}.jpg`;
const raw = (name) => `${work}/raw/${name}`;
const names = ['aloe', 'flowers', 'coast'];
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL });
const page = await browser.newPage({ acceptDownloads: true });
await page.route(/googlesyndication|doubleclick|adtrafficquality|cloudflareinsights/, (route) =>
  route.abort(),
);
const manifest = {};
const frame = page.frameLocator('iframe[data-tool-frame]');
async function open(path, files) {
  await page.goto(`${base}/${path}/`);
  await frame.locator('input[type=file]').first().setInputFiles(files);
}
async function save(button, name) {
  const pending = page.waitForEvent('download');
  await frame.getByRole('button', { name: button, exact: true }).click();
  const file = await pending;
  await file.saveAs(raw(name));
  console.log(`실제 도구 결과: ${name}`);
  return readFile(raw(name));
}
try {
  await open('image/remove-bg', source('aloe'));
  const get = frame.getByRole('button', { name: /^데이터 받기/ });
  const done = frame.getByText('사진 가운데의 물체를 남겼습니다.', { exact: false });
  await get.or(done).first().waitFor();
  if (await get.isVisible()) await get.click();
  await done.waitFor({ timeout: 90000 });
  await save('PNG 다운로드', 'cutout.png');
  const cutout = await sharp(raw('cutout.png')).stats();
  if (cutout.isOpaque) throw new Error('투명한 배경이 만들어지지 않았습니다.');
  manifest.cutout = { tool: 'image/remove-bg', transparent: true };

  await open('image/crop', source('coast'));
  await frame.getByText('1:1', { exact: true }).click();
  await save('자른 이미지 받기', 'crop.jpg');
  const crop = await sharp(raw('crop.jpg')).metadata();
  if (crop.width !== crop.height) throw new Error('정사각형 자르기 결과가 아닙니다.');
  manifest.crop = { tool: 'image/crop', width: crop.width, height: crop.height };

  // 하나의 풍경을 세 조각으로 나눈 견본을 실제 가로 이어 붙이기로 다시 잇는다.
  const coast = await sharp(source('coast')).metadata();
  const partWidth = Math.floor(coast.width / 3);
  for (let i = 0; i < 3; i++)
    await sharp(source('coast'))
      .extract({ left: i * partWidth, top: 0, width: partWidth, height: coast.height })
      .jpeg({ quality: 90 })
      .toFile(raw(`part-${i}.jpg`));
  await open(
    'image/stitch',
    [0, 1, 2].map((i) => raw(`part-${i}.jpg`)),
  );
  await frame.getByText('가로로 (옆으로)', { exact: true }).click();
  await frame.getByRole('button', { name: '이어 붙이기', exact: true }).click();
  await save('다운로드', 'stitch.jpg');
  const stitched = await sharp(raw('stitch.jpg')).metadata();
  if (stitched.width !== partWidth * 3 || stitched.height !== coast.height)
    throw new Error('이은 사진 크기가 다릅니다.');
  manifest.stitch = {
    tool: 'image/stitch',
    inputs: 3,
    width: stitched.width,
    height: stitched.height,
  };

  await open('pdf/from-image', names.map(source));
  await frame.getByRole('button', { name: 'PDF 만들기', exact: true }).click();
  const photoPdf = await save('다운로드', 'photos.pdf');
  const photoPages = (await PDFDocument.load(photoPdf)).getPageCount();
  if (photoPages !== names.length) throw new Error('사진 PDF 쪽 수가 다릅니다.');
  manifest.photos = { tool: 'pdf/from-image', pages: photoPages };

  for (const lang of ['ko', 'en']) {
    const report = `${root}public/samples/${lang}/${lang === 'ko' ? '예시-보고서.pdf' : 'sample-report.pdf'}`;
    const appendix = `${root}public/samples/${lang}/${lang === 'ko' ? '예시-부록.pdf' : 'sample-appendix.pdf'}`;
    // 처리 UI는 한국어로 유지하고, 견본 문서만 언어별로 바꾼다.
    await open('pdf/merge', [report, appendix]);
    await frame.getByRole('button', { name: 'PDF 합치기', exact: true }).click();
    const merged = await save('다운로드', `merge-${lang}.pdf`);
    const inputPages =
      (await PDFDocument.load(await readFile(report))).getPageCount() +
      (await PDFDocument.load(await readFile(appendix))).getPageCount();
    if ((await PDFDocument.load(merged)).getPageCount() !== inputPages)
      throw new Error('합친 PDF 쪽 수가 다릅니다.');
    manifest.merge = { tool: 'pdf/merge', files: 2, pages: inputPages };

    await open('pdf/redact', report);
    const words =
      lang === 'ko'
        ? ['010-0000-0000', '000000-0000000', '000-00-000000']
        : ['000-000-0000', '000-00-0000', '0000-0000-0000'];
    for (const word of words) {
      await frame.getByLabel('찾아서 가리기').fill(word);
      await frame.getByRole('button', { name: '모두 찾아 가리기', exact: true }).click();
    }
    await frame.getByRole('button', { name: '가리고 저장', exact: true }).click();
    await save('다운로드', `redact-${lang}.pdf`);
    manifest.redact = { tool: 'pdf/redact', searchTerms: words.length };
  }
} finally {
  await browser.close();
}

// 실제 PDF 쪽을 이미지로 렌더링하고, 가린 글자가 결과 PDF에서 검색되지 않는지도 확인한다.
execFileSync(
  process.env.HOME_PREVIEW_PYTHON ?? `${root}.cache/home-refresh/font-env/bin/python`,
  [`${root}scripts/home/render-showcase-pdfs.py`],
  { cwd: root, stdio: 'inherit' },
);
await writeFile(`${out}/results.json`, JSON.stringify(manifest, null, 2) + '\n');
