/**
 * pdf.js 준비: 워커를 격리 frame에서 띄우고, 보조 파일을 우리 사이트에서 읽게 한다.
 * PDF 도구들이 공통으로 쓴다. 이 모듈을 import한 도구 frame에서만 pdf.js가 로드된다.
 */
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?worker&url';
import scanWorkerUrl from './signature-scan.worker.ts?worker&url';
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

/**
 * 인증서로 전자 서명된 PDF인지. 우리 도구는 파일을 새로 써서 저장하므로 고친 파일에서는 서명이 깨진다.
 * 서명 칸만 있고 서명하지 않은 PDF는 아니다. pdf.js는 /SigFlags가 없거나 서명 칸이 양식 목록(/Fields) 밖에 있으면
 * 서명을 찾지 못해, 원본 바이트에 서명 값의 /ByteRange가 있는지도 본다 (압축 묶음 안에 있으면 못 찾는다).
 * 읽지 못하면 서명이 없다고 본다
 */
export async function isSigned(doc: PDFDocumentProxy, bytes?: Uint8Array): Promise<boolean> {
  try {
    if (((await doc.getSignatures())?.length ?? 0) > 0) return true;
  } catch {
    // 바이트로 본다
  }
  if (bytes === undefined) return false;
  try {
    return await hasByteRange(bytes);
  } catch {
    // 워커를 띄우지 못하면 알 수 없는 것으로 (파일 열기는 막지 않는다)
    return false;
  }
}

let scanWorker: Promise<Worker> | undefined;
let scanId = 0;

/** 서명 값 사전(/ByteRange [)이 바이트 안에 있는지. 큰 파일도 화면이 멈추지 않게 워커에서 찾는다 */
async function hasByteRange(bytes: Uint8Array): Promise<boolean> {
  const worker = await (scanWorker ??= createWorker(scanWorkerUrl));
  const id = ++scanId;
  // 원본은 결과를 만들 때 써야 해서 복사본을 넘긴다
  const copy = bytes.slice();
  return new Promise((resolve) => {
    const listen = (event: MessageEvent<{ id: number; found: boolean }>) => {
      if (event.data.id !== id) return;
      worker.removeEventListener('message', listen);
      resolve(event.data.found);
    };
    worker.addEventListener('message', listen);
    worker.postMessage({ id, bytes: copy }, [copy.buffer]);
  });
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
