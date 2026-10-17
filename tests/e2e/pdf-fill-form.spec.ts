/**
 * PDF 양식 채우기 E2E. 빌드 결과에서 돌린다 (playwright.config.ts 참고).
 *
 * 쪽 위에 겹친 입력 칸으로 값을 넣고, 받은 PDF의 칸 값(pdf-lib로 읽음)과 굳힌 글자를 확인한다.
 */
import { expect, test, type Page, type Request } from './test';
import { readFile } from 'node:fs/promises';
import { PDFDocument, PDFHexString, PDFName } from '@cantoo/pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { expectLocalOnly } from './local-only';

/** 글자 칸·체크 상자·라디오(S/L)·선택 상자(Seoul/Busan)가 있는 신청서 */
async function formPdf() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 400]);
  const form = doc.getForm();
  form.createTextField('name').addToPage(page, { x: 20, y: 320, width: 200, height: 24 });
  form.createCheckBox('agree').addToPage(page, { x: 20, y: 270, width: 16, height: 16 });
  const size = form.createRadioGroup('size');
  size.addOptionToPage('S', page, { x: 20, y: 220, width: 14, height: 14 });
  size.addOptionToPage('L', page, { x: 60, y: 220, width: 14, height: 14 });
  const city = form.createDropdown('city');
  city.addOptions(['Seoul', 'Busan']);
  city.addToPage(page, { x: 20, y: 170, width: 120, height: 20 });
  return Buffer.from(await doc.save());
}

async function openTool(page: Page) {
  await page.goto('/pdf/fill-form/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles({
    name: 'application.pdf',
    mimeType: 'application/pdf',
    buffer: await formPdf(),
  });
  await expect(frame.getByText('입력 칸 5개', { exact: false })).toBeVisible();
  return frame;
}

async function download(page: Page, frame: ReturnType<Page['frameLocator']>) {
  await frame.getByRole('button', { name: '양식 저장' }).click();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드' }).click();
  const file = await event;
  return {
    name: file.suggestedFilename(),
    bytes: new Uint8Array(await readFile(await file.path())),
  };
}

test('글자·체크·라디오·선택 칸을 채우고, 한글은 고른 글꼴로 넣는다', async ({ page, baseURL }) => {
  const requests: Request[] = [];
  page.on('request', (request) => requests.push(request));
  const frame = await openTool(page);
  requests.length = 0;
  await expect(frame.getByRole('button', { name: '양식 저장' })).toBeDisabled();

  await frame.getByLabel('name').fill('홍길동');
  // 한글을 적으면 글꼴을 고르게 한다
  await expect(
    frame.getByText('적은 글자를 쓰려면 아래에서 글꼴을 고르세요.', { exact: false }),
  ).toBeVisible();
  await frame.getByRole('button', { name: '기본 고딕 받기' }).click();
  await frame.getByLabel('agree').check();
  await frame.getByLabel('size: L').check();
  await frame.getByLabel('city').selectOption('Busan');
  await expect(frame.getByText('4칸을 고쳤습니다.', { exact: false })).toBeVisible();

  const { name, bytes } = await download(page, frame);
  expect(name).toBe('application_작성.pdf');
  const form = (await PDFDocument.load(bytes)).getForm();
  expect(form.getTextField('name').getText()).toBe('홍길동');
  expect(form.getCheckBox('agree').isChecked()).toBe(true);
  expect(form.getRadioGroup('size').getSelected()).toBe('L');
  expect(form.getDropdown('city').getSelected()).toEqual(['Busan']);
  expectLocalOnly(page, requests, baseURL!);
});

test('굳히면 칸이 사라지고 적은 글자가 쪽에 남는다', async ({ page }) => {
  const frame = await openTool(page);
  await frame.getByLabel('name').fill('Alice Kim');
  await frame.getByLabel('칸을 글자로 굳히기', { exact: false }).check();
  const { bytes } = await download(page, frame);
  expect((await PDFDocument.load(bytes)).getForm().getFields()).toHaveLength(0);
  const doc = await getDocument({ data: bytes.slice() }).promise;
  const content = await (await doc.getPage(1)).getTextContent();
  expect(content.items.map((item) => ('str' in item ? item.str : '')).join('')).toContain(
    'Alice Kim',
  );
});

