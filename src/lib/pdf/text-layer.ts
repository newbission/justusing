/**
 * 글자 인식으로 만든 투명 글자층을 원래 쪽 위에 겹친다 (modify.worker.ts에서 쓴다).
 * 쪽 모습은 그대로 두고, 보이지 않는 글자만 더해 글자를 고르고 찾고 복사할 수 있게 한다.
 */
import { PDFDocument, degrees } from '@cantoo/pdf-lib';
import { isolateContent } from './page-content';
import { normalizedRotation, toPdfPoint, viewSize } from './page-geometry';

/**
 * layers[i]: i번째 쪽에 겹칠 글자층 PDF(쪽 하나), 없으면 그 쪽은 그대로.
 * 글자층은 화면에 보이는 모습(회전·보이는 영역 적용)대로 그린 그림에서 만들었으므로,
 * 보이는 영역에 맞춰 늘리고 쪽 회전만큼 거꾸로 돌려 넣는다.
 */
export async function addTextLayers(doc: PDFDocument, layers: (Uint8Array | null)[]) {
  const pages = doc.getPages();
  for (const [index, bytes] of layers.entries()) {
    const page = pages[index];
    if (!page || !bytes) continue;
    const [layer] = await doc.embedPdf(bytes, [0]);
    if (!layer) continue;
    isolateContent(page);
    const view = viewSize(page);
    page.drawPage(layer, {
      // 보이는 쪽의 왼쪽 아래 모서리. 돌려 그리는 기준점이다
      ...toPdfPoint(page, 0, view.height),
      width: view.width,
      height: view.height,
      rotate: degrees(normalizedRotation(page)),
    });
  }
}
