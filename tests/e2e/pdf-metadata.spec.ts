/**
 * PDF 문서 정보 E2E. 빌드 결과에서 돌린다 (playwright.config.ts 참고).
 *
 * 받은 PDF의 Info를 pdf-lib로 읽어, 적은 값이 들어갔는지와 "모두 지우기"가 숨은 정보를 지웠는지 확인한다.
 */
import { expect, test, type Page, type Request } from './test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFString } from '@cantoo/pdf-lib';
import { expectLocalOnly } from './local-only';

const infoOf = (doc: PDFDocument) => doc.context.lookup(doc.context.trailerInfo.Info) as PDFDict;

async function infoPdf() {
  const doc = await PDFDocument.create();
  doc.addPage([200, 200]);
  doc.setTitle('Old title');
  doc.setAuthor('Kim Secret');
  doc.setCreator('Secret Office 2026');
  doc.setProducer('Secret PDF Maker');
  // 세계 표준시 03:04:05 (서울 12:04)
  infoOf(doc).set(PDFName.of('CreationDate'), PDFString.of('D:20260102030405Z'));
  // 쪽에 바로 적힌 고친 시각
  doc.getPage(0).node.set(PDFName.of('LastModified'), PDFString.of("D:20251231235959+09'00'"));
  // 메모 주석의 작성자·시각, 입력 칸(이름은 남아야 한다)
  doc.getPage(0).node.set(
    PDFName.of('Annots'),
    doc.context.obj([
      doc.context.obj({
        Type: 'Annot',
        Subtype: 'Text',
        Rect: [10, 10, 30, 30],
        T: PDFString.of('Annot Author Yoon'),
        NM: PDFString.of('NM-Unique-Yoon'),
        M: PDFString.of('D:20240101000000Z'),
        CreationDate: PDFString.of('D:20240102000000Z'),
      }),
    ]),
  );
  doc.getForm().createTextField('field_keep').addToPage(doc.getPage(0), { x: 50, y: 50 });
  // 첨부 파일의 만든·고친 날짜
  await doc.attach(new TextEncoder().encode('hello'), 'note.txt', {
    mimeType: 'text/plain',
    creationDate: new Date(Date.UTC(2023, 2, 4, 5, 6, 7)),
    modificationDate: new Date(Date.UTC(2023, 2, 5, 5, 6, 7)),
  });
  // 기사 흐름 정보, 전자 서명 사전, 웹에서 받은 기록
  doc.catalog.set(
    PDFName.of('Threads'),
    doc.context.obj([
      doc.context.register(
        doc.context.obj({ Type: 'Thread', I: { Title: PDFString.of('Thread Secret Title') } }),
      ),
    ]),
  );
  const sigField = doc.context.register(
    doc.context.obj({
      Type: 'Annot',
      Subtype: 'Widget',
      FT: 'Sig',
      T: PDFString.of('sig_field'),
      Rect: [0, 0, 0, 0],
      V: doc.context.obj({
        Type: 'Sig',
        Filter: 'Adobe.PPKLite',
        ByteRange: [0, 0, 0, 0],
        Name: PDFString.of('Signer Secret Kim'),
        Reason: PDFString.of('Secret Reason'),
        M: PDFString.of('D:20240505000000Z'),
      }),
    }),
  );
  doc.getPage(0).node.lookup(PDFName.of('Annots'), PDFArray).push(sigField);
  doc.catalog.set(
    PDFName.of('SpiderInfo'),
    doc.context.obj({ V: 1.1, Note: PDFString.of('Spider Secret') }),
  );
  // 원본 파일 식별자
  const original = PDFHexString.of('0123456789ABCDEF0123456789ABCDEF');
  doc.context.trailerInfo.ID = doc.context.obj([original, original]);
  // 워드 등이 더하는 사용자 정의 항목
  infoOf(doc).set(PDFName.of('Company'), PDFString.of('Secret Corp'));
  // 쪽에 붙은 XMP
  doc.getPage(0).node.set(
    PDFName.of('Metadata'),
    doc.context.register(
      doc.context.stream('<x:xmpmeta><dc:creator>Page XMP Lee</dc:creator></x:xmpmeta>', {
        Type: 'Metadata',
        Subtype: 'XML',
      }),
    ),
  );
  // 쪽 자원 목록 안에 바로 들어 있는 사전이 가리키는 XMP
  doc.getPage(0).node.set(
    PDFName.of('PieceInfo'),
    doc.context.obj({
      App: {
        LastModified: PDFString.of('D:20260101000000Z'),
        Private: { Company: PDFString.of('PieceInfo Corp Secret') },
        Metadata: doc.context.register(
          doc.context.stream('<x:xmpmeta><dc:creator>Nested XMP Choi</dc:creator></x:xmpmeta>', {
            Type: 'Metadata',
            Subtype: 'XML',
          }),
        ),
      },
    }),
  );
  // 고친 기록에서 참조를 잃은 옛 XMP
  doc.context.register(
    doc.context.stream('<x:xmpmeta><dc:creator>Orphan XMP Park</dc:creator></x:xmpmeta>', {
      Type: 'Metadata',
      Subtype: 'XML',
    }),
  );
  // 따로 된 객체로 들어 있는 XMP (참조만 끊으면 파일에 남는다)
  doc.catalog.set(
    PDFName.of('Metadata'),
    doc.context.register(
      doc.context.stream('<x:xmpmeta><dc:creator>XMP Secret Kim</dc:creator></x:xmpmeta>', {
        Type: 'Metadata',
        Subtype: 'XML',
      }),
    ),
  );
  return Buffer.from(await doc.save({ updateFieldAppearances: false }));
}