test('입력 칸이 없는 PDF는 편집 도구를 안내한다', async ({ page }) => {
  await page.goto('/pdf/fill-form/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  const doc = await PDFDocument.create();
  doc.addPage([200, 200]);
  await frame.locator('input[type=file]').setInputFiles({
    name: 'plain.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await doc.save()),
  });
  await expect(frame.getByText('채울 수 있는 입력 칸이 없습니다', { exact: false })).toBeVisible();
});

test('한글을 굳히면 고른 글꼴로 그린 글자가 쪽에 남는다', async ({ page }) => {
  const frame = await openTool(page);
  await frame.getByLabel('name').fill('김철수');
  await frame.getByRole('button', { name: '기본 고딕 받기' }).click();
  await frame.getByLabel('칸을 글자로 굳히기', { exact: false }).check();
  const { bytes } = await download(page, frame);
  const doc = await getDocument({ data: bytes.slice() }).promise;
  const content = await (await doc.getPage(1)).getTextContent();
  expect(content.items.map((item) => ('str' in item ? item.str : '')).join('')).toContain('김철수');
});

test('선택 상자는 보이는 글자가 아니라 내보내는 값을 저장한다', async ({ page }) => {
  // 화면에는 "대한민국", PDF 값은 KR인 선택 상자
  const doc = await PDFDocument.create();
  const added = doc.addPage([400, 200]);
  const country = doc.getForm().createDropdown('country');
  country.addToPage(added, { x: 20, y: 100, width: 150, height: 22 });
  country.acroField.setOptions([
    { value: PDFHexString.fromText('KR'), display: PDFHexString.fromText('대한민국') },
    { value: PDFHexString.fromText('JP'), display: PDFHexString.fromText('일본') },
  ]);
  await page.goto('/pdf/fill-form/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles({
    name: 'country.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await doc.save()),
  });
  await frame.getByLabel('country').selectOption({ label: '대한민국' });
  await frame.getByRole('button', { name: '기본 고딕 받기' }).click();
  const { bytes } = await download(page, frame);
  const values = (await PDFDocument.load(bytes))
    .getForm()
    .getDropdown('country')
    .acroField.getValues()
    .map((value) => value.decodeText());
  expect(values).toEqual(['KR']);
});

test('같은 이름의 체크 상자는 누른 상자만 켠다', async ({ page }) => {
  // 이름은 같고 켜는 값이 A, B로 다른 체크 상자 두 개 (세금 양식 등에서 쓰는 방식)
  const doc = await PDFDocument.create();
  const added = doc.addPage([300, 200]);
  const context = doc.context;
  const look = context.register(
    context.stream('0 0 1 rg 0 0 14 14 re f', {
      Type: 'XObject',
      Subtype: 'Form',
      BBox: [0, 0, 14, 14],
    }),
  );
  const off = context.register(
    context.stream('', { Type: 'XObject', Subtype: 'Form', BBox: [0, 0, 14, 14] }),
  );
  const fieldRef = context.nextRef();
  const widget = (on: string, x: number) =>
    context.register(
      context.obj({
        Type: 'Annot',
        Subtype: 'Widget',
        F: 4,
        Rect: [x, 100, x + 14, 114],
        Parent: fieldRef,
        AS: 'Off',
        AP: { N: { [on]: look, Off: off } },
      }),
    );
  const a = widget('A', 20);
  const b = widget('B', 60);
  context.assign(
    fieldRef,
    context.obj({ FT: 'Btn', T: PDFHexString.fromText('choice'), Kids: [a, b] }),
  );
  added.node.set(PDFName.of('Annots'), context.obj([a, b]));
  doc.catalog.getOrCreateAcroForm().addField(fieldRef);

  await page.goto('/pdf/fill-form/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles({
    name: 'boxes.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await doc.save()),
  });
  await frame.getByLabel('choice: B').check();
  await expect(frame.getByLabel('choice: A')).not.toBeChecked();
  const { bytes } = await download(page, frame);
  const saved = await PDFDocument.load(bytes);
  const field = saved.getForm().getCheckBox('choice');
  expect(field.acroField.getValue().toString()).toBe('/B');
  expect(field.acroField.getWidgets().map((w) => w.getAppearanceState()?.toString())).toEqual([
    '/Off',
    '/B',
  ]);
});

