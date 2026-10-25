/**
 * 위치 정보 지우기 E2E. 빌드 결과에서 돌린다 (playwright.config.ts 참고).
 *
 * 받은 파일을 다시 읽어 위치·날짜·기기가 지워졌는지, 그림 자료는 그대로인지, 브라우저가 바로 세워 여는지 보고,
 * 처리하는 동안 파일이 기기를 떠나지 않는다는 약속을 확인한다.
 */
import { expect, test, type Page, type Request } from './test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';
import { expectLocalOnly } from './local-only';
import { readPhotoInfo } from '../../src/lib/image/photo-metadata';
import { readHeifMeta } from '../../src/lib/image/heif-metadata';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

async function openTool(page: Page, files: string[]) {
  await page.goto('/image/remove-location/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles(files.map(fixture));
  return frame;
}

/** 브라우저로 이미지를 열어 바로 세운 가로·세로를 읽는다 */
async function inspect(page: Page, bytes: Uint8Array) {
  return page.evaluate(async (data) => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(data)]), {
      imageOrientation: 'from-image',
    });
    return { width: bitmap.width, height: bitmap.height };
  }, Array.from(bytes));
}

/** JPEG의 압축 자료(첫 스캔 머리부터 그림 끝까지) */
function scanData(bytes: Uint8Array): Uint8Array {
  let start = 2;
  while (!(bytes[start] === 0xff && bytes[start + 1] === 0xda)) {
    start += 2 + ((bytes[start + 2]! << 8) | bytes[start + 3]!);
  }
  let end = bytes.length - 2;
  while (!(bytes[end] === 0xff && bytes[end + 1] === 0xd9)) end--;
  return bytes.subarray(start, end + 2);
}

test('사진의 정보를 모두 지우고 방향만 남긴다', async ({ page, baseURL }) => {
  const requests: Request[] = [];
  page.on('request', (request) => requests.push(request));
  const frame = await openTool(page, ['located.jpg']);
  await expect(
    frame.getByText('위치 37.5663, 126.9779 · 2024-05-01 14:23 · Apple iPhone 15 Pro'),
  ).toBeVisible();
  await expect(frame.getByText('사진 1장 중 1장에 위치가 있습니다.')).toBeVisible();
  // 그림 뒤에 붙은 영상(움직이는 사진)은 함께 빠진다고 미리 알린다
  await expect(
    frame.getByText('사진 1장에 HDR 밝기 정보나 움직이는 사진의 영상이 붙어 있습니다.', {
      exact: false,
    }),
  ).toBeVisible();
  requests.length = 0; // 페이지를 여는 요청은 빼고, 파일을 고른 뒤부터 센다

  await frame.getByRole('button', { name: '정보 지우기' }).click();
  await expect(frame.getByText('완료: 사진 1장에서 지웠습니다.')).toBeVisible();
  await expect(frame.getByText('정보를 모두 지웠습니다', { exact: false })).toBeVisible();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드' }).click();
  const file = await event;
  expect(file.suggestedFilename()).toBe('located_정보삭제.jpg');
  const bytes = new Uint8Array(await readFile(await file.path()));
  const original = new Uint8Array(await readFile(fixture('located.jpg')));

  expect(readPhotoInfo(bytes)).toMatchObject({ location: false, orientation: 6 });
  expect(readPhotoInfo(bytes)?.date).toBeUndefined();
  expect(readPhotoInfo(bytes)?.device).toBeUndefined();
  const text = Buffer.from(bytes).toString('latin1');
  expect(text).not.toContain('GPSLatitude');
  expect(text).not.toContain('MOTION-PHOTO-VIDEO');
  // 다시 압축하지 않는다: 그림 자료가 한 바이트도 바뀌지 않는다
  expect(Buffer.from(scanData(bytes)).equals(Buffer.from(scanData(original)))).toBe(true);
  // 방향을 남겨 바로 세운 세로 사진으로 열린다
  expect(await inspect(page, bytes)).toEqual({ width: 300, height: 400 });
  expectLocalOnly(page, requests, baseURL!);
});

test('위치만 지우면 찍은 날짜와 기기는 남는다 (JPG·PNG·WebP를 ZIP으로)', async ({ page }) => {
  const frame = await openTool(page, ['located.jpg', 'located.png', 'located.webp']);
  await expect(frame.getByText('사진 3장 중 3장에 위치가 있습니다.')).toBeVisible();
  await frame.getByText('위치만 지우기').click();
  await frame.getByRole('button', { name: '정보 지우기' }).click();
  await expect(frame.getByText('완료: 사진 3장에서 지웠습니다.')).toBeVisible();

  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '모두 받기 (ZIP, 3장)' }).click();
  const file = await event;
  expect(file.suggestedFilename()).toBe('사진_정보삭제.zip');
  const files = unzipSync(new Uint8Array(await readFile(await file.path())));
  expect(Object.keys(files).sort()).toEqual([
    'located_위치삭제.jpg',
    'located_위치삭제.png',
    'located_위치삭제.webp',
  ]);
  for (const [name, bytes] of Object.entries(files)) {
    expect(readPhotoInfo(bytes), name).toMatchObject({
      location: false,
      date: '2024-05-01 14:23',
      device: 'Apple iPhone 15 Pro',
    });
    const text = Buffer.from(bytes).toString('latin1');
    expect(text, name).not.toContain('GPSLatitude');
    // 위치가 적힐 수 있는 설명 글(PNG 글 조각, JPEG COM)도 뺀다
    expect(text, name).not.toContain('taken at home');
    // EXIF 자유 글(설명·메모)에 적힌 장소도 남기지 않는다
    expect(text, name).not.toContain('Secret');
    expect(text, name).not.toContain('Near my house');
    expect((await inspect(page, bytes)).width, name).toBeGreaterThan(0);
  }
});

