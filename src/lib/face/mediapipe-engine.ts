/**
 * MediaPipe 작업을 넘겨받은 엔진 바이트로 띄운다. 워커 안에서만 부른다 (얼굴 찾기·배경 지우기 워커).
 *
 * 엔진과 모델은 화면이 보관소에서 받아 확인한 바이트를 넘겨준다. 워커는 아무 데서도 받지 않는다:
 * - 엔진 코드(글루)는 워커에 함께 번들하고, 엔진 바이트는 Module.instantiateWasm에서 직접 띄운다
 * - 모델은 modelAssetBuffer로 준다
 * - MediaPipe는 사용 통계를 구글로 보내는 코드를 품고 있다. frame의 CSP가 막지만, 보내려는 시도도 하지
 *   않게 이 모듈을 불러온 워커의 fetch를 없앤다 (위 두 가지 덕분에 워커는 fetch가 필요 없다)
 */
import ModuleFactory from '@mediapipe/tasks-vision/vision_wasm_module_internal.js';

globalThis.fetch = () => Promise.reject(new TypeError('network is disabled in this worker'));

/** MediaPipe가 엔진을 띄울 때 찾는 전역 값 (wasmLoaderPath를 비우면 이미 있는 것을 쓴다) */
const scope = globalThis as unknown as {
  ModuleFactory?: typeof ModuleFactory;
  Module?: {
    instantiateWasm: (
      imports: WebAssembly.Imports,
      done: (instance: WebAssembly.Instance) => void,
    ) => object;
  };
};

/** createFromOptions에 넘기는 빈 경로 (엔진을 받으러 가지 않는다) */
export const NO_FILES = { wasmLoaderPath: '', wasmBinaryPath: '' };

/** 엔진 (한 번만 컴파일하고 작업마다 새로 띄운다) */
let engine: Promise<WebAssembly.Module> | undefined;

/** 받은 엔진 바이트를 컴파일해 둔다 */
export function setEngine(bytes: Uint8Array) {
  engine = WebAssembly.compile(bytes as Uint8Array<ArrayBuffer>);
}

/** MediaPipe 작업 하나를 넘겨받은 엔진으로 띄운다 */
export async function launch<T>(create: () => Promise<T>): Promise<T> {
  if (!engine) throw new Error('engine not set');
  scope.ModuleFactory = ModuleFactory;
  const compiled = await engine;
  // 엔진을 띄우지 못하면 MediaPipe가 끝없이 기다리므로 따로 실패를 알린다
  let failed!: (error: unknown) => void;
  const failure = new Promise<never>((_, reject) => (failed = reject));
  scope.Module = {
    // 엔진이 파일을 받으러 가지 않고 넘겨받은 바이트로 뜨게 한다 (Emscripten의 instantiateWasm 고리)
    instantiateWasm(imports, done) {
      WebAssembly.instantiate(compiled, imports).then(done, failed);
      return {};
    },
  };
  return Promise.race([failure, create()]);
}
