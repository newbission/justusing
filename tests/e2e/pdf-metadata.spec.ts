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
import { signedPdf } from './signed-pdf';

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
        Subj: PDFString.of('Subject Case Hong'),
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
      // /Type은 적지 않아도 된다
      doc.context.register(
        doc.context.obj({ I: { Author: PDFString.of('Untyped Thread Author') } }),
      ),
    ]),
  );
  // 쪽의 기사 조각이 가리키는 기사 흐름
  const beadThread = doc.context.register(
    doc.context.obj({ I: { Title: PDFString.of('Bead Thread Title') } }),
  );
  doc
    .getPage(0)
    .node.set(
      PDFName.of('B'),
      doc.context.obj([doc.context.obj({ T: beadThread, R: [0, 0, 100, 100] })]),
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
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  // 결과는 객체를 압축 묶음(object stream)에 넣으므로, 글자로 찾으려면 풀어서 다시 쓴다.
  // 다시 쓰기는 아무도 가리키지 않는 객체까지 모두 쓰므로 파일에 남은 것을 빠짐없이 본다
  const plain = await (
    await PDFDocument.load(bytes, { updateMetadata: false })
  ).save({ useObjectStreams: false, updateFieldAppearances: false });
  return {
    name: file.suggestedFilename(),
    bytes,
    doc,
    text: Buffer.from(plain).toString('latin1'),
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
  const { doc, text } = await download(page, frame);
  expect(doc.getTitle()).toBeUndefined();
  expect(doc.getAuthor()).toBeUndefined();
  expect(doc.getCreator()).toBeUndefined();
  expect(doc.getProducer()).toBeUndefined();
  expect(doc.getCreationDate()).toBeUndefined();
  expect(infoOf(doc).get(PDFName.of('Company'))).toBeUndefined();
  expect(doc.catalog.get(PDFName.of('Metadata'))).toBeUndefined();
  expect(text).not.toContain('XMP Secret Kim');
  expect(text).not.toContain('Page XMP Lee');
  expect(text).not.toContain('Orphan XMP Park');
  expect(text).not.toContain('Nested XMP Choi');
  expect(text).not.toContain('PieceInfo Corp Secret');
  expect(text).not.toContain('0123456789ABCDEF0123456789ABCDEF');
  expect(text).not.toContain('D:20251231235959');
  expect(text).not.toContain('Annot Author Yoon');
  for (const secret of [
    'NM-Unique-Yoon',
    'Subject Case Hong',
    'Untyped Thread Author',
    'Bead Thread Title',
    'Thread Secret Title',
    'Signer Secret Kim',
    'Secret Reason',
    'D:20240505000000Z',
    'Spider Secret',
  ]) {
    expect(text).not.toContain(secret);
  }
  expect(text).not.toContain('D:20240102000000Z');
  expect(text).not.toContain('D:2023030');
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

test('서명된 PDF는 서명이 깨진다고 알리고, 모두 지우기는 서명한 사람의 인증서까지 지운다', async ({
  page,
}) => {
  await page.goto('/pdf/metadata/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles({
    name: 'contract.pdf',
    mimeType: 'application/pdf',
    buffer: await signedPdf(),
  });
  await expect(frame.getByText('전자 서명된 PDF입니다', { exact: false })).toBeVisible();
  await frame.getByLabel('문서 정보 모두 지우기', { exact: false }).check();
  const { doc, text } = await download(page, frame);
  for (const secret of [
    'Cert Holder Park',
    '5369676E65722043657274205061726B',
    'Signer Secret Kim',
    'Seed Reason Lee',
    'DSS Cert Choi',
    'Legal Note Jung',
  ]) {
    expect(text).not.toContain(secret);
  }
  for (const key of ['Perms', 'DSS', 'Legal']) {
    expect(doc.catalog.get(PDFName.of(key))).toBeUndefined();
  }
});

test('모두 지우기는 서명 칸 형식을 위 칸에서 물려받은 위젯의 서명 값·서명 조건도 지운다', async ({
  page,
}) => {
  const doc = await PDFDocument.load(await signedPdf());
  const { context } = doc;
  const form = doc.catalog.lookup(PDFName.of('AcroForm'), PDFDict);
  const fields = form.lookup(PDFName.of('Fields'), PDFArray);
  const widgetRef = fields.get(0);
  const widget = context.lookup(widgetRef, PDFDict);
  // 서명 칸 형식(/FT /Sig)은 위 칸에만 적고, 서명 값(/V)과 서명 조건(/SV)은 아래 위젯에 둔다
  widget.delete(PDFName.of('FT'));
  widget.set(
    PDFName.of('SV'),
    context.obj({ Type: 'SV', Cert: { Subject: [PDFString.of('Seed Cert Oh')] } }),
  );
  const parentRef = context.register(
    context.obj({ FT: 'Sig', T: PDFString.of('sig_parent'), Kids: [widgetRef] }),
  );
  widget.set(PDFName.of('Parent'), parentRef);
  form.set(PDFName.of('Fields'), context.obj([parentRef]));
  await page.goto('/pdf/metadata/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles({
    name: 'contract.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await doc.save({ updateFieldAppearances: false })),
  });
  await expect(frame.getByText('전자 서명된 PDF입니다', { exact: false })).toBeVisible();
  await frame.getByLabel('문서 정보 모두 지우기', { exact: false }).check();
  const { text } = await download(page, frame);
  for (const secret of ['Seed Cert Oh', 'Cert Holder Park', 'Signer Secret Kim']) {
    expect(text).not.toContain(secret);
  }
});

