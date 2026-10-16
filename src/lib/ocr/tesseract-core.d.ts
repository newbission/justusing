/** tesseract.js-core의 엔진 모듈 (Emscripten). 쓰는 모양만 적는다 (ocr.worker.ts) */
declare module 'tesseract.js-core/tesseract-core-simd-lstm.js' {
  const createTesseract: (options: { wasmBinary: Uint8Array }) => Promise<unknown>;
  export default createTesseract;
}