async function openTool(page: Page) {
  await page.goto('/pdf/metadata/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles({
    name: 'report.pdf',
    mimeType: 'application/pdf',
    buffer: await infoPdf(),
  });
  await expect(frame.getByLabel('제목')).toHaveValue('Old title');
  return frame;
}

async function download(page: Page, frame: ReturnType<Page['frameLocator']>) {
  await frame.getByRole('button', { name: '저장', exact: true }).click();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드' }).click();
  const file = await event;
  const bytes = new Uint8Array(await readFile(await file.path()));
  return {
    name: file.suggestedFilename(),
    bytes,
    doc: await PDFDocument.load(bytes, { updateMetadata: false }),
  };
}

test('제목·작성자를 바꾸고, 비운 칸은 지운다', async ({ page, baseURL }) => {
  const requests: Request[] = [];
  page.on('request', (request) => requests.push(request));
  const frame = await openTool(page);
  requests.length = 0;
  await expect(frame.getByText('Secret Office 2026')).toBeVisible();
  await frame.getByLabel('제목').fill('2026년 3분기 보고서');
  await frame.getByLabel('작성자').fill('');
  await frame.getByLabel('키워드 (쉼표로 구분)').fill('보고서, 분기');
  const { name, doc } = await download(page, frame);
  expect(name).toBe('report_정보.pdf');
  expect(doc.getTitle()).toBe('2026년 3분기 보고서');
  expect(doc.getAuthor()).toBeUndefined();
  expect(doc.getKeywords()).toBe('보고서, 분기');
  // 만든 프로그램은 그대로 둔다 (pdf-lib가 자기 이름으로 바꾸지 않게)
  expect(doc.getCreator()).toBe('Secret Office 2026');
  expectLocalOnly(page, requests, baseURL!);
});

