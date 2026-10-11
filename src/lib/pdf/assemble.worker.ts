/**
 * PDF 조립 워커. 원본 PDF들에서 고른 페이지를 정한 순서·회전으로 모아 새 PDF 하나를 만든다.
 * 합치기·나누기·회전·정리 도구가 모두 이 작업 하나로 결과를 만든다 (assemble.ts가 부른다).
 * 무거운 처리라 화면이 멈추지 않도록 워커에서 돈다. 파일은 메모리에서만 다룬다.
 */
import { PDFDocument, degrees } from '@cantoo/pdf-lib';
import type { AssembleRequest, AssembleResponse } from './assemble';

async function assemble({ sources, pages }: AssembleRequest['job']): Promise<Uint8Array> {
  // 암호 PDF는 받은 암호로 풀어서 연다. 결과 파일에는 암호가 걸리지 않는다.
  const docs = await Promise.all(
    sources.map(({ bytes, password }) => PDFDocument.load(bytes, { password })),
  );
  const out = await PDFDocument.create();

  // 같은 원본의 페이지는 한 번에 복사해야 글꼴·이미지 같은 공유 자원이 한 번만 들어간다
  const copied = await Promise.all(
    docs.map((doc, source) => {
      const indices = [...new Set(pages.filter((p) => p.source === source).map((p) => p.index))];
      return out
        .copyPages(doc, indices)
        .then((list) => new Map(indices.map((index, i) => [index, list[i]!])));
    }),
  );

  for (const { source, index, rotate = 0 } of pages) {
    const page = copied[source]!.get(index)!;
    if (rotate) page.setRotation(degrees((page.getRotation().angle + rotate) % 360));
    out.addPage(page);
  }

  return out.save();
}

addEventListener('message', async (event: MessageEvent<AssembleRequest>) => {
  const { id, job } = event.data;
  let response: AssembleResponse;
  try {
    const bytes = await assemble(job);
    response = { id, ok: true, bytes };
    postMessage(response, { transfer: [bytes.buffer] });
  } catch (error) {
    response = { id, ok: false, message: error instanceof Error ? error.message : String(error) };
    postMessage(response);
  }
});
