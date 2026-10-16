/**
 * 글자 넣기 워커 (text-pdf.ts가 부른다): 글자 워터마크, 머리말·꼬리말.
 * 글꼴 엔진(fontkit)이 커서 PDF 고치기 워커와 따로 둔다. 파일과 글꼴은 메모리에서만 다룬다.
 */
import { PDFDocument, degrees, rgb, type PDFFont } from '@cantoo/pdf-lib';
import fontkit from '@cantoo/fontkit';
import type { TextJob, TextRequest, TextResponse } from './text-pdf';
import { placements } from './watermark-layout';
import { fillTemplate, fitSize, linePosition } from './header-footer-layout';
import { normalizedRotation, toPdfPoint, viewSize } from './page-geometry';

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
  // 자리표시는 숫자와 날짜로 바뀐다
  return (
    [job.header.text, job.footer.text]
      .map((text) => fillTemplate(text, total, total, job.date))
      .join('') + '0123456789'
  );
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
    const view = viewSize(page);
    for (const [line, edge] of [
      [job.header, 'top'],
      [job.footer, 'bottom'],
    ] as const) {
      const text = fillTemplate(line.text, index + 1, pages.length, job.date).trim();
      if (!text) continue;
      const size = fitSize(font.widthOfTextAtSize(text, job.size), job.size, view.width);
      const width = font.widthOfTextAtSize(text, size);
      const at = linePosition(view, width, size, line.align, edge);
      page.drawText(text, {
        ...toPdfPoint(page, at.x, at.y),
        size,
        font,
        color,
        // 회전한 쪽에서도 화면에 바로 보이게 같은 만큼 돌린다
        rotate: degrees(normalizedRotation(page)),
      });
    }
  });
}

addEventListener('message', async (event: MessageEvent<TextRequest>) => {
  const { id, bytes, password, job } = event.data;
  const send = (response: TextResponse, transfer: Transferable[] = []) =>
    postMessage(response, { transfer });
  try {
    const doc = await PDFDocument.load(bytes, { password: password ?? '' });
    const missing = missingChars(job.font, usedText(job, doc.getPageCount()));
    if (missing.length > 0) {
      send({ id, kind: 'missing', chars: missing });
      return;
    }
    doc.registerFontkit(fontkit);
    // 쓰는 글자만 넣는다 (글꼴 전체를 넣으면 PDF가 몇 MB 커진다)
    const font = await doc.embedFont(job.font, { subset: true });
    if (job.kind === 'watermark') drawWatermark(doc, font, job);
    else drawHeaderFooter(doc, font, job);
    const out = await doc.save();
    send({ id, kind: 'done', bytes: out }, [out.buffer]);
  } catch (error) {
    send({ id, kind: 'error', message: error instanceof Error ? error.message : String(error) });
  }
});
