/**
 * CSV 한글 깨짐 고치기 E2E. 빌드 결과에서 돌린다 (playwright.config.ts 참고).
 *
 * 기준 파일(tests/fixtures/make_text_fixtures.py)은 파이썬 코덱으로 만들어 도구의 인코더와 구현이 다르다.
 * 받은 파일은 바이트 그대로 비교하고, CP949 결과는 브라우저의 TextDecoder('euc-kr')로 다시 읽어 본다.
 * 파일이 기기를 떠나지 않는다는 약속은 test.ts가 모든 테스트 끝에 확인한다.
 */
import { expect, test, type Page } from './test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));
const BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const csv = (name: string, bytes: Buffer) => ({ name, mimeType: 'text/csv', buffer: bytes });

/** make_text_fixtures.py의 내용과 같게 */
const KOREAN = '이름,부서,메모\r\n홍길동,기획팀,"똠얌꿍, 점심"\r\n김예시,영업팀,내일 오전 회의\r\n';
const JAPANESE = '名前,部署,メモ\n山田太郎,企画部,ひらがなとカタカナ\n佐藤花子,営業部,明日の会議\n';

type Input = string | { name: string; mimeType: string; buffer: Buffer };

async function openTool(page: Page, files: Input[], path = '/text/csv-encoding/') {
  await page.goto(path);
  const frame = page.frameLocator('iframe[data-tool-frame]');
  // 경로와 바이트를 섞어 넣을 수 없어 기준 파일도 바이트로 넣는다
  const inputs = await Promise.all(
    files.map(async (file) =>
      typeof file === 'string'
        ? {
            name: file,
            mimeType: file.endsWith('.pdf') ? 'application/pdf' : 'text/csv',
            buffer: await readFile(fixture(file)),
          }
        : file,
    ),
  );
  await frame.locator('input[type=file]').first().setInputFiles(inputs);
  return frame;
}

async function download(page: Page, click: () => Promise<void>) {
  const event = page.waitForEvent('download');
  await click();
  const file = await event;
  return { name: file.suggestedFilename(), bytes: await readFile(await file.path()) };
}

/** 브라우저(WHATWG)의 디코더로 읽는다. Node의 euc-kr은 확장 완성형(똠 등)을 읽지 못한다 */
async function decode(page: Page, bytes: Buffer, encoding: string): Promise<string> {
  return page.evaluate(([data, label]) => new TextDecoder(label).decode(new Uint8Array(data)), [
    Array.from(bytes),
    encoding,
  ] as const);
}

test('CP949 CSV를 엑셀용 UTF-8(BOM)로 바이트 그대로 바꾼다', async ({ page }) => {
  const frame = await openTool(page, ['korean-cp949.csv']);
  await expect(frame.getByText('CP949 (EUC-KR) · 1KB')).toBeVisible();
  await expect(frame.getByLabel('원본 인코딩')).toHaveValue('euc-kr');
  // 엑셀은 CP949를 바로 읽으므로 UTF-8로 읽는 곳에서 깨지는 모습과 바꾼 뒤를 보여 준다
  await expect(frame.getByText('UTF-8로 읽는 곳(구글 시트·맥 Numbers 등)에서 열면')).toBeVisible();
  await expect(frame.getByRole('cell', { name: '똠얌꿍, 점심' })).toBeVisible();

  await frame.getByRole('button', { name: '변환하기' }).click();
  await expect(frame.getByText('완료: 파일 1개를 바꿨습니다.')).toBeVisible();
  await expect(frame.getByText('CP949 (EUC-KR) → 엑셀용', { exact: false })).toBeVisible();
  const file = await download(page, () => frame.getByRole('button', { name: '다운로드' }).click());
  expect(file.name).toBe('korean-cp949_엑셀용.csv');
  expect(file.bytes.equals(Buffer.concat([BOM, Buffer.from(KOREAN)]))).toBe(true);
});

