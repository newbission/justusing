/**
 * 가이드 그림의 재료: 견본 파일(public/samples)을 빌드한 사이트의 실제 도구에 넣고 결과 파일을 받아 둔다.
 * 그림은 render.py가 이 결과로 그린다. "우리 도구로 만든 실제 결과"만 쓰려고 도구를 직접 돌린다.
 *
 *   npm run build && npm run preview   (다른 창에서, http://localhost:4322)
 *   PLAYWRIGHT_CHANNEL=chrome node scripts/guide-images/run-tools.mjs [작업 이름…]
 *   python3 scripts/guide-images/render.py
 *
 * 작업 이름을 적으면 그 작업만 다시 돌린다 (예: watermark ocr). 도구 화면은 한국어판을 쓰고,
 * 영어 그림은 영어 견본과 영어 글자로 만든다.
 * 결과는 .cache/guide-images/<언어>/에 둔다 (커밋하지 않는다).
 */
import { chromium } from 'playwright';
import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const BASE = process.env.BASE_URL ?? 'http://localhost:4322';
const SAMPLES = {
  ko: {
    report: '예시-보고서.pdf',
    appendix: '예시-부록.pdf',
    photos: '예시-사진모음.pdf',
    scan: '예시-스캔본.pdf',
    form: '예시-신청서.pdf',
    docPhoto1: '예시-서류사진1.jpg',
    docPhoto2: '예시-서류사진2.jpg',
    photo: '예시-사진.jpg',
    located: '예시-위치사진.jpg',
    screen: '예시-화면캡처.png',
    chat1: '예시-대화캡처1.png',
    chat2: '예시-대화캡처2.png',
    chat3: '예시-대화캡처3.png',
    tilted: '예시-기운사진.jpg',
    car: '예시-번호판사진.jpg',
    product: '예시-상품사진.jpg',
    utf8Csv: '예시-주문목록-UTF8.csv',
    heic: '예시-아이폰사진2.heic',
  },
  en: {
    report: 'sample-report.pdf',
    appendix: 'sample-appendix.pdf',
    photos: 'sample-photos.pdf',
    scan: 'sample-scan.pdf',
    form: 'sample-form.pdf',
    docPhoto1: 'sample-document-photo-1.jpg',
    docPhoto2: 'sample-document-photo-2.jpg',
    photo: 'sample-photo.jpg',
    located: 'sample-photo-with-location.jpg',
    screen: 'sample-screenshot.png',
    chat1: 'sample-chat-1.png',
    chat2: 'sample-chat-2.png',
    chat3: 'sample-chat-3.png',
    tilted: 'sample-tilted-photo.jpg',
    car: 'sample-license-plate.jpg',
    product: 'sample-product-photo.jpg',
    utf8Csv: 'sample-orders-utf8.csv',
    heic: 'sample-iphone-photo-2.heic',
  },
};
/** 결과에 들어가는 글자 (그림의 언어에 맞춘다) */
const WORDS = {
  ko: {
    watermark: '대외비',
    header: '예시상사 · 3분기 업무 보고서',
    form: {
      name: '홍길동',
      phone: '010-0000-0000',
      date: '2026-10-20',
      memo: '주차권이 필요합니다.',
    },
    redact: ['010-0000-0000', '000000-0000000', '000-00-000000'],
  },
  en: {
    watermark: 'CONFIDENTIAL',
    header: 'Example Co. · Q3 Team Report',
    form: {
      name: 'Alex Doe',
      phone: '000-000-0000',
      date: '2026-10-20',
      memo: 'I need a parking pass.',
    },
    redact: ['000-000-0000', '000-00-0000', '0000-0000-0000'],
  },
};

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL });
// 글꼴·OCR 데이터는 바깥 페이지 보관소에 남아 언어를 바꿔도 다시 받지 않는다
const page = await browser.newPage({
  acceptDownloads: true,
  viewport: { width: 1280, height: 1000 },
});
const frame = page.frameLocator('iframe[data-tool-frame]');

async function open(path, files) {
  await page.goto(BASE + path);
  await frame.locator('input[type=file]').first().setInputFiles(files);
}

async function save(button, target) {
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: button, exact: true }).click();
  await copyFile(await (await event).path(), target);
}

