/**
 * 글자 넣기 워커 (text-pdf.ts가 부른다): 글자 워터마크, 머리말·꼬리말, PDF 편집, 양식 채우기.
 * 글꼴 엔진(fontkit)이 커서 PDF 고치기 워커와 따로 둔다. 파일과 글꼴은 메모리에서만 다룬다.
 */
import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFName,
  PDFNumber,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField,
  StandardFonts,
  degrees,
  rgb,
  type PDFFont,
  type PDFPage,
} from '@cantoo/pdf-lib';
import fontkit from '@cantoo/fontkit';
import type { TextJob, TextRequest, TextResponse } from './text-pdf';
import { placements } from './watermark-layout';
import { fillTemplate, fitSize, linePosition } from './header-footer-layout';
import { normalizedRotation, toPdfPoint, viewSize } from './page-geometry';
import { BASELINE, HIGHLIGHT, LINE_HEIGHT } from './edit-constants';

/** 글꼴에 없는 글자 (빈칸 제외). PDF에 빈 네모로 찍히므로 넣기 전에 알린다 */
function missingChars(fontBytes: Uint8Array, text: string): string[] {
  const face = fontkit.create(fontBytes as unknown as Buffer);
  if ('fonts' in face) throw new Error('font collection');
  return [...new Set(text)].filter(
    (char) => char.trim() !== '' && !face.hasGlyphForCodePoint(char.codePointAt(0)!),
  );
}

/** 이 작업이 PDF에 넣을 수 있는 모든 글자 (빠진 글자 검사용) */
function usedText(job: TextJob, total: number): string {
  if (job.kind === 'watermark') return job.text;
  if (job.kind === 'edit') {
    return job.items.map((item) => (item.kind === 'text' ? item.text : '')).join('');
  }
  if (job.kind === 'fill-form') {
    return Object.values(job.values)
      .flatMap((value) => (typeof value === 'boolean' ? [] : value))
      .join('');
  }
  // 쪽마다 실제로 넣을 글자 (자리표시가 바뀐 숫자·날짜만 검사해 숫자가 없는 글꼴도 쓸 수 있게)
  const texts: string[] = [];
  for (let page = job.skipFirst ? 2 : 1; page <= total; page++) {
    for (const line of [job.header, job.footer]) {
      texts.push(fillTemplate(line.text, page, total, job.date));
    }
  }
  return texts.join('');
}

/**
 * 쪽의 좌표 단위가 몇 pt인지 (/UserUnit, 없으면 1). 1이 아니면 pt로 정한 글자 크기·여백을 이 단위로 바꿔야
 * 화면 미리보기(pt)와 같은 크기가 된다
 */
function userUnit(page: PDFPage): number {
  const value = page.node.lookup(PDFName.of('UserUnit'));
  const unit = value instanceof PDFNumber ? value.asNumber() : 1;
  return unit > 0 ? unit : 1;
}

function drawWatermark(
  doc: PDFDocument,
  font: PDFFont,
  job: Extract<TextJob, { kind: 'watermark' }>,
) {
  const color = rgb(...job.color);
  for (const page of doc.getPages()) {
    const view = viewSize(page);
    const size = job.size * Math.min(view.width, view.height);
    const width = font.widthOfTextAtSize(job.text, size);
    const theta = (job.angle * Math.PI) / 180;
    for (const center of placements(view, width, size, job.layout, job.angle)) {
      // 글자 가운데가 center에 오도록 기준점(왼쪽 글자 바닥선)을 구한다. 화면 좌표(아래가 +y)
      const x = center.x - (Math.cos(theta) * width) / 2 + Math.sin(theta) * size * 0.35;
      const y = center.y + (Math.sin(theta) * width) / 2 + Math.cos(theta) * size * 0.35;
      page.drawText(job.text, {
        ...toPdfPoint(page, x, y),
        size,
        font,
        color,
        opacity: job.opacity,
        // 쪽 회전만큼 더 돌려 화면에서 정한 각도로 보이게 한다
        rotate: degrees(normalizedRotation(page) + job.angle),
      });
    }
  }
}

function drawHeaderFooter(
  doc: PDFDocument,
  font: PDFFont,
  job: Extract<TextJob, { kind: 'header-footer' }>,
) {
  const color = rgb(...job.color);
  const pages = doc.getPages();
  pages.forEach((page, index) => {
    if (job.skipFirst && index === 0) return;
    const unit = userUnit(page);
    // 자리 계산은 pt로 하고(미리보기와 같게) 그릴 때 쪽 단위로 바꾼다
    const units = viewSize(page);
    const view = { width: units.width * unit, height: units.height * unit };
    for (const [line, edge] of [
      [job.header, 'top'],
      [job.footer, 'bottom'],
    ] as const) {
      const text = fillTemplate(line.text, index + 1, pages.length, job.date).trim();
      if (!text) continue;
      const size = fitSize(font.widthOfTextAtSize(text, job.size), job.size, view);
      const width = font.widthOfTextAtSize(text, size);
      const at = linePosition(view, width, size, line.align, edge);
      page.drawText(text, {
        ...toPdfPoint(page, at.x / unit, at.y / unit),
        size: size / unit,
        font,
        color,
        // 회전한 쪽에서도 화면에 바로 보이게 같은 만큼 돌린다
        rotate: degrees(normalizedRotation(page)),
      });
    }
  });
}