test('직접 적을 수 있는 선택 상자에는 선택지에 없는 글자도 적는다', async ({ page }) => {
  const doc = await PDFDocument.create();
  const added = doc.addPage([400, 200]);
  const dept = doc.getForm().createDropdown('dept');
  dept.addOptions(['Sales', 'Support']);
  dept.enableEditing();
  dept.addToPage(added, { x: 20, y: 100, width: 150, height: 22 });
  await page.goto('/pdf/fill-form/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles({
    name: 'dept.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await doc.save()),
  });
  await frame.getByLabel('dept').fill('Research Lab');
  const { bytes } = await download(page, frame);
  expect((await PDFDocument.load(bytes)).getForm().getDropdown('dept').getSelected()).toEqual([
    'Research Lab',
  ]);
});

test('암호 칸은 적은 글자를 가려 보여 준다', async ({ page }) => {
  const doc = await PDFDocument.create();
  const added = doc.addPage([300, 200]);
  const pin = doc.getForm().createTextField('pin');
  pin.enablePassword();
  pin.addToPage(added, { x: 20, y: 100, width: 120, height: 24 });
  await page.goto('/pdf/fill-form/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles({
    name: 'pin.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await doc.save()),
  });
  await expect(frame.getByLabel('pin')).toHaveAttribute('type', 'password');
});

test('굳힐 때 모양을 다시 만들어야 하는 기존 한글 값이 있으면 글꼴을 고르게 한다', async ({
  page,
}) => {
  // 이미 적힌 한글 값(모양 없음)이 있는 칸과, 빈 칸 하나
  const doc = await PDFDocument.create();
  const added = doc.addPage([300, 200]);
  const form = doc.getForm();
  const name = form.createTextField('name');
  name.addToPage(added, { x: 20, y: 120, width: 200, height: 24 });
  name.setText('홍길동');
  for (const widget of name.acroField.getWidgets()) widget.dict.delete(PDFName.of('AP'));
  form.createTextField('note').addToPage(added, { x: 20, y: 60, width: 200, height: 24 });
  await page.goto('/pdf/fill-form/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles({
    name: 'old.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await doc.save({ updateFieldAppearances: false })),
  });
  await frame.getByLabel('note').fill('ok');
  await frame.getByLabel('칸을 글자로 굳히기', { exact: false }).check();
  await frame.getByRole('button', { name: '양식 저장' }).click();
  // 기본 글꼴에 없는 기존 값 때문에 글꼴을 고르게 한다
  await frame.getByRole('button', { name: '기본 고딕 받기' }).click();
  const { bytes } = await download(page, frame);
  const saved = await getDocument({ data: bytes.slice() }).promise;
  const content = await (await saved.getPage(1)).getTextContent();
  expect(content.items.map((item) => ('str' in item ? item.str : '')).join('')).toContain('홍길동');
});

test('암호 칸을 굳히면 적은 글자 대신 가린 글자가 쪽에 남는다', async ({ page }) => {
  const doc = await PDFDocument.create();
  const added = doc.addPage([300, 200]);
  const pin = doc.getForm().createTextField('pin');
  pin.enablePassword();
  pin.addToPage(added, { x: 20, y: 100, width: 160, height: 24 });
  await page.goto('/pdf/fill-form/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles({
    name: 'pin.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await doc.save()),
  });
  await frame.getByLabel('pin').fill('S3cret99');
  await frame.getByLabel('칸을 글자로 굳히기', { exact: false }).check();
  const { bytes } = await download(page, frame);
  const saved = await getDocument({ data: bytes.slice() }).promise;
  const content = await (await saved.getPage(1)).getTextContent();
  const text = content.items.map((item) => ('str' in item ? item.str : '')).join('');
  expect(text).not.toContain('S3cret99');
  expect(text).toContain('********');
});

