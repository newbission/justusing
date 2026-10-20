/** MediaPipe 엔진 글루 (Emscripten ES 모듈). 타입이 없어 face.worker.ts가 쓰는 만큼만 적는다 */
declare module '@mediapipe/tasks-vision/vision_wasm_module_internal.js' {
  const ModuleFactory: (module?: object) => Promise<unknown>;
  export default ModuleFactory;
}
