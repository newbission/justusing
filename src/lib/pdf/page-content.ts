/**
 * 쪽 내용 스트림 다루기 (PDF를 고치는 워커들이 같이 쓴다).
 */
import {
  PDFContentStream,
  popGraphicsState,
  pushGraphicsState,
  type PDFPage,
} from '@cantoo/pdf-lib';

/**
 * 원래 쪽 내용을 q…Q로 감싼다. 내용이 그래픽 상태(좌표 변환 등)를 되돌리지 않고 끝나도
 * 뒤에 덧그리는 것이 엉뚱한 자리에 그려지지 않게 한다.
 */
export function isolateContent(page: PDFPage) {
  page.node.normalize();
  if (!page.node.Contents()) return;
  const context = page.doc.context;
  const start = context.register(PDFContentStream.of(context.obj({}), [pushGraphicsState()]));
  const end = context.register(PDFContentStream.of(context.obj({}), [popGraphicsState()]));
  page.node.wrapContentStreams(start, end);
}
