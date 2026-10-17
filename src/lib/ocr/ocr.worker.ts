/**
 * 글자 인식 워커 (ocr.ts가 부른다). 인식 엔진(Tesseract, WebAssembly)을 이 워커 안에서 돌린다.
 *
 * 엔진과 언어 데이터는 화면이 보관소에서 받아 확인한 바이트를 넘겨준다. 워커는 아무 데서도 받지 않는다
 * (frame의 CSP가 우리 사이트 밖 연결을 막고, 엔진이 스스로 받으려 하지 않도록 wasmBinary를 직접 준다).
 * 쪽 그림은 메모리에서만 다룬다.
 */
import createTesseract from 'tesseract.js-core/tesseract-core-simd-lstm.js';
import type { OcrRequest, OcrResponse } from './ocr';

/** 엔진 모듈 중 이 워커가 쓰는 부분 */
interface TessModule {
  FS: { writeFile(path: string, data: Uint8Array): void; readFile(path: string): Uint8Array };
  HEAPU8: Uint8Array;
  _malloc(size: number): number;
  _free(pointer: number): void;
  TessBaseAPI: new () => TessApi;
  TessPDFRenderer: new (base: string, dataDir: string, textOnly: boolean) => TessRenderer;
}
interface TessApi {
  Init(dataDir: string, langs: string, engineMode: number): number;
  SetImage(
    pointer: number,
    width: number,
    height: number,
    bytesPerPixel: number,
    bytesPerLine: number,
  ): void;
  SetSourceResolution(dpi: number): void;
  Recognize(monitor: null): number;
  GetUTF8Text(): string;
  Clear(): void;
}
interface TessRenderer {
  BeginDocument(title: string): boolean;
  AddImage(api: TessApi): boolean;
  EndDocument(): boolean;
}

/** LSTM 인식기만 쓴다 (_best_int 데이터는 LSTM 전용) */
const OEM_LSTM_ONLY = 1;

let tess: TessModule | undefined;
let api: TessApi | undefined;

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as Uint8Array<ArrayBuffer>])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function init(request: Extract<OcrRequest, { type: 'init' }>) {
  tess = (await createTesseract({ wasmBinary: request.engine })) as TessModule;
  for (const lang of request.langs) {
    tess.FS.writeFile(`/${lang.code}.traineddata`, await gunzip(lang.data));
  }
  api = new tess.TessBaseAPI();
  const code = api.Init('/', request.langs.map((lang) => lang.code).join('+'), OEM_LSTM_ONLY);
  if (code !== 0) throw new Error(`init failed: ${code}`);
}

/** 쪽 그림 하나를 읽어 글자와, 그 글자만 담은 투명 글자층 PDF를 만든다 */
function recognize(request: Extract<OcrRequest, { type: 'page' }>) {
  if (!tess || !api) throw new Error('not initialized');
  const { bitmap, dpi } = request;
  const { width, height } = bitmap;
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d')!;
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const pixels = context.getImageData(0, 0, width, height).data;
  const pointer = tess._malloc(pixels.length);
  try {
    tess.HEAPU8.set(pixels, pointer);
    api.SetImage(pointer, width, height, 4, width * 4);
    api.SetSourceResolution(dpi);
    api.Recognize(null);
    const text = api.GetUTF8Text();
    // 글자만 담은 쪽 (그림 없음). 원래 쪽 위에 겹쳐 글자를 고르고 찾을 수 있게 한다
    const renderer = new tess.TessPDFRenderer('/layer', '/', true);
    renderer.BeginDocument('');
    renderer.AddImage(api);
    renderer.EndDocument();
    const layer = tess.FS.readFile('/layer.pdf').slice();
    return { text, layer };
  } finally {
    tess._free(pointer);
    api.Clear();
  }
}

addEventListener('message', async (event: MessageEvent<OcrRequest>) => {
  const request = event.data;
  const send = (response: OcrResponse, transfer: Transferable[] = []) =>
    postMessage(response, { transfer });
  try {
    if (request.type === 'init') {
      await init(request);
      send({ id: request.id, kind: 'ready' });
    } else {
      const { text, layer } = recognize(request);
      send({ id: request.id, kind: 'page', text, layer }, [layer.buffer]);
    }
  } catch (error) {
    send({
      id: request.id,
      kind: 'error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
