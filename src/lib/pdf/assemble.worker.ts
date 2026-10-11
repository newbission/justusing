/**
 * PDF 조립 워커. 원본 PDF들에서 고른 페이지를 정한 순서·회전으로 모아 새 PDF를 만든다.
 * 합치기·나누기·회전·정리 도구가 모두 이 작업 하나로 결과를 만든다 (assemble.ts가 부른다).
 * 원본은 한 번만 읽고 결과 파일을 여러 개 만들 수 있다 (나누기).
 * 무거운 처리라 화면이 멈추지 않도록 워커에서 돈다. 파일은 메모리에서만 다룬다.
 */
import { PDFDocument, degrees } from '@cantoo/pdf-lib';
import type { AssemblePage, AssembleRequest, AssembleResponse } from './assemble';

/** 열어 둔 원본들에서 결과 PDF 하나를 만든다 */
async function build(docs: PDFDocument[], pages: AssemblePage[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();

  // 같은 원본의 페이지는 한 번에 복사해야 글꼴·이미지 같은 공유 자원이 한 번만 들어간다
  const copied = await Promise.all(
    docs.map(async (doc, source) => {
      const indices = [...new Set(pages.filter((p) => p.source === source).map((p) => p.index))];
      const list = await out.copyPages(doc, indices);
      return new Map(indices.map((index, i) => [index, list[i]!]));
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
  const send = (response: AssembleResponse, transfer: Transferable[] = []) =>
    postMessage(response, { transfer });
  try {
    // 암호 PDF는 받은 암호로 풀어서 연다. 결과 파일에는 암호가 걸리지 않는다.
    const docs = await Promise.all(
      job.sources.map(({ bytes, password }) => PDFDocument.load(bytes, { password })),
    );
    const files: Uint8Array[] = [];
    for (const pages of job.outputs) {
      files.push(await build(docs, pages));
      send({ id, kind: 'progress', done: files.length, total: job.outputs.length });
    }
    send(
      { id, kind: 'done', files },
      files.map((file) => file.buffer),
    );
  } catch (error) {
    send({ id, kind: 'error', message: error instanceof Error ? error.message : String(error) });
  }
});