test('지울 정보가 없는 사진은 원본 그대로 두고 알린다', async ({ page }) => {
  const frame = await openTool(page, ['tall.jpg']);
  await expect(frame.getByText('위치 없음')).toBeVisible();
  await expect(frame.getByText('HDR 밝기 정보', { exact: false })).toHaveCount(0);
  await frame.getByRole('button', { name: '정보 지우기' }).click();
  await expect(frame.getByText('지울 정보가 없었습니다.', { exact: false })).toBeVisible();
  await expect(frame.getByText('지울 정보가 없어 원본 그대로')).toBeVisible();
  await expect(frame.getByRole('button', { name: '다운로드' })).toHaveCount(0);
});

test('방식을 바꾸면 지운 결과를 버리고 다시 지울 수 있다', async ({ page }) => {
  const frame = await openTool(page, ['located.jpg']);
  await frame.getByRole('button', { name: '정보 지우기' }).click();
  await expect(frame.getByRole('button', { name: '다운로드' })).toBeVisible();
  await frame.getByText('위치만 지우기').click();
  await expect(frame.getByRole('button', { name: '정보 지우기' })).toBeEnabled();
  await expect(frame.getByText('위치 37.5663, 126.9779', { exact: false })).toBeVisible();
});

test('EXIF가 깨진 사진도 그 조각만 빼고 지운다', async ({ page }) => {
  const frame = await openTool(page, ['short-exif.jpg']);
  await expect(frame.getByText('위치 없음')).toBeVisible();
  await frame.getByRole('button', { name: '정보 지우기' }).click();
  await expect(frame.getByText('완료: 사진 1장에서 지웠습니다.')).toBeVisible();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드' }).click();
  const bytes = new Uint8Array(await readFile(await (await event).path()));
  expect(Buffer.from(bytes).toString('latin1')).not.toContain('Exif');
  expect(await inspect(page, bytes)).toEqual({ width: 200, height: 150 });
});

/** 원본과 결과가 촬영 정보 항목(EXIF·XMP) 밖에서는 한 바이트도 다르지 않은지 */
function sameOutsideMetadata(original: Uint8Array, cleaned: Uint8Array): boolean {
  const meta = readHeifMeta(original);
  if (!meta || original.length !== cleaned.length) return false;
  const inside = (at: number) =>
    meta.items.some((item) => item.ranges.some((range) => at >= range.start && at < range.end));
  for (let at = 0; at < original.length; at++) {
    if (original[at] !== cleaned[at] && !inside(at)) return false;
  }
  return true;
}

test('아이폰 사진(HEIC)은 HEIC 그대로 위치만 지우고 그림은 건드리지 않는다', async ({
  page,
  baseURL,
}) => {
  const requests: Request[] = [];
  page.on('request', (request) => requests.push(request));
  // 크롬은 HEIC를 스스로 읽지 못해 목록 썸네일은 libheif로 그린다
  const frame = await openTool(page, ['located.heic']);
  await expect(
    frame.getByText('위치 37.5663, 126.9779 · 2024-05-01 14:23 · Apple iPhone 15 Pro'),
  ).toBeVisible();
  requests.length = 0;

  await frame.getByText('위치만 지우기').click();
  await frame.getByRole('button', { name: '정보 지우기' }).click();
  await expect(frame.getByText('완료: 사진 1장에서 지웠습니다.')).toBeVisible();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드' }).click();
  const file = await event;
  expect(file.suggestedFilename()).toBe('located_위치삭제.heic');
  const bytes = new Uint8Array(await readFile(await file.path()));
  const original = new Uint8Array(await readFile(fixture('located.heic')));

  const info = readPhotoInfo(bytes);
  expect(info).toMatchObject({ format: 'heif', location: false });
  expect(info?.date).toBe('2024-05-01 14:23');
  expect(info?.device).toBe('Apple iPhone 15 Pro');
  const text = Buffer.from(bytes).toString('latin1');
  expect(text).not.toContain('GPSLatitude');
  expect(text).not.toContain('Secret');
  expect(text).not.toContain('Near my house');
  // 다시 저장하지 않는다: 크기가 같고 정보 항목 밖은 한 바이트도 바뀌지 않는다
  expect(sameOutsideMetadata(original, bytes)).toBe(true);
  expectLocalOnly(page, requests, baseURL!);
});