test('바꾸지 않은 선택 상자의 모양을 다시 만들 때도 보이는 글자로 그린다', async ({ page }) => {
  // 값은 KR(화면에는 "대한민국")이고 모양이 없는 선택 상자와, 빈 글자 칸
  const doc = await PDFDocument.create();
  const added = doc.addPage([400, 200]);
  const form = doc.getForm();
  const country = form.createDropdown('country');
  country.addToPage(added, { x: 20, y: 120, width: 150, height: 22 });
  country.acroField.setOptions([
    { value: PDFHexString.fromText('KR'), display: PDFHexString.fromText('대한민국') },
    { value: PDFHexString.fromText('JP'), display: PDFHexString.fromText('일본') },
  ]);
  country.acroField.dict.set(PDFName.of('V'), PDFHexString.fromText('KR'));
  for (const widget of country.acroField.getWidgets()) widget.dict.delete(PDFName.of('AP'));
  form.createTextField('note').addToPage(added, { x: 20, y: 60, width: 200, height: 24 });
  await page.goto('/pdf/fill-form/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles({
    name: 'country.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await doc.save({ updateFieldAppearances: false })),
  });
  await frame.getByLabel('note').fill('ok');
  await frame.getByLabel('칸을 글자로 굳히기', { exact: false }).check();
  await frame.getByRole('button', { name: '양식 저장' }).click();
  await frame.getByRole('button', { name: '기본 고딕 받기' }).click();
  const { bytes } = await download(page, frame);
  const saved = await getDocument({ data: bytes.slice() }).promise;
  const content = await (await saved.getPage(1)).getTextContent();
  const text = content.items.map((item) => ('str' in item ? item.str : '')).join('');
  expect(text).toContain('대한민국');
  expect(text).not.toContain('KR');
});

test('읽기 전용 선택 상자와 목록도 모양을 다시 만들 때 보이는 글자로 그린다', async ({ page }) => {
  const doc = await PDFDocument.create();
  const added = doc.addPage([400, 300]);
  const form = doc.getForm();
  const options = [
    { value: PDFHexString.fromText('KR'), display: PDFHexString.fromText('대한민국') },
    { value: PDFHexString.fromText('JP'), display: PDFHexString.fromText('일본') },
  ];
  const country = form.createDropdown('country');
  country.addToPage(added, { x: 20, y: 220, width: 150, height: 22 });
  country.acroField.setOptions(options);
  country.acroField.dict.set(PDFName.of('V'), PDFHexString.fromText('KR'));
  country.enableReadOnly();
  const visited = form.createOptionList('visited');
  visited.addToPage(added, { x: 200, y: 160, width: 150, height: 60 });
  visited.acroField.setOptions(options);
  visited.acroField.dict.set(PDFName.of('V'), PDFHexString.fromText('JP'));
  for (const field of [country, visited]) {
    for (const widget of field.acroField.getWidgets()) widget.dict.delete(PDFName.of('AP'));
  }
  form.createTextField('note').addToPage(added, { x: 20, y: 60, width: 200, height: 24 });
  await page.goto('/pdf/fill-form/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles({
    name: 'readonly.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await doc.save({ updateFieldAppearances: false })),
  });
  await frame.getByLabel('note').fill('ok');
  await frame.getByLabel('칸을 글자로 굳히기', { exact: false }).check();
  await frame.getByRole('button', { name: '양식 저장' }).click();
  await frame.getByRole('button', { name: '기본 고딕 받기' }).click();
  const { bytes } = await download(page, frame);
  const saved = await getDocument({ data: bytes.slice() }).promise;
  const content = await (await saved.getPage(1)).getTextContent();
  const text = content.items.map((item) => ('str' in item ? item.str : '')).join('');
  expect(text).toContain('대한민국');
  expect(text).not.toContain('KR');
});

