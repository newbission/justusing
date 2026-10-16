/**
 * 글자 워터마크 워커 (watermark.ts가 부른다). 글꼴 엔진(fontkit)이 커서 PDF 고치기 워커와 따로 둔다.
 * 파일과 글꼴은 메모리에서만 다룬다.
 */
import { PDFDocument, degrees, rgb } from '@cantoo/pdf-lib';
import fontkit from '@cantoo/fontkit';
import type { WatermarkRequest, WatermarkResponse } from './watermark';
import { placements } from './watermark-layout';
import { normalizedRotation, toPdfPoint, viewSize } from './page-geometry';

addEventListener('message', async (event: MessageEvent<WatermarkRequest>) => {
  const { id, bytes, password, options } = event.data;
  const send = (response: WatermarkResponse, transfer: Transferable[] = []) =>
    postMessage(response, { transfer });
  try {
    // 글꼴에 없는 글자는 PDF에 빈 네모로 찍히므로 미리 알린다
    const face = fontkit.create(options.font as unknown as Buffer);
    if ('fonts' in face) throw new Error('font collection');
    const missing = [...new Set(options.text)].filter(
      (char) => char.trim() !== '' && !face.hasGlyphForCodePoint(char.codePointAt(0)!),
    );
    if (missing.length > 0) {
      send({ id, kind: 'missing', chars: missing });
      return;
    }

    const doc = await PDFDocument.load(bytes, { password: password ?? '' });
    doc.registerFontkit(fontkit);
    // 쓰는 글자만 넣는다 (글꼴 전체를 넣으면 PDF가 몇 MB 커진다)
    const font = await doc.embedFont(options.font, { subset: true });
    const color = rgb(...options.color);
    for (const page of doc.getPages()) {
      const view = viewSize(page);
      const size = options.size * Math.min(view.width, view.height);
      const width = font.widthOfTextAtSize(options.text, size);
      const theta = (options.angle * Math.PI) / 180;
      for (const center of placements(view, width, size, options.layout, options.angle)) {
        // 글자 가운데가 center에 오도록 기준점(왼쪽 글자 바닥선)을 구한다. 화면 좌표(아래가 +y)
        const x = center.x - (Math.cos(theta) * width) / 2 + Math.sin(theta) * size * 0.35;
        const y = center.y + (Math.sin(theta) * width) / 2 + Math.cos(theta) * size * 0.35;
        page.drawText(options.text, {
          ...toPdfPoint(page, x, y),
          size,
          font,
          color,
          opacity: options.opacity,
          // 쪽 회전만큼 더 돌려 화면에서 정한 각도로 보이게 한다
          rotate: degrees(normalizedRotation(page) + options.angle),
        });
      }
    }
    const out = await doc.save();
    send({ id, kind: 'done', bytes: out }, [out.buffer]);
  } catch (error) {
    send({ id, kind: 'error', message: error instanceof Error ? error.message : String(error) });
  }
});