test('BOM 없는 UTF-8을 알아내고 엑셀에서 깨지는 모습을 보여 준다', async ({ page }) => {
  const text = '이름,메모\n홍길동,안녕하세요\n';
  const frame = await openTool(page, [csv('orders.csv', Buffer.from(text))]);
  await expect(frame.getByText('UTF-8 (BOM 없음) · 1KB')).toBeVisible();
  await expect(frame.getByText('지금 엑셀에서 열면')).toBeVisible();
  await expect(frame.getByRole('cell', { name: '안녕하세요' })).toBeVisible();

  // 이미 BOM 없는 UTF-8이면 바꿀 것이 없다
  await frame.getByRole('radiogroup', { name: '저장 형식' }).getByText('UTF-8 (BOM 없음)').click();
  await frame.getByRole('button', { name: '변환하기' }).click();
  await expect(frame.getByText('바꿀 것이 없었습니다.', { exact: false })).toBeVisible();
  await expect(frame.getByText('이미 고른 형식이라 원본 그대로')).toBeVisible();
  await expect(frame.getByRole('button', { name: '다운로드' })).toHaveCount(0);

  // 엑셀용으로 바꾸면 BOM만 붙는다
  await frame.getByRole('radiogroup', { name: '저장 형식' }).getByText('엑셀용 UTF-8').click();
  await frame.getByRole('button', { name: '변환하기' }).click();
  const file = await download(page, () => frame.getByRole('button', { name: '다운로드' }).click());
  expect(file.name).toBe('orders_엑셀용.csv');
  expect(file.bytes.equals(Buffer.concat([BOM, Buffer.from(text)]))).toBe(true);
});

test('원본 인코딩을 직접 고르면 그 인코딩으로 읽고 줄바꿈도 바꾼다', async ({ page }) => {
  const frame = await openTool(page, ['japanese-sjis.csv']);
  const source = frame.getByLabel('원본 인코딩');
  await expect(source).not.toHaveValue('shift_jis');
  await expect(frame.getByRole('cell', { name: '山田太郎' })).toHaveCount(0);

  await source.selectOption('shift_jis');
  await expect(frame.getByText('직접 고름: Shift_JIS (일본어)', { exact: false })).toBeVisible();
  await expect(frame.getByRole('cell', { name: '山田太郎' }).last()).toBeVisible();

  await frame.getByRole('radiogroup', { name: '줄바꿈' }).getByText('CRLF (윈도우)').click();
  await frame.getByRole('button', { name: '변환하기' }).click();
  const file = await download(page, () => frame.getByRole('button', { name: '다운로드' }).click());
  const expected = Buffer.concat([BOM, Buffer.from(JAPANESE.replaceAll('\n', '\r\n'))]);
  expect(file.bytes.equals(expected)).toBe(true);
});

test('CP949로 저장하면 없는 글자를 ?로 바꾸고 어디 있는지 알린다', async ({ page }) => {
  const text = '이름,메모\r\n홍길동,좋아요 😀\r\n똠방각하,펲\r\n';
  const frame = await openTool(page, [csv('memo.csv', Buffer.from(text))]);
  await frame.getByRole('radiogroup', { name: '저장 형식' }).getByText('CP949 (EUC-KR)').click();
  // 바꾼 뒤 미리보기에도 ?로 보인다
  await expect(frame.getByRole('cell', { name: '좋아요 ?' })).toBeVisible();

  await frame.getByRole('button', { name: '변환하기' }).click();
  await expect(
    frame.getByText('완료. CP949에 없는 글자 1개를 ?로 바꿨습니다.', { exact: false }),
  ).toBeVisible();
  await expect(frame.getByText('CP949에 없는 글자: 😀 (2번째 줄)')).toBeVisible();
  const file = await download(page, () => frame.getByRole('button', { name: '다운로드' }).click());
  expect(file.name).toBe('memo_CP949.csv');
  // 확장 완성형 글자(똠 8C63, 펲 BC84)도 CP949 두 바이트로 쓴다
  expect(file.bytes.includes(Buffer.from([0x8c, 0x63]))).toBe(true);
  expect(file.bytes.includes(Buffer.from([0xbc, 0x84]))).toBe(true);
  expect(await decode(page, file.bytes, 'euc-kr')).toBe(text.replace('😀', '?'));
});

test('여러 파일을 ZIP 하나로 받고 이미 맞는 파일은 원본을 넣는다', async ({ page }) => {
  const ready = Buffer.concat([BOM, Buffer.from('이름\r\n홍길동\r\n')]);
  const frame = await openTool(page, ['korean-cp949.csv', csv('ready.csv', ready)]);
  await expect(frame.getByText('UTF-8 (BOM 포함) · 1KB')).toBeVisible();
  await frame.getByRole('button', { name: '변환하기' }).click();
  await expect(frame.getByText('완료: 파일 1개를 바꿨습니다.')).toBeVisible();
  const file = await download(page, () =>
    frame.getByRole('button', { name: '모두 받기 (ZIP, 2개)' }).click(),
  );
  expect(file.name).toBe('CSV_인코딩변환.zip');
  const files = unzipSync(new Uint8Array(file.bytes));
  expect(Object.keys(files).sort()).toEqual(['korean-cp949_엑셀용.csv', 'ready.csv']);
  expect(
    Buffer.from(files['korean-cp949_엑셀용.csv']!).equals(
      Buffer.concat([BOM, Buffer.from(KOREAN)]),
    ),
  ).toBe(true);
  expect(Buffer.from(files['ready.csv']!).equals(ready)).toBe(true);
});