test('모두 지우기는 레이어를 만든 프로그램·대상 사람과 문서 부분 정보도 지운다', async ({
  page,
}) => {
  const doc = await PDFDocument.create();
  doc.addPage([200, 200]);
  const { context } = doc;
  const layer = context.register(
    context.obj({
      Type: 'OCG',
      Name: PDFString.of('Layer 1'),
      Usage: {
        CreatorInfo: { Creator: PDFString.of('Layer Secret Office'), Subtype: 'Artwork' },
        User: { Type: 'Ind', Name: PDFString.of('Layer User Choi') },
      },
    }),
  );
  doc.catalog.set(PDFName.of('OCProperties'), context.obj({ OCGs: [layer], D: { ON: [layer] } }));
  doc.catalog.set(
    PDFName.of('DPartRoot'),
    context.obj({
      Type: 'DPartRoot',
      DPartRootNode: {
        Type: 'DPart',
        DPM: { Owner: PDFString.of('DPM Secret Owner') },
        Start: doc.getPage(0).ref,
      },
    }),
  );
  await page.goto('/pdf/metadata/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles({
    name: 'layers.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await doc.save()),
  });
  await frame.getByLabel('문서 정보 모두 지우기', { exact: false }).check();
  const { doc: saved, text } = await download(page, frame);
  for (const secret of ['Layer Secret Office', 'Layer User Choi', 'DPM Secret Owner']) {
    expect(text).not.toContain(secret);
  }
  // 레이어 자체(이름·보이기 설정)는 남는다
  expect(text).toContain('Layer 1');
  expect(saved.catalog.get(PDFName.of('OCProperties'))).toBeDefined();
});

test('모두 지우기는 PDF 안 JPEG 사진의 촬영 정보도 지우고, 사진은 다시 압축하지 않는다', async ({
  page,
}) => {
  const photo = await readFile(fileURLToPath(new URL('../fixtures/small.jpg', import.meta.url)));
  const segment = (marker: number, text: string) => {
    const body = Buffer.from(text, 'latin1');
    return Buffer.concat([Buffer.from([0xff, marker, 0, body.length + 2]), body]);
  };
  // 휴대폰 사진처럼 촬영 정보·설명 조각을 넣는다 (표시 앞 채움 바이트 FF도 하나)
  const tagged = Buffer.concat([
    photo.subarray(0, 2),
    segment(0xe1, 'Exif\0\0GPS-SECRET-SEOUL'),
    segment(0xe1, 'http://ns.adobe.com/xap/1.0/\0XMP-PHOTO-SECRET'),
    segment(0xed, 'Photoshop 3.0\0IPTC-SECRET'),
    Buffer.from([0xff]),
    segment(0xfe, 'COMMENT-SECRET'),
    photo.subarray(2),
  ]);
  const doc = await PDFDocument.create();
  const jpeg = (dict: Record<string, string | number>) =>
    doc.context.register(
      doc.context.stream(tagged, {
        Filter: 'DCTDecode',
        Width: 400,
        Height: 300,
        BitsPerComponent: 8,
        ColorSpace: 'DeviceRGB',
        ...dict,
      }),
    );
  const page1 = doc.addPage([200, 200]);
  page1.node.set(
    PDFName.of('Resources'),
    doc.context.obj({ XObject: { Im1: jpeg({ Type: 'XObject', Subtype: 'Image' }) } }),
  );
  page1.node.set(
    PDFName.of('Contents'),
    doc.context.register(doc.context.stream('q 100 0 0 75 0 0 cm /Im1 Do Q')),
  );
  // 쪽 미리보기 그림(/Thumb)도 JPEG일 수 있다
  page1.node.set(PDFName.of('Thumb'), jpeg({}));

  await page.goto('/pdf/metadata/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles({
    name: 'photo.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await doc.save()),
  });
  await frame.getByLabel('문서 정보 모두 지우기', { exact: false }).check();
  const { text } = await download(page, frame);
  for (const secret of ['GPS-SECRET-SEOUL', 'XMP-PHOTO-SECRET', 'IPTC-SECRET', 'COMMENT-SECRET']) {
    expect(text).not.toContain(secret);
  }
  // 색을 정하는 JFIF 조각과, 표부터 끝까지의 그림 자료는 바이트 그대로 남는다
  const latin = (bytes: Uint8Array) => Buffer.from(bytes).toString('latin1');
  expect(text).toContain(latin(photo.subarray(2, 20)));
  expect(text).toContain(latin(photo.subarray(20)));
});