/** 기본 고딕을 처음이면 받고, 받아 둔 것이면 저절로 골라진 것을 기다린다 */
async function font() {
  const get = frame.getByRole('button', { name: '기본 고딕 받기' });
  const ready = frame.getByText('받음');
  await get.or(ready).first().waitFor();
  if (await get.isVisible()) await get.click();
  await ready.first().waitFor();
}

/** 쪽 위의 비율 자리(0~1)를 화면 좌표로 */
async function at(selector, x, y) {
  const box = await frame.locator(selector).first().boundingBox();
  return { x: box.x + box.width * x, y: box.y + box.height * y };
}

async function drag(selector, from, to) {
  const a = await at(selector, ...from);
  const b = await at(selector, ...to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
}

async function press(locator, key, times) {
  for (let i = 0; i < times; i++) await locator.press(key);
}

const JOBS = {
  // 모아찍기: 2·4쪽 (견본이 4쪽이라 6·9쪽은 칸만 빈다)
  async 'n-up'({ sample, out }) {
    for (const count of [2, 4]) {
      await open('/pdf/n-up/', sample('report'));
      await frame
        .getByRole('radiogroup', { name: '한 장에 넣을 쪽 수' })
        .getByText(`${count}쪽`)
        .click();
      await frame.getByRole('button', { name: '모아찍기' }).click();
      await save('다운로드', `${out}n-up-${count}.pdf`);
    }
  },

  // PDF 압축: 세 단계
  async compress({ sample, out }) {
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
  },

  // 가리기: 4쪽의 연락처·주민번호·계좌를 찾아 가린다
  async redact({ sample, out, words }) {
    await open('/pdf/redact/', sample('report'));
    for (const word of words.redact) {
      await frame.getByLabel('찾아서 가리기').fill(word);
      await frame.getByRole('button', { name: '모두 찾아 가리기' }).click();
    }
    await frame.getByRole('button', { name: '가리고 저장' }).click();
    await save('다운로드', `${out}redact.pdf`);
  },

  // 합치기: 보고서 4쪽 + 부록 2쪽
  async merge({ sample, out }) {
    await open('/pdf/merge/', [sample('report'), sample('appendix')]);
    await frame.getByRole('button', { name: 'PDF 합치기' }).click();
    await save('다운로드', `${out}merge.pdf`);
  },

  // 워터마크: 가운데 하나·쪽 전체에 반복
  async watermark({ sample, out, words }) {
    for (const [layout, label] of [
      ['center', '가운데 하나'],
      ['tile', '쪽 전체에 반복'],
    ]) {
      await open('/pdf/watermark/', sample('report'));
      await font();
      await frame.getByLabel('넣을 글자').fill(words.watermark);
      await frame.getByText(label, { exact: true }).click();
      await frame.getByRole('button', { name: '워터마크 넣기' }).click();
      await save('다운로드', `${out}watermark-${layout}.pdf`);
    }
  },

  // 머리말·꼬리말: 위에 회사·문서 이름, 아래 가운데에 쪽 번호
  async 'header-footer'({ sample, out, words }) {
    await open('/pdf/header-footer/', sample('report'));
    await font();
    await frame.getByRole('textbox', { name: '머리말 (쪽 위)' }).fill(words.header);
    await frame.getByRole('textbox', { name: '꼬리말 (쪽 아래)' }).fill('{쪽} / {전체}');
    await frame
      .getByRole('radiogroup', { name: '꼬리말 (쪽 아래) 정렬' })
      .getByText('가운데')
      .click();
    await frame.getByRole('button', { name: '머리말·꼬리말 넣기' }).click();
    await save('다운로드', `${out}header-footer.pdf`);
  },

  // 서명: 그린 서명을 1쪽 작성자 줄 오른쪽에
  async sign({ sample, out }) {
    await open('/pdf/sign/', sample('report'));
    const pad = frame.getByLabel('서명 그리는 칸', { exact: false });
    const box = await pad.boundingBox();
    // 고리가 이어지는 필기체 같은 선 하나
    const points = Array.from({ length: 160 }, (_, i) => {
      const t = i / 159;
      const turn = t * Math.PI * 6;
      const height = 0.22 * (1 - 0.5 * t) * (0.7 + 0.3 * Math.sin(t * 11));
      return [0.12 + 0.74 * t + 0.05 * Math.cos(turn), 0.55 - height * Math.sin(turn) - 0.12 * t];
    });
    await page.mouse.move(box.x + box.width * points[0][0], box.y + box.height * points[0][1]);
    await page.mouse.down();
    for (const [x, y] of points.slice(1)) {
      await page.mouse.move(box.x + box.width * x, box.y + box.height * y);
    }
    await page.mouse.up();
    await frame.getByRole('button', { name: '서명 완료' }).click();
    // 처음 자리(x 0.55, y 0.8, 폭 0.25)에서 작성자 줄 오른쪽(x 0.5, y 0.17, 폭 0.2)으로 옮긴다.
    // Shift+화살표는 5%, 화살표와 -는 1%씩
    const stamp = frame.getByRole('button', { name: '놓을 이미지', exact: false });
    await stamp.focus();
    await press(stamp, 'Shift+ArrowLeft', 1);
    await press(stamp, 'Shift+ArrowUp', 12);
    await press(stamp, 'ArrowUp', 3);
    await press(stamp, '-', 5);
    await frame.getByRole('button', { name: '서명 넣기' }).click();
    await save('다운로드', `${out}sign.pdf`);
  },

  // 편집: 1쪽 표의 '평균 응답 시간' 줄을 흰색으로 가린다
  async edit({ sample, out }) {
    await open('/pdf/edit/', sample('report'));
    await frame.locator('.overlay').waitFor();
    await frame.getByText('흰색으로 가리기').click();
    await drag('.overlay', [0.125, 0.411], [0.8, 0.438]);
    await frame.getByRole('button', { name: '편집한 PDF 만들기' }).click();
    await save('다운로드', `${out}edit.pdf`);
  },

  // 자르기: 1쪽의 글자 둘레만 남긴다
  async crop({ sample, out }) {
    await open('/pdf/crop/', sample('report'));
    // 처음 영역은 가장자리 5%씩 안쪽. Shift+화살표는 5%, 화살표는 1%씩 옮긴다
    const nw = frame.getByRole('button', { name: '왼쪽 위 모서리', exact: false });
    await press(nw, 'Shift+ArrowRight', 1);
    await press(nw, 'ArrowDown', 3);
    const se = frame.getByRole('button', { name: '오른쪽 아래 모서리', exact: false });
    await press(se, 'Shift+ArrowLeft', 1);
    await press(se, 'ArrowLeft', 3);
    await press(se, 'ArrowDown', 2);
    await frame.getByRole('button', { name: 'PDF 자르기' }).click();
    await save('다운로드', `${out}crop.pdf`);
  },

  // PDF를 이미지로: 보통(150 DPI)과 고화질(300 DPI), JPG
  async 'to-image'({ sample, out }) {
    for (const [quality, label] of [
      ['150', '보통 (150 DPI)'],
      ['300', '고화질 (300 DPI)'],
    ]) {
      await open('/pdf/to-image/', sample('report'));
      await frame.getByText(label).click();
      await frame.getByRole('button', { name: '이미지로 변환' }).click();
      await save('다운로드', `${out}to-image-${quality}.zip`);
    }
  },

  // 글자 인식: 스캔본 한 쪽
  async ocr({ sample, out, locale }) {
    await open('/pdf/ocr/', sample('scan'));
    // 견본의 언어만 고른다
    const langs = frame.getByRole('group', { name: '인식할 언어' });
    for (const [label, on] of [
      ['한국어', locale === 'ko'],
      ['영어', locale === 'en'],
    ]) {
      await langs.getByLabel(label).setChecked(on);
    }
    const data = frame.getByRole('button', { name: /^데이터 받기/ });
    const run = frame.getByRole('button', { name: '글자 인식', exact: true });
    await data.or(run).first().waitFor();
    if (await data.isVisible()) await data.click();
    await run.click();
    const event = page.waitForEvent('download', { timeout: 120_000 });
    await frame.getByRole('button', { name: 'PDF 다운로드' }).click({ timeout: 120_000 });
    await copyFile(await (await event).path(), `${out}ocr.pdf`);
  },

  // 이미지를 PDF로: A4·여백 있음, 이미지에 맞춤·여백 없음
  async 'from-image'({ sample, out }) {
    for (const [name, size, margin] of [
      ['a4', 'A4', '여백 있음'],
      ['fit', '이미지에 맞춤', '여백 없음'],
    ]) {
      await open('/pdf/from-image/', [sample('docPhoto1'), sample('docPhoto2')]);
      await frame
        .getByRole('radiogroup', { name: '쪽 크기' })
        .getByText(size, { exact: true })
        .first()
        .click();
      await frame
        .getByRole('radiogroup', { name: '여백' })
        .getByText(margin, { exact: true })
        .first()
        .click();
      await frame.getByRole('button', { name: 'PDF 만들기', exact: true }).click();
      await save('다운로드', `${out}from-image-${name}.pdf`);
    }
  },

  // 문서 정보: 모두 지우기
  async metadata({ sample, out }) {
    await open('/pdf/metadata/', sample('report'));
    await frame.getByLabel('문서 정보 모두 지우기', { exact: false }).check();
    await frame.getByRole('button', { name: '저장', exact: true }).click();
    await save('다운로드', `${out}metadata.pdf`);
  },

  // 양식 채우기: 신청서의 칸을 채우고 동의에 표시
  async 'fill-form'({ sample, out, words, locale }) {
    await open('/pdf/fill-form/', sample('form'));
    for (const [field, value] of Object.entries(words.form)) {
      await frame.getByLabel(field, { exact: true }).fill(value);
    }
    await frame.getByLabel('agree', { exact: true }).check();
    if (locale === 'ko') await font();
    await frame.getByRole('button', { name: '양식 저장' }).click();
    await save('다운로드', `${out}fill-form.pdf`);
  },

  // 사진 꺼내기: 사진 모음 PDF의 첫 사진 (비교용으로 같은 쪽을 150 DPI 이미지로도 만든다)
  async 'extract-images'({ sample, out }) {
    await open('/pdf/extract-images/', sample('photos'));
    await save('모두 받기 (ZIP)', `${out}extract-images.zip`);
    await open('/pdf/to-image/', sample('photos'));
    await frame.getByText('보통 (150 DPI)').click();
    await frame.getByRole('button', { name: '이미지로 변환' }).click();
    await save('다운로드', `${out}extract-images-page.zip`);
  },

  // 이미지 압축: 사진을 보통·많이로
  async 'image-compress'({ sample, out }) {
    for (const [level, label] of [
      ['balanced', '보통 (추천)'],
      ['strong', '많이 (용량 우선)'],
    ]) {
      await open('/image/compress/', sample('photo'));
      await frame.getByText(label).click();
      await frame.getByRole('button', { name: '압축하기' }).click();
      await save('다운로드', `${out}image-compress-${level}.jpg`);
    }
  },

  // 용량 맞추기: 사진을 30KB로, 크기도 줄이기·화질만
  async 'target-size'({ sample, out }) {
    for (const [method, label] of [
      ['resize', '필요하면 크기도 줄이기 (추천)'],
      ['keep', '크기는 그대로, 화질만'],
    ]) {
      await open('/image/target-size/', sample('photo'));
      await frame.getByText('직접 입력', { exact: true }).click();
      await frame.getByLabel('목표 용량 숫자').fill('30');
      await frame.getByText(label).click();
      await frame.getByRole('button', { name: '용량 맞추기' }).click();
      await save('다운로드', `${out}target-size-${method}.jpg`);
    }
  },

  // 이미지 크기: 사진을 50%·25%로
  async 'image-resize'({ sample, out }) {
    for (const percent of [50, 25]) {
      await open('/image/resize/', sample('photo'));
      await frame.getByLabel('비율 (%)').fill(String(percent));
      await frame.getByRole('button', { name: '크기 바꾸기' }).click();
      await save('다운로드', `${out}image-resize-${percent}.jpg`);
    }
  },

  // 형식 변환: 화면 캡처(PNG)를 JPG·WebP로
  async 'image-convert'({ sample, out }) {
    for (const [format, ext] of [
      ['JPG', 'jpg'],
      ['WebP', 'webp'],
    ]) {
      await open('/image/convert/', sample('screen'));
      await frame
        .getByRole('radiogroup', { name: '바꿀 형식' })
        .getByText(format, { exact: true })
        .click();
      await frame.getByRole('button', { name: '변환하기' }).click();
      await save('다운로드', `${out}image-convert.${ext}`);
    }
  },

  // HEIC 변환: 세로로 들고 찍은 견본(화소는 누워 있고 회전 표시가 붙음)을 JPG로
  async 'heic-to-jpg'({ sample, out }) {
    await open('/image/heic-to-jpg/', sample('heic'));
    await frame.getByRole('button', { name: '변환하기' }).click();
    await save('다운로드', `${out}heic-to-jpg.jpg`);
  },

  // 위치 정보 지우기: 위치가 든 견본을 모두 지우기·위치만 지우기로
  async 'remove-location'({ sample, out }) {
    for (const [mode, label] of [
      ['all', '모든 정보 지우기 (추천)'],
      ['location', '위치만 지우기'],
    ]) {
      await open('/image/remove-location/', sample('located'));
      await frame.getByText(label).click();
      await frame.getByRole('button', { name: '정보 지우기' }).click();
      await save('다운로드', `${out}remove-location-${mode}.jpg`);
    }
  },

  // 이어 붙이기: 대화 캡처 세 장을 겹친 부분을 지우고 PNG 한 장으로
  async stitch({ sample, out }) {
    await open('/image/stitch/', [sample('chat1'), sample('chat2'), sample('chat3')]);
    await frame.getByText('겹친 부분을 찾았습니다').nth(1).waitFor();
    await frame.getByText('PNG', { exact: true }).click();
    await frame.getByRole('button', { name: '이어 붙이기' }).click();
    await save('다운로드', `${out}stitch.png`);
  },
  async crop({ sample, out }) {
    await open('/image/crop/', sample('tilted'));
    await frame.getByLabel('기울기 바로잡기').fill('4');
    await frame.getByText('4:5', { exact: true }).click();
    await save('자른 이미지 받기', `${out}crop.jpg`);
  },

  // 모자이크: 견본의 번호판을 흐리게·모자이크·검게 칠하기로 (세기는 기본 5)
  async mosaic({ sample, out }) {
    for (const [effect, label] of [
      ['blur', '흐리게'],
      ['mosaic', '모자이크'],
      ['fill', '검게 칠하기'],
    ]) {
      await open('/image/mosaic/', sample('car'));
      await frame.locator('.view canvas').waitFor();
      // 사진을 열면 바깥 페이지가 도구 칸으로 스크롤한다. 끝난 뒤에 끌어 그린다
      await page.waitForFunction(() => scrollY > 0);
      await frame.getByText(label, { exact: true }).click();
      await drag('.view canvas', [0.385, 0.645], [0.615, 0.745]);
      await save('가린 이미지 받기', `${out}mosaic-${effect}.jpg`);
    }
  },

  // 배경 제거: 견본 머그잔의 가운데를 저절로 남기고 손잡이를 눌러 더한 뒤, 손잡이 안쪽(벽)을 지우개로 지운다.
  // 투명 PNG와 흰 배경·물체에 맞춰 자른 JPG를 받는다
  async 'remove-bg'({ sample, out }) {
    await open('/image/remove-bg/', sample('product'));
    const get = frame.getByRole('button', { name: /^데이터 받기/ });
    const done = frame.getByText('사진 가운데의 물체를 남겼습니다.', { exact: false });
    await get.or(done).first().waitFor();
    if (await get.isVisible()) await get.click();
    await done.waitFor({ timeout: 60_000 });
    await page.waitForFunction(() => scrollY > 0);
    const view = frame.getByRole('application');
    // 손잡이 고리 (사진의 73%, 52% 자리)
    const box = await view.boundingBox();
    await view.click({ position: { x: box.width * 0.73, y: box.height * 0.52 } });
    await frame.getByText('누른 곳 2곳의 물체를 남겼습니다.').waitFor({ timeout: 30_000 });
    // 손잡이 안쪽 구멍(가로 68%, 세로 44~59%)을 붓 크기 7%의 지우개로 위에서 아래로 찍어 지운다
    await frame.getByText('지우개', { exact: true }).click();
    await press(frame.getByLabel('붓 크기'), 'ArrowRight', 3);
    await view.focus();
    await press(view, 'Shift+ArrowRight', 3);
    await press(view, 'ArrowRight', 3);
    await press(view, 'ArrowUp', 1);
    for (let i = 0; i < 6; i++) {
      await view.press('Enter');
      await view.press('ArrowDown');
    }
    await save('PNG 다운로드', `${out}remove-bg.png`);
    await frame.getByText('흰색', { exact: true }).click();
    await frame.getByText('물체에 맞춰 자르기').click();
    await save('JPG 다운로드', `${out}remove-bg-white.jpg`);
  },

  // CSV 한글 깨짐 고치기: BOM 없는 UTF-8 견본을 엑셀용 UTF-8(기본)로
  async 'csv-encoding'({ sample, out }) {
    await open('/text/csv-encoding/', sample('utf8Csv'));
    await frame.getByRole('button', { name: '변환하기' }).click();
    await save('다운로드', `${out}csv-encoding.csv`);
  },

  // 이미지 글자 추출: 12° 기울여 찍은 서류 사진(견본을 돌려 만든다)과 대화 캡처에서 읽은 줄 자리
  async 'image-ocr'({ sample, out, locale }) {
    await page.goto(BASE + '/');
    const tilted = await page.evaluate(
      async (data) => {
        const bitmap = await createImageBitmap(new Blob([new Uint8Array(data)]));
        const radians = (12 * Math.PI) / 180;
        const [cos, sin] = [Math.cos(radians), Math.sin(radians)];
        const width = Math.round(bitmap.width * cos + bitmap.height * sin);
        const height = Math.round(bitmap.width * sin + bitmap.height * cos);
        const canvas = new OffscreenCanvas(width, height);
        const context = canvas.getContext('2d');
        context.fillStyle = '#8c6a4c';
        context.fillRect(0, 0, width, height);
        context.translate(width / 2, height / 2);
        context.rotate(radians);
        context.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
        const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
        return Array.from(new Uint8Array(await blob.arrayBuffer()));
      },
      Array.from(await readFile(sample('docPhoto2'))),
    );
    await writeFile(`${out}ocr-tilted.jpg`, Buffer.from(tilted));
    await open('/image/ocr/', [`${out}ocr-tilted.jpg`, sample('chat1')]);
    // 견본의 언어만 고른다
    const langs = frame.getByRole('group', { name: '인식할 언어' });
    for (const [label, on] of [
      ['한국어', locale === 'ko'],
      ['영어', locale === 'en'],
    ]) {
      await langs.getByLabel(label).setChecked(on);
    }
    const data = frame.getByRole('button', { name: /^데이터 받기/ });
    const run = frame.getByRole('button', { name: '글자 인식', exact: true });
    await data.or(run).first().waitFor();
    if (await data.isVisible()) await data.click();
    await run.click();
    await frame.getByRole('button', { name: 'TXT 다운로드' }).waitFor({ timeout: 120_000 });
    // 이미지마다 읽은 줄의 네 꼭짓점 (이미지 화소 기준)
    const lines = await frame
      .locator('.figure svg')
      .evaluateAll((svgs) =>
        svgs.map((svg) =>
          [...svg.querySelectorAll('polygon')].map((polygon) =>
            polygon.getAttribute('points').split(' ').map(Number),
          ),
        ),
      );
    await writeFile(`${out}ocr-lines.json`, JSON.stringify(lines));
  },
};

const only = process.argv.slice(2);
for (const name of only) if (!JOBS[name]) throw new Error(`없는 작업: ${name}`);
for (const [locale, names] of Object.entries(SAMPLES)) {
  const out = `${ROOT}.cache/guide-images/${locale}/`;
  await mkdir(out, { recursive: true });
  const sample = (key) => `${ROOT}public/samples/${locale}/${names[key]}`;
  for (const [name, job] of Object.entries(JOBS)) {
    if (only.length && !only.includes(name)) continue;
    await job({ sample, out, locale, words: WORDS[locale] });
    console.log(`${locale}: ${name}`);
  }
}

await browser.close();
