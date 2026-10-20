/**
 * 얼굴 찾기 워커 (face.ts가 부른다). MediaPipe Face Landmarker(WebAssembly)를 이 워커 안에서 돌린다.
 *
 * 엔진과 모델은 화면이 보관소에서 받아 확인한 바이트를 넘겨준다. 워커는 아무 데서도 받지 않는다:
 * - 엔진 코드(글루)는 이 워커에 함께 번들하고, 엔진 바이트는 Module.instantiateWasm에서 직접 띄운다
 * - 모델은 modelAssetBuffer로 준다
 * - MediaPipe는 사용 통계를 구글로 보내는 코드를 품고 있다. frame의 CSP가 막지만, 보내려는 시도도 하지
 *   않게 이 워커의 fetch를 없앤다 (위 두 가지 덕분에 워커는 fetch가 필요 없다)
 * 사진은 메모리에서만 다룬다.
 */
import { FaceLandmarker } from '@mediapipe/tasks-vision';
import ModuleFactory from '@mediapipe/tasks-vision/vision_wasm_module_internal.js';
import type { FaceRequest, FaceResponse } from './face';

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

let landmarker: FaceLandmarker | undefined;

async function init(request: Extract<FaceRequest, { type: 'init' }>) {
  scope.ModuleFactory = ModuleFactory;
  const engine = request.engine;
  // 엔진을 띄우지 못하면 MediaPipe가 끝없이 기다리므로 따로 실패를 알린다
  let failed!: (error: unknown) => void;
  const failure = new Promise<never>((_, reject) => (failed = reject));
  scope.Module = {
    // 엔진이 파일을 받으러 가지 않고 넘겨받은 바이트로 뜨게 한다 (Emscripten의 instantiateWasm 고리)
    instantiateWasm(imports, done) {
      WebAssembly.instantiate(engine as Uint8Array<ArrayBuffer>, imports).then(
        (result) => done(result.instance),
        (error) => failed(error),
      );
      return {};
    },
  };
  landmarker = await Promise.race([
    failure,
    FaceLandmarker.createFromOptions(
      { wasmLoaderPath: '', wasmBinaryPath: '' },
      {
        baseOptions: { modelAssetBuffer: request.model, delegate: 'CPU' },
        runningMode: 'IMAGE',
        // 얼굴이 둘 이상인 사진을 알려 주려고 둘까지 찾는다
        numFaces: 2,
      },
    ),
  ]);
}

function detect(request: Extract<FaceRequest, { type: 'detect' }>): FaceResponse {
  if (!landmarker) throw new Error('not initialized');
  const result = landmarker.detect(request.bitmap);
  request.bitmap.close();
  return {
    id: request.id,
    kind: 'faces',
    faces: result.faceLandmarks.map((points) => points.map(({ x, y }) => ({ x, y }))),
  };
}

addEventListener('message', async (event: MessageEvent<FaceRequest>) => {
  const request = event.data;
  try {
    if (request.type === 'init') {
      await init(request);
      postMessage({ id: request.id, kind: 'ready' } satisfies FaceResponse);
    } else {
      postMessage(detect(request));
    }
  } catch (error) {
    postMessage({
      id: request.id,
      kind: 'error',
      message: error instanceof Error ? error.message : String(error),
    } satisfies FaceResponse);
  }
});
