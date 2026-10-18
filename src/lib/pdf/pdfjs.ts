/**
 * pdf.js 준비: 워커를 격리 frame에서 띄우고, 보조 파일을 우리 사이트에서 읽게 한다.
 * PDF 도구들이 공통으로 쓴다. 이 모듈을 import한 도구 frame에서만 pdf.js가 로드된다.
 */
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?worker&url';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { createWorker } from '../worker';

export type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

let workerReady: Promise<void> | undefined;

function ensureWorker(): Promise<void> {
  workerReady ??= createWorker(workerUrl).then((worker) => {
    pdfjs.GlobalWorkerOptions.workerPort = worker;
  });
  return workerReady;
}

/**
 * 보조 파일 주소. 워커는 blob URL에서 돌아서 상대 주소를 못 쓰므로 절대 주소로 넘긴다.
 * scripts/copy-pdfjs-assets.mjs 가 public/vendor/pdfjs/ 에 복사해 둔다.
 */
function assetUrl(dir: string): string {
  return new URL(`/vendor/pdfjs/${dir}/`, location.href).href;
}

/** 암호가 필요하거나 틀렸을 때 pdf.js가 던지는 오류인지 */
export function isPasswordError(error: unknown): boolean {
  return error instanceof Error && error.name === 'PasswordException';
}

export interface OpenedPdf {
  doc: PDFDocumentProxy;
  /** 문서를 닫고 메모리를 돌려준다 */
  close: () => Promise<void>;
}

/** 메모리에 있는 PDF 바이트를 연다. 파일은 어디로도 전송되지 않는다. */
export async function openPdf(data: Uint8Array, password?: string): Promise<OpenedPdf> {
  await ensureWorker();
  const task = pdfjs.getDocument({
    data,
    password,
    cMapUrl: assetUrl('cmaps'),
    standardFontDataUrl: assetUrl('standard_fonts'),
    wasmUrl: assetUrl('wasm'),
    iccUrl: assetUrl('iccs'),
  });
  try {
    return { doc: await task.promise, close: () => task.destroy() };
  } catch (error) {
    // 암호 오류·손상 파일이어도 여는 작업이 잡고 있던 메모리는 풀어 준다
    await task.destroy();
    throw error;
  }
}