test('모두 지우기는 만든 프로그램·날짜·사용자 정의 항목까지 지운다', async ({ page }) => {
  const frame = await openTool(page);
  await frame.getByLabel('문서 정보 모두 지우기', { exact: false }).check();
  await expect(frame.getByLabel('제목')).toBeDisabled();
  const { doc, bytes } = await download(page, frame);
  expect(doc.getTitle()).toBeUndefined();
  expect(doc.getAuthor()).toBeUndefined();
  expect(doc.getCreator()).toBeUndefined();
  expect(doc.getProducer()).toBeUndefined();
  expect(doc.getCreationDate()).toBeUndefined();
  expect(infoOf(doc).get(PDFName.of('Company'))).toBeUndefined();
  expect(doc.catalog.get(PDFName.of('Metadata'))).toBeUndefined();
  expect(Buffer.from(bytes).toString('latin1')).not.toContain('XMP Secret Kim');
  expect(Buffer.from(bytes).toString('latin1')).not.toContain('Page XMP Lee');
  expect(Buffer.from(bytes).toString('latin1')).not.toContain('Orphan XMP Park');
  expect(Buffer.from(bytes).toString('latin1')).not.toContain('Nested XMP Choi');
  expect(Buffer.from(bytes).toString('latin1')).not.toContain('PieceInfo Corp Secret');
  expect(Buffer.from(bytes).toString('latin1')).not.toContain('0123456789ABCDEF0123456789ABCDEF');
  expect(Buffer.from(bytes).toString('latin1')).not.toContain('D:20251231235959');
  expect(Buffer.from(bytes).toString('latin1')).not.toContain('Annot Author Yoon');
  for (const secret of [
    'NM-Unique-Yoon',
    'Thread Secret Title',
    'Signer Secret Kim',
    'Secret Reason',
    'D:20240505000000Z',
    'Spider Secret',
  ]) {
    expect(Buffer.from(bytes).toString('latin1')).not.toContain(secret);
  }
  expect(Buffer.from(bytes).toString('latin1')).not.toContain('D:20240102000000Z');
  expect(Buffer.from(bytes).toString('latin1')).not.toContain('D:2023030');
  expect(doc.getForm().getTextField('field_keep')).toBeDefined();
});

test.describe('서울 시간대에서', () => {
  test.use({ timezoneId: 'Asia/Seoul' });

  test('시간대가 적힌 날짜를 이 기기의 시각으로 보여 준다', async ({ page }) => {
    const frame = await openTool(page);
    await expect(frame.getByText('오후 12:04', { exact: false })).toBeVisible();
  });
});

test('Info에 없고 XMP에만 있는 제목·작성자도 읽어 칸에 채운다', async ({ page }) => {
  const doc = await PDFDocument.create({ updateMetadata: false });
  doc.addPage([200, 200]);
  const xmp = `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:title><rdf:Alt><rdf:li xml:lang="x-default">XMP Title</rdf:li></rdf:Alt></dc:title>
<dc:creator><rdf:Seq><rdf:li>Lee XMP</rdf:li></rdf:Seq></dc:creator>
<dc:subject><rdf:Bag><rdf:li>alpha</rdf:li><rdf:li>beta</rdf:li></rdf:Bag></dc:subject>
</rdf:Description>
<rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
<xmp:CreatorTool>XMP Writer 9</xmp:CreatorTool>
<pdf:Producer>XMP Producer 3</pdf:Producer>
<xmp:CreateDate>2025-05-06T07:08:09Z</xmp:CreateDate>
</rdf:Description></rdf:RDF></x:xmpmeta>
<?xpacket end="w"?>`;
  doc.catalog.set(
    PDFName.of('Metadata'),
    doc.context.register(doc.context.stream(xmp, { Type: 'Metadata', Subtype: 'XML' })),
  );
  await page.goto('/pdf/metadata/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles({
    name: 'xmp.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await doc.save()),
  });
  await expect(frame.getByLabel('제목')).toHaveValue('XMP Title');
  await expect(frame.getByLabel('작성자')).toHaveValue('Lee XMP');
  await expect(frame.getByLabel('키워드 (쉼표로 구분)')).toHaveValue('alpha, beta');
  // 고칠 수 없는 정보(만든 프로그램·날짜)도 XMP에서 읽어 보여 준다
  await expect(frame.getByText('XMP Writer 9')).toBeVisible();
  await expect(frame.getByText('XMP Producer 3')).toBeVisible();
  await expect(frame.getByText('2025', { exact: false })).toBeVisible();
  // 다른 칸만 고쳐 저장해도 XMP에 있던 제목·작성자가 Info로 옮겨진다
  await frame.getByLabel('주제').fill('report');
  const { doc: saved } = await download(page, frame);
  expect(saved.getTitle()).toBe('XMP Title');
  expect(saved.getAuthor()).toBe('Lee XMP');
});

