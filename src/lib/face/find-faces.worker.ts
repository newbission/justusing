/**
 * 여러 얼굴 찾기 워커 (find-faces.ts가 부른다). MediaPipe Face Detector(BlazeFace full range)를 이 워커 안에서 돌린다.
 * 사진을 여러 크기의 조각으로 나눠 조각마다 찾고 같은 얼굴을 합친다 (face-boxes.ts).
 * 엔진은 화면이 넘겨준 바이트로 띄우고 워커는 아무 데서도 받지 않는다 (mediapipe-engine.ts가 fetch도 없앤다).
 * 사진은 메모리에서만 다룬다.
 */
import { FaceDetector } from '@mediapipe/tasks-vision';
import { cutByTile, mergeFaces, tilesFor, type FoundFace } from './face-boxes';
import type { FindFacesRequest, FindFacesResponse } from './find-faces';
import { NO_FILES, launch, setEngine } from './mediapipe-engine';

/** 모델 입력 크기. 조각을 이 크기로 줄여 넘긴다 (모델이 다시 줄이지 않게) */
const INPUT = 192;
/** 이보다 가능성이 낮으면 얼굴로 보지 않는다 (MediaPipe 기본값) */
const MIN_SCORE = 0.5;

let detector: FaceDetector | undefined;

async function init(request: Extract<FindFacesRequest, { type: 'init' }>) {
  setEngine(request.engine);
  detector = await launch(() =>
    FaceDetector.createFromOptions(NO_FILES, {
      baseOptions: { modelAssetBuffer: request.model, delegate: 'CPU' },
      runningMode: 'IMAGE',
      minDetectionConfidence: MIN_SCORE,
    }),
  );
}

function find(request: Extract<FindFacesRequest, { type: 'find' }>): FoundFace[] {
  if (!detector) throw new Error('not initialized');
  const { bitmap } = request;
  try {
    const tiles = tilesFor(bitmap.width, bitmap.height);
    const found: FoundFace[] = [];
    let canvas: OffscreenCanvas | undefined;
    tiles.forEach((tile, index) => {
      const k = INPUT / Math.max(tile.width, tile.height);
      const w = Math.max(1, Math.round(tile.width * k));
      const h = Math.max(1, Math.round(tile.height * k));
      if (canvas?.width !== w || canvas.height !== h) canvas = new OffscreenCanvas(w, h);
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, tile.x, tile.y, tile.width, tile.height, 0, 0, w, h);
      for (const detection of detector!.detect(canvas).detections) {
        const box = detection.boundingBox;
        if (!box) continue;
        const sx = tile.width / w;
        const sy = tile.height / h;
        const face = {
          x: tile.x + box.originX * sx,
          y: tile.y + box.originY * sy,
          width: box.width * sx,
          height: box.height * sy,
          score: detection.categories[0]?.score ?? 0,
        };
        if (!cutByTile(face, tile, bitmap.width, bitmap.height)) found.push(face);
      }
      postMessage({
        id: request.id,
        kind: 'progress',
        done: index + 1,
        total: tiles.length,
      } satisfies FindFacesResponse);
    });
    return mergeFaces(found);
  } finally {
    bitmap.close();
  }
}

addEventListener('message', async (event: MessageEvent<FindFacesRequest>) => {
  const request = event.data;
  try {
    if (request.type === 'init') {
      await init(request);
      postMessage({ id: request.id, kind: 'ready' } satisfies FindFacesResponse);
    } else {
      postMessage({
        id: request.id,
        kind: 'faces',
        faces: find(request),
      } satisfies FindFacesResponse);
    }
  } catch (error) {
    postMessage({
      id: request.id,
      kind: 'error',
      message: error instanceof Error ? error.message : String(error),
    } satisfies FindFacesResponse);
  }
});
