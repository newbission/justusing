/**
 * 가이드 그림의 재료: 견본 파일(public/samples)을 빌드한 사이트의 실제 도구에 넣고 결과 파일을 받아 둔다.
 * 그림은 render.py가 이 결과로 그린다. "우리 도구로 만든 실제 결과"만 쓰려고 도구를 직접 돌린다.
 *
 *   npm run build && npm run preview   (다른 창에서, http://localhost:4322)
 *   PLAYWRIGHT_CHANNEL=chrome node scripts/guide-images/run-tools.mjs
 *   python3 scripts/guide-images/render.py
 *
 * 결과는 .cache/guide-images/<언어>/에 둔다 (커밋하지 않는다).
 */
import { chromium } from 'playwright';
import { mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const BASE = process.env.BASE_URL ?? 'http://localhost:4322';
const SAMPLES = {
  ko: { report: '예시-보고서.pdf', photos: '예시-사진모음.pdf' },
  en: { report: 'sample-report.pdf', photos: 'sample-photos.pdf' },
};

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL });
const page = await browser.newPage({ acceptDownloads: true });
const frame = page.frameLocator('iframe[data-tool-frame]');

async function open(path, file) {
  await page.goto(BASE + path);
  await frame.locator('input[type=file]').setInputFiles(file);
}

async function save(button, target) {
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: button }).click();
  await copyFile(await (await event).path(), target);
}

for (const [locale, names] of Object.entries(SAMPLES)) {
  const out = `${ROOT}.cache/guide-images/${locale}/`;
  await mkdir(out, { recursive: true });
  const sample = (key) => `${ROOT}public/samples/${locale}/${names[key]}`;

  // 모아찍기: 2·4쪽 (견본이 4쪽이라 6·9쪽은 칸만 빈다)
  for (const count of [2, 4]) {
    await open('/pdf/n-up/', sample('report'));
    await frame
      .getByRole('radiogroup', { name: '한 장에 넣을 쪽 수' })
      .getByText(`${count}쪽`)
      .click();
    await frame.getByRole('button', { name: '모아찍기' }).click();
    await save('다운로드', `${out}n-up-${count}.pdf`);
  }

  // 압축: 세 단계
  for (const [level, label] of [
    ['light', '조금 (화질 우선)'],
    ['balanced', '보통 (추천)'],
    ['strong', '많이 (용량 우선)'],
  ]) {
    await open('/pdf/compress/', sample('photos'));
    await frame.getByText(label).click();
    await frame.getByRole('button', { name: '압축하기' }).click();
    await save('다운로드', `${out}compress-${level}.pdf`);
  }

  // 가리기: 4쪽의 연락처·주민번호·계좌를 찾아 가린다
  await open('/pdf/redact/', sample('report'));
  const words =
    locale === 'ko'
      ? ['010-0000-0000', '000000-0000000', '000-00-000000']
      : ['000-000-0000', '000-00-0000', '0000-0000-0000'];
  for (const word of words) {
    await frame.getByLabel('찾아서 가리기').fill(word);
    await frame.getByRole('button', { name: '모두 찾아 가리기' }).click();
  }
  await frame.getByRole('button', { name: '가리고 저장' }).click();
  await save('다운로드', `${out}redact.pdf`);
  console.log(`${locale}: 완료`);
}

await browser.close();