test('큰 파일도 조각 경계에서 글자와 줄바꿈이 깨지지 않는다', async ({ page }) => {
  test.setTimeout(120_000);
  // 6MB 남짓한 CP949 파일 (기준 파일의 줄을 되풀이). 조각 경계가 두 바이트 글자·CRLF 사이에 걸린다
  const [header, ...rows] = (await readFile(fixture('korean-cp949.csv')))
    .toString('latin1')
    .split('\r\n')
    .filter(Boolean)
    .map((line) => Buffer.from(line + '\r\n', 'latin1'));
  const big = Buffer.concat([header!, ...Array.from({ length: 90_000 }, () => rows).flat()]);
  const frame = await openTool(page, [csv('big.csv', big)]);
  await expect(frame.getByText('CP949 (EUC-KR) · ', { exact: false })).toBeVisible();
  await frame.getByRole('radiogroup', { name: '줄바꿈' }).getByText('LF (맥·리눅스)').click();
  await frame.getByRole('button', { name: '변환하기' }).click();
  const file = await download(page, () =>
    frame.getByRole('button', { name: '다운로드' }).click({ timeout: 60_000 }),
  );
  const [head, ...lines] = KOREAN.split('\r\n').filter(Boolean);
  const expected = [head, ...Array.from({ length: 90_000 }, () => lines).flat(), ''].join('\n');
  expect(file.bytes.length).toBe(BOM.length + Buffer.byteLength(expected));
  expect(file.bytes.equals(Buffer.concat([BOM, Buffer.from(expected)]))).toBe(true);
});

test('빈 파일과 글자 파일이 아닌 것은 빼고 알린다', async ({ page }) => {
  const png = await readFile(fixture('noise.png'));
  const frame = await openTool(page, [csv('empty.csv', Buffer.alloc(0)), csv('image.csv', png)]);
  await expect(frame.getByText('빈 파일입니다. 빼고 처리합니다.')).toBeVisible();
  await expect(
    frame.getByText('CSV·TXT 같은 글자 파일이 아닙니다. 빼고 처리합니다.'),
  ).toBeVisible();
  await expect(frame.getByText('바꿀 CSV 파일을 넣어 주세요.')).toBeVisible();
  await expect(frame.getByRole('button', { name: '변환하기' })).toBeDisabled();

  // 글자 파일을 더하면 그것만 바꾼다
  await frame.getByText('파일 추가').locator('input').setInputFiles(fixture('korean-cp949.csv'));
  await frame.getByRole('button', { name: '변환하기' }).click();
  await expect(frame.getByText('완료: 파일 1개를 바꿨습니다.')).toBeVisible();
});

test('CSV가 아닌 형식은 받지 않는다', async ({ page }) => {
  const frame = await openTool(page, ['three-pages.pdf']);
  await expect(frame.getByRole('button', { name: '예시 파일로 해 보기' })).toBeVisible();
  await expect(frame.getByRole('list', { name: '파일 목록' })).toHaveCount(0);
});

test('영어 화면은 Windows-1252 파일을 알아내고 영어로 안내한다', async ({ page }) => {
  const text = 'Name,City\r\nRenée,Montréal\r\n';
  const frame = await openTool(
    page,
    [csv('contacts.csv', Buffer.from(text, 'latin1'))],
    '/en/text/csv-encoding/',
  );
  await expect(frame.getByText('Windows-1252 (Western) · 1KB')).toBeVisible();
  await expect(frame.getByText('Opened where UTF-8 is expected', { exact: false })).toBeVisible();
  await expect(frame.getByRole('cell', { name: 'Montréal' })).toBeVisible();
  await frame.getByRole('button', { name: 'Convert' }).click();
  const file = await download(page, () =>
    frame.getByRole('button', { name: 'Download', exact: true }).click(),
  );
  expect(file.name).toBe('contacts_excel.csv');
  expect(file.bytes.equals(Buffer.concat([BOM, Buffer.from(text)]))).toBe(true);
});