test('한글 암호는 글꼴 없이 가려 저장하고, 암호 칸은 PDF 칸 크기에 맞춘다', async ({ page }) => {
  const doc = await PDFDocument.create();
  const added = doc.addPage([300, 200]);
  const pin = doc.getForm().createTextField('pin');
  pin.enablePassword();
  pin.addToPage(added, { x: 20, y: 100, width: 60, height: 16 });
  await page.goto('/pdf/fill-form/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles({
    name: 'pin.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await doc.save()),
  });
  const input = frame.getByLabel('pin');
  const [inputBox, fieldBox] = await Promise.all([
    input.boundingBox(),
    frame.locator('.field-box').first().boundingBox(),
  ]);
  expect(inputBox!.width).toBeLessThanOrEqual(fieldBox!.width + 0.5);
  expect(inputBox!.height).toBeLessThanOrEqual(fieldBox!.height + 0.5);
  await input.fill('비밀번호1');
  await expect(frame.getByRole('button', { name: '기본 고딕 받기' })).toHaveCount(0);
  await frame.getByLabel('칸을 글자로 굳히기', { exact: false }).check();
  const { bytes } = await download(page, frame);
  const saved = await getDocument({ data: bytes.slice() }).promise;
  const content = await (await saved.getPage(1)).getTextContent();
  expect(content.items.map((item) => ('str' in item ? item.str : '')).join('')).toContain('*****');
});

test('끌 수 있는 라디오는 고른 단추를 다시 눌러 고르지 않은 상태로 돌린다', async ({ page }) => {
  const doc = await PDFDocument.create();
  const added = doc.addPage([300, 200]);
  const form = doc.getForm();
  const optional = form.createRadioGroup('optional');
  optional.enableOffToggling();
  optional.addOptionToPage('A', added, { x: 20, y: 120, width: 14, height: 14 });
  const required = form.createRadioGroup('required');
  required.disableOffToggling();
  required.addOptionToPage('B', added, { x: 20, y: 60, width: 14, height: 14 });
  await page.goto('/pdf/fill-form/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles({
    name: 'radio.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await doc.save()),
  });
  const a = frame.getByLabel('optional: A');
  await a.click();
  await expect(a).toBeChecked();
  await a.click();
  await expect(a).not.toBeChecked();
  const b = frame.getByLabel('required: B');
  await b.click();
  await b.click();
  await expect(b).toBeChecked();
  const { bytes } = await download(page, frame);
  const saved = (await PDFDocument.load(bytes)).getForm();
  expect(saved.getRadioGroup('optional').getSelected()).toBeUndefined();
  expect(saved.getRadioGroup('required').getSelected()).toBe('B');
});

test('__proto__·constructor 같은 이름의 칸도 지금 값을 보여 주고 고쳐 저장한다', async ({
  page,
}) => {
  const doc = await PDFDocument.create();
  const added = doc.addPage([300, 200]);
  const form = doc.getForm();
  const proto = form.createTextField('__proto__');
  proto.setText('old proto');
  proto.addToPage(added, { x: 20, y: 120, width: 200, height: 24 });
  const ctor = form.createTextField('constructor');
  ctor.setText('old ctor');
  ctor.addToPage(added, { x: 20, y: 60, width: 200, height: 24 });
  await page.goto('/pdf/fill-form/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles({
    name: 'names.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await doc.save()),
  });
  await expect(frame.getByLabel('__proto__')).toHaveValue('old proto');
  await expect(frame.getByLabel('constructor')).toHaveValue('old ctor');
  await frame.getByLabel('__proto__').fill('new proto');
  await expect(frame.getByText('1칸을 고쳤습니다.', { exact: false })).toBeVisible();
  const { bytes } = await download(page, frame);
  const saved = (await PDFDocument.load(bytes)).getForm();
  expect(saved.getTextField('__proto__').getText()).toBe('new proto');
  expect(saved.getTextField('constructor').getText()).toBe('old ctor');
});