test('제목만 바꿀 때 쪽과 같이 쓰는 XMP 객체는 지우지 않는다', async ({ page }) => {
  const doc = await PDFDocument.create();
  doc.addPage([200, 200]);
  doc.setTitle('Old title');
  const shared = doc.context.register(
    doc.context.stream('<x:xmpmeta/>', { Type: 'Metadata', Subtype: 'XML' }),
  );
  doc.catalog.set(PDFName.of('Metadata'), shared);
  doc.getPage(0).node.set(PDFName.of('Metadata'), shared);
  await page.goto('/pdf/metadata/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles({
    name: 'shared.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await doc.save({ updateFieldAppearances: false })),
  });
  await frame.getByLabel('제목').fill('New title');
  const { doc: saved } = await download(page, frame);
  expect(saved.getTitle()).toBe('New title');
  expect(saved.catalog.get(PDFName.of('Metadata'))).toBeUndefined();
  // 쪽이 가리키는 XMP는 그대로 남아 있다
  const pageXmp = saved.getPage(0).node.get(PDFName.of('Metadata'));
  expect(saved.context.lookup(pageXmp)).toBeDefined();
});

test('암호가 걸린 PDF는 저장하면 암호가 풀린다고 알린다', async ({ page }) => {
  await page.goto('/pdf/metadata/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame
    .locator('input[type=file]')
    .setInputFiles(fileURLToPath(new URL('../fixtures/encrypted.pdf', import.meta.url)));
  await frame.getByLabel('PDF 암호').fill('1234');
  await frame.getByLabel('PDF 암호').press('Enter');
  await expect(
    frame.getByText('암호와 인쇄·복사 제한은 저장한 파일에서 풀립니다', { exact: false }),
  ).toBeVisible();
});

test('암호가 없는 PDF에는 암호 안내를 보이지 않는다', async ({ page }) => {
  const frame = await openTool(page);
  await expect(frame.getByText('저장한 파일에서 풀립니다', { exact: false })).toHaveCount(0);
});

test.describe('세계 표준시보다 느린 시간대에서', () => {
  test.use({ timezoneId: 'America/Los_Angeles' });

  test('시간대 없이 날짜만 적힌 XMP 날짜는 그날 그대로 보여 준다', async ({ page }) => {
    const doc = await PDFDocument.create({ updateMetadata: false });
    doc.addPage([200, 200]);
    const xmp = `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/">
<xmp:CreateDate>2025-05-06</xmp:CreateDate>
<xmp:ModifyDate>2025-07</xmp:ModifyDate>
</rdf:Description></rdf:RDF></x:xmpmeta>`;
    doc.catalog.set(
      PDFName.of('Metadata'),
      doc.context.register(doc.context.stream(xmp, { Type: 'Metadata', Subtype: 'XML' })),
    );
    await page.goto('/pdf/metadata/');
    const frame = page.frameLocator('iframe[data-tool-frame]');
    await frame.locator('input[type=file]').setInputFiles({
      name: 'date-only.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from(await doc.save()),
    });
    await expect(frame.getByText('2025. 5. 6.')).toBeVisible();
    // 연월만 적혔으면 연월만
    await expect(frame.getByText('2025년 7월', { exact: true })).toBeVisible();
  });

  test('축약된 PDF 날짜는 적힌 만큼만 보여 준다', async ({ page }) => {
    const doc = await PDFDocument.create();
    doc.addPage([200, 200]);
    const info = infoOf(doc);
    info.set(PDFName.of('CreationDate'), PDFString.of('D:2025'));
    info.set(PDFName.of('ModDate'), PDFString.of('D:202505'));
    await page.goto('/pdf/metadata/');
    const frame = page.frameLocator('iframe[data-tool-frame]');
    await frame.locator('input[type=file]').setInputFiles({
      name: 'short-date.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from(await doc.save({ updateFieldAppearances: false })),
    });
    await expect(frame.getByText('2025년', { exact: true })).toBeVisible();
    await expect(frame.getByText('2025년 5월', { exact: true })).toBeVisible();
  });
});