function drawEdits(
  doc: PDFDocument,
  font: PDFFont | undefined,
  job: Extract<TextJob, { kind: 'edit' }>,
) {
  const pages = doc.getPages();
  // 가리기·형광펜을 먼저 그리고 글자를 위에 그린다 (가린 자리에 새 글자를 쓸 수 있게).
  // 미리보기도 같은 순서로 겹친다 (edit/App.svelte의 .item.text)
  const order = [...job.items].sort(
    (a, b) => Number(a.kind === 'text') - Number(b.kind === 'text'),
  );
  for (const item of order) {
    const page = pages[item.page];
    if (!page) continue;
    const view = viewSize(page);
    const rotate = degrees(normalizedRotation(page));
    if (item.kind === 'text') {
      if (!font) throw new Error('font required');
      // 글자 크기는 pt로 정했으므로 쪽 단위(/UserUnit)로 바꾼다 (자리는 쪽 비율이라 그대로)
      const size = item.size / userUnit(page);
      item.text.split('\n').forEach((line, i) => {
        if (!line.trim()) return;
        const x = item.x * view.width;
        const y = item.y * view.height + size * (BASELINE + i * LINE_HEIGHT);
        page.drawText(line, {
          ...toPdfPoint(page, x, y),
          size,
          font,
          color: rgb(...item.color),
          rotate,
        });
      });
      continue;
    }
    const width = item.width * view.width;
    const height = item.height * view.height;
    // 사각형의 왼쪽 아래(화면 기준)를 기준점으로, 쪽 회전만큼 돌려 화면에서 바로 보이게 한다
    const at = toPdfPoint(page, item.x * view.width, item.y * view.height + height);
    page.drawRectangle({
      ...at,
      width,
      height,
      rotate,
      borderWidth: 0,
      ...(item.kind === 'whiteout'
        ? { color: rgb(1, 1, 1) }
        : { color: rgb(...HIGHLIGHT.color), opacity: HIGHLIGHT.opacity }),
    });
  }
}

/**
 * 양식 칸에 값을 넣고 바뀐 칸의 모양을 다시 만든다. 글꼴이 없으면 기본 글꼴(Helvetica)로 만들고,
 * 기본 글꼴에 없는 글자가 있으면 그 글자들을 돌려준다 (pdf-lib는 그런 글자를 오류 없이 빼 버린다)
 */
function fillFields(
  doc: PDFDocument,
  font: PDFFont | undefined,
  job: Extract<TextJob, { kind: 'fill-form' }>,
): string[] {
  const form = doc.getForm();
  // XFA 양식이 남아 있으면 일부 보기 프로그램이 넣은 값 대신 XFA를 보여 준다
  if (form.hasXFA()) form.deleteXFA();
  for (const [name, value] of Object.entries(job.values)) {
    const field = form.getFieldMaybe(name);
    if (!field || field.isReadOnly()) continue;
    if (field instanceof PDFTextField && typeof value === 'string') {
      const max = field.getMaxLength();
      field.setText(max === undefined ? value : value.slice(0, max));
    } else if (field instanceof PDFCheckBox && typeof value === 'boolean') {
      if (value) field.check();
      else field.uncheck();
    } else if (field instanceof PDFRadioGroup && typeof value === 'string') {
      if (value) field.select(value);
      else field.clear();
    } else if (field instanceof PDFDropdown && typeof value === 'string') {
      if (value) field.select(value);
      else field.clear();
    } else if (field instanceof PDFOptionList && Array.isArray(value)) {
      if (value.length > 0) field.select(value);
      else field.clear();
    }
  }
  const appearanceFont = font ?? doc.embedStandardFont(StandardFonts.Helvetica);
  if (!font) {
    const supported = new Set(appearanceFont.getCharacterSet());
    const missing = [...new Set(usedText(job, 0))].filter(
      (char) => char.trim() !== '' && !supported.has(char.codePointAt(0)!),
    );
    if (missing.length > 0) return missing;
  }
  form.updateFieldAppearances(appearanceFont);
  if (job.flatten) form.flatten();
  return [];
}

addEventListener('message', async (event: MessageEvent<TextRequest>) => {
  const { id, bytes, password, job } = event.data;
  const send = (response: TextResponse, transfer: Transferable[] = []) =>
    postMessage(response, { transfer });
  try {
    const doc = await PDFDocument.load(bytes, { password: password ?? '' });
    const text = usedText(job, doc.getPageCount());
    // 글자를 넣지 않는 편집(가리기·형광펜만)은 글꼴이 없어도 된다
    let font: PDFFont | undefined;
    if (job.font && text.trim()) {
      const missing = missingChars(job.font, text);
      if (missing.length > 0) {
        send({ id, kind: 'missing', chars: missing });
        return;
      }
      doc.registerFontkit(fontkit);
      // 쓰는 글자만 넣는다 (글꼴 전체를 넣으면 PDF가 몇 MB 커진다)
      font = await doc.embedFont(job.font, { subset: true });
    }
    if (job.kind === 'edit') drawEdits(doc, font, job);
    else if (job.kind === 'fill-form') {
      const missing = fillFields(doc, font, job);
      if (missing.length > 0) {
        send({ id, kind: 'missing', chars: missing });
        return;
      }
    } else if (font) {
      if (job.kind === 'watermark') drawWatermark(doc, font, job);
      else drawHeaderFooter(doc, font, job);
    } else if (text.trim()) throw new Error('font required');
    // 넣을 글자가 하나도 없으면(한 쪽 문서에서 표지를 뺀 머리말 등) 그대로 저장한다
    const out = await doc.save();
    send({ id, kind: 'done', bytes: out }, [out.buffer]);
  } catch (error) {
    send({ id, kind: 'error', message: error instanceof Error ? error.message : String(error) });
  }
});
