/**
 * 얼굴 찾기 워커 (face.ts가 부른다). MediaPipe Face Landmarker·Image Segmenter(WebAssembly)를 이 워커 안에서 돌린다.
 * 엔진은 화면이 넘겨준 바이트로 띄우고 워커는 아무 데서도 받지 않는다 (mediapipe-engine.ts).
 * 사진은 메모리에서만 다룬다.
 */
import { FaceLandmarker, ImageSegmenter } from '@mediapipe/tasks-vision';
import type { FaceRequest, FaceResponse } from './face';
import { NO_FILES, launch, setEngine } from './mediapipe-engine';

let landmarker: FaceLandmarker | undefined;
/** 사람 영역 나누기 모델. 배경을 바꿀 때 처음 띄운다 (엔진을 하나 더 띄워 메모리를 쓴다) */
let segmenterModel: Uint8Array | undefined;
let segmenter: Promise<ImageSegmenter> | undefined;

async function init(request: Extract<FaceRequest, { type: 'init' }>) {
  setEngine(request.engine);
  segmenterModel = request.segmenter;
  landmarker = await launch(() =>
    FaceLandmarker.createFromOptions(NO_FILES, {
      baseOptions: { modelAssetBuffer: request.model, delegate: 'CPU' },
      runningMode: 'IMAGE',
      // 얼굴이 둘 이상인 사진을 알려 주려고 둘까지 찾는다
      numFaces: 2,
    }),
  );
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

async function segment(request: Extract<FaceRequest, { type: 'segment' }>): Promise<FaceResponse> {
  if (!segmenterModel) throw new Error('not initialized');
  const model = segmenterModel;
  segmenter ??= launch(() =>
    ImageSegmenter.createFromOptions(NO_FILES, {
      baseOptions: { modelAssetBuffer: model, delegate: 'CPU' },
      runningMode: 'IMAGE',
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    }),
  );
  // 띄우지 못했으면 다음에 다시 해 본다
  const task = await segmenter.catch((error) => {
    segmenter = undefined;
    throw error;
  });
  const { bitmap } = request;
  const result = task.segment(bitmap);
  bitmap.close();
  try {
    const mask = result.confidenceMasks![0];
    const values = mask.getAsFloat32Array();
    const data = new Uint8Array(values.length);
    for (let i = 0; i < values.length; i++) data[i] = Math.round(values[i] * 255);
    return { id: request.id, kind: 'mask', mask: { data, width: mask.width, height: mask.height } };
  } finally {
    result.close();
  }
}

addEventListener('message', async (event: MessageEvent<FaceRequest>) => {
  const request = event.data;
  try {
    if (request.type === 'init') {
      await init(request);
      postMessage({ id: request.id, kind: 'ready' } satisfies FaceResponse);
    } else if (request.type === 'segment') {
      const response = await segment(request);
      if (response.kind === 'mask')
        postMessage(response, { transfer: [response.mask.data.buffer] });
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
