/**
 * 물체 나누기 워커 (objects.ts가 부른다). MediaPipe Interactive Segmenter(MagicTouch)를 이 워커 안에서 돌린다.
 * 누른 점마다 그 점이 가리키는 물체·사람·동물을 나누고, 모두 겹친 마스크를 낸다. 점마다 나눈 결과는 사진이 바뀔
 * 때까지 기억해 다시 나누지 않는다 (겹치기도 화면이 멈추지 않게 이 워커에서 한다). 엔진은 화면이 넘겨준 바이트로 띄우고
 * 워커는 아무 데서도 받지 않는다 (mediapipe-engine.ts). 사진은 메모리에서만 다룬다.
 */
import { InteractiveSegmenterLegacy } from '@mediapipe/tasks-vision';
import { NO_FILES, launch, setEngine } from '../face/mediapipe-engine';
import { coverage, union, type Mask, type Point } from './matte';
import type { ObjectsRequest, ObjectsResponse } from './objects';

let segmenter: InteractiveSegmenterLegacy | undefined;
/** 나눌 사진 (살피기용으로 줄인 것). 새 사진을 받으면 바뀐다 */
let image: ImageBitmap | undefined;
/** 지금 사진에서 점마다 나눈 마스크 */
const masks = new Map<string, Mask>();
const keyOf = (point: Point) => `${point.x.toFixed(4)},${point.y.toFixed(4)}`;

async function init(request: Extract<ObjectsRequest, { type: 'init' }>) {
  setEngine(request.engine);
  segmenter = await launch(() =>
    InteractiveSegmenterLegacy.createFromOptions(NO_FILES, {
      baseOptions: { modelAssetBuffer: request.model, delegate: 'CPU' },
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    }),
  );
}

/** 점 하나가 가리키는 물체일 가능성 (0~255, 사진과 같은 크기) */
function segmentPoint(point: Point): Mask {
  const result = segmenter!.segment(image!, { keypoint: point });
  try {
    // 첫 번째 확신 마스크가 누른 물체일 가능성이다 (모델 카드: 물체·배경 두 갈래를 softmax한 값)
    const mask = result.confidenceMasks![0]!;
    const values = mask.getAsFloat32Array();
    const data = new Uint8Array(values.length);
    for (let i = 0; i < values.length; i++) data[i] = Math.round(values[i]! * 255);
    return { data, width: mask.width, height: mask.height };
  } finally {
    result.close();
  }
}

function segment(request: Extract<ObjectsRequest, { type: 'segment' }>): ObjectsResponse {
  if (!segmenter) throw new Error('not initialized');
  if (!image) throw new Error('no image');
  const list = request.points.map((point) => {
    const key = keyOf(point);
    let mask = masks.get(key);
    if (!mask) {
      mask = segmentPoint(point);
      masks.set(key, mask);
    }
    return mask;
  });
  const merged = union(list, image.width, image.height);
  return { id: request.id, kind: 'mask', mask: merged, coverage: coverage(merged) };
}

addEventListener('message', async (event: MessageEvent<ObjectsRequest>) => {
  const request = event.data;
  try {
    if (request.type === 'init') {
      await init(request);
      postMessage({ id: request.id, kind: 'ready' } satisfies ObjectsResponse);
    } else if (request.type === 'image') {
      image?.close();
      image = request.bitmap;
      masks.clear();
      postMessage({ id: request.id, kind: 'ready' } satisfies ObjectsResponse);
    } else {
      const response = segment(request);
      if (response.kind === 'mask')
        postMessage(response, { transfer: [response.mask.data.buffer] });
    }
  } catch (error) {
    postMessage({
      id: request.id,
      kind: 'error',
      message: error instanceof Error ? error.message : String(error),
    } satisfies ObjectsResponse);
  }
});