test('HEIC의 정보를 모두 지우면 날짜·기기도 빠진다', async ({ page }) => {
  const frame = await openTool(page, ['located.heic']);
  await expect(frame.getByText('사진 1장 중 1장에 위치가 있습니다.')).toBeVisible();
  await frame.getByRole('button', { name: '정보 지우기' }).click();
  await expect(frame.getByText('정보를 모두 지웠습니다', { exact: false })).toBeVisible();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드' }).click();
  const file = await event;
  expect(file.suggestedFilename()).toBe('located_정보삭제.heic');
  const bytes = new Uint8Array(await readFile(await file.path()));
  const info = readPhotoInfo(bytes);
  expect(info).toMatchObject({ location: false });
  expect(info?.date).toBeUndefined();
  expect(info?.device).toBeUndefined();
  expect(Buffer.from(bytes).toString('latin1')).not.toContain('iPhone 15 Pro');
  expect(sameOutsideMetadata(new Uint8Array(await readFile(fixture('located.heic'))), bytes)).toBe(
    true,
  );
});

test('HEIC의 빈 상자(free·skip)와 끝 뒤 자료에 남은 위치 글도 지운다', async ({ page }) => {
  // 예전 편집이 남긴 것처럼 GPS 글을 free·skip 상자와 파일 끝 뒤에 붙인다
  const secret = Buffer.from('exif:GPSLatitude="37,33.978N" Home 123 Secret St');
  const box = (type: string) => {
    const out = Buffer.alloc(8 + secret.length);
    out.writeUInt32BE(out.length, 0);
    out.write(type, 4, 'latin1');
    secret.copy(out, 8);
    return out;
  };
  const original = await readFile(fixture('located.heic'));
  const buffer = Buffer.concat([original, box('free'), box('skip'), secret.subarray(0, 6)]);
  await page.goto('/image/remove-location/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame
    .locator('input[type=file]')
    .setInputFiles({ name: 'edited.heic', mimeType: 'image/heic', buffer });
  await expect(frame.getByText('사진 1장 중 1장에 위치가 있습니다.')).toBeVisible();
  await frame.getByText('위치만 지우기').click();
  await frame.getByRole('button', { name: '정보 지우기' }).click();
  await expect(frame.getByText('완료: 사진 1장에서 지웠습니다.')).toBeVisible();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드' }).click();
  const bytes = new Uint8Array(await readFile(await (await event).path()));
  expect(bytes.length).toBe(buffer.length);
  const text = Buffer.from(bytes).toString('latin1');
  expect(text).not.toContain('GPSLatitude');
  expect(text).not.toContain('Secret');
  // 원래 HEIC 부분은 정보 항목 밖이 그대로다
  expect(sameOutsideMetadata(original, bytes.subarray(0, original.length))).toBe(true);
});

test('허용 목록 밖의 그림 속성(uuid)에 위치 글이 든 HEIC는 고치지 않고 안전하게 지울 수 없다고 알린다', async ({
  page,
}) => {
  const frame = await openTool(page, ['located-uuid.heic']);
  const unsafe = frame.getByText('이 HEIC는 위치 정보를 안전하게 지울 수 없어 고치지 않습니다.', {
    exact: false,
  });
  await expect(unsafe).toBeVisible();
  await frame.getByRole('button', { name: '정보 지우기' }).click();
  await expect(
    frame.getByText('정보를 지우지 못한 사진이 있습니다.', { exact: false }),
  ).toBeVisible();
  await expect(unsafe).toBeVisible();
  await expect(frame.getByRole('button', { name: '다운로드' })).toHaveCount(0);
});

test('HEIC 안의 JPEG 그림 항목에 든 촬영 정보도 같은 길이로 비운다', async ({ page }) => {
  // located-jpeg-item.heic: located.heic에 located.jpg(EXIF GPS·XMP·설명 글·덧붙은 영상)를 JPEG 항목으로 더한 것
  const frame = await openTool(page, ['located-jpeg-item.heic']);
  await expect(frame.getByText('사진 1장 중 1장에 위치가 있습니다.')).toBeVisible();
  await frame.getByText('위치만 지우기').click();
  await frame.getByRole('button', { name: '정보 지우기' }).click();
  await expect(frame.getByText('완료: 사진 1장에서 지웠습니다.')).toBeVisible();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드' }).click();
  const bytes = new Uint8Array(await readFile(await (await event).path()));
  const original = new Uint8Array(await readFile(fixture('located-jpeg-item.heic')));
  expect(bytes.length).toBe(original.length);
  expect(readPhotoInfo(bytes)).toMatchObject({ format: 'heif', location: false });
  const text = Buffer.from(bytes).toString('latin1');
  expect(text).not.toContain('GPS');
  expect(text).not.toContain('Secret');
  expect(text).not.toContain('taken at home');
  expect(text).not.toContain('MOTION-PHOTO-VIDEO');
  // 안의 JPEG는 그대로 읽히는 JPEG이고 촬영 정보가 없다
  const jpeg = bytes.subarray(text.indexOf('\xff\xd8\xff'));
  expect(readPhotoInfo(jpeg)).toMatchObject({ format: 'jpeg', location: false });
  expect(readPhotoInfo(jpeg)?.device).toBeUndefined();
});