test('모두 지우기는 pdfTeX가 넣은 그림 정보·층 설정을 만든 프로그램·웹 기록도 지운다', async ({
  page,
}) => {
  const doc = await PDFDocument.create();
  const context = doc.context;
  const form = context.register(
    context.stream('0 0 1 1 re f', {
      Type: 'XObject',
      Subtype: 'Form',
      BBox: [0, 0, 1, 1],
      'PTEX.FileName': PDFString.of('/Users/hong/thesis/figure-secret.pdf'),
      'PTEX.InfoDict': context.obj({ Author: PDFString.of('Ptex Author Hong') }),
    }),
  );
  const added = doc.addPage([200, 200]);
  added.node.set(PDFName.of('Resources'), context.obj({ XObject: { Fig: form } }));
  added.node.set(PDFName.of('Contents'), context.register(context.stream('/Fig Do')));
  const layer = context.register(context.obj({ Type: 'OCG', Name: PDFString.of('Layer 1') }));
  doc.catalog.set(
    PDFName.of('OCProperties'),
    context.obj({ OCGs: [layer], D: { Creator: PDFString.of('Layer App Secret') } }),
  );
  doc.catalog.set(
    PDFName.of('Names'),
    context.obj({ URLS: { Names: [PDFString.of('https://intranet.example/secret'), layer] } }),
  );
  await page.goto('/pdf/metadata/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles({
    name: 'thesis.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await doc.save()),
  });
  await frame.getByLabel('문서 정보 모두 지우기', { exact: false }).check();
  const { text } = await download(page, frame);
  for (const secret of [
    'figure-secret.pdf',
    'Ptex Author Hong',
    'Layer App Secret',
    'intranet.example',
  ]) {
    expect(text).not.toContain(secret);
  }
  expect(text).toContain('Layer 1');
});

for (const [label, separator] of [
  ['스페이스', ' '],
  ['탭', '\t'],
  ['폼 피드', '\f'],
  ['NUL', '\0'],
] as const) {
  test(`/SigFlags 없이 서명한 PDF도 서명이 깨진다고 알린다 (/ByteRange 뒤 ${label})`, async ({
    page,
  }) => {
    const signed = await PDFDocument.load(await signedPdf());
    const form = signed.catalog.lookup(PDFName.of('AcroForm'), PDFDict);
    form.delete(PDFName.of('SigFlags'));
    // 서명 프로그램은 서명 값 사전을 압축 묶음 밖에 쓴다 (나중에 /Contents를 채우려고)
    const saved = await signed.save({ useObjectStreams: false, updateFieldAppearances: false });
    // 같은 길이로 바꿔 상호 참조 표의 자리는 그대로 둔다
    const bytes = Buffer.from(
      Buffer.from(saved).toString('latin1').replace('/ByteRange [', `/ByteRange${separator}[`),
      'latin1',
    );
    await page.goto('/pdf/rotate/');
    const frame = page.frameLocator('iframe[data-tool-frame]');
    await frame.locator('input[type=file]').setInputFiles({
      name: 'contract.pdf',
      mimeType: 'application/pdf',
      buffer: bytes,
    });
    await expect(frame.getByText('전자 서명된 PDF입니다', { exact: false })).toBeVisible();
  });
}
