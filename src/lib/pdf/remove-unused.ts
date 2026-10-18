/**
 * 쓰지 않는 객체 지우기. pdf-lib는 아무도 가리키지 않는 객체도 저장하므로,
 * 지운 값·옛 판의 객체가 파일에 남지 않게 하려면 직접 지워야 한다.
 */
import {
  PDFArray,
  PDFDict,
  PDFRef,
  PDFStream,
  type PDFDocument,
  type PDFObject,
} from '@cantoo/pdf-lib';

/** 문서에서 닿는 객체만 남긴다. 고친 기록이 쌓인 PDF는 쓰지 않는 옛 객체를 많이 갖고 있다 */
export function removeUnused(doc: PDFDocument) {
  const { context } = doc;
  const reached = new Set<PDFRef>();
  const queue: PDFObject[] = [];
  const { Root, Info } = context.trailerInfo;
  if (Root) queue.push(Root);
  if (Info) queue.push(Info);
  while (queue.length > 0) {
    const object = queue.pop()!;
    if (object instanceof PDFRef) {
      if (reached.has(object)) continue;
      reached.add(object);
      const target = context.lookup(object);
      if (target) queue.push(target);
    } else if (object instanceof PDFDict) {
      queue.push(...object.values());
    } else if (object instanceof PDFArray) {
      queue.push(...object.asArray());
    } else if (object instanceof PDFStream) {
      queue.push(object.dict);
    }
  }
  for (const [ref] of context.enumerateIndirectObjects()) {
    if (!reached.has(ref)) context.delete(ref);
  }
}
