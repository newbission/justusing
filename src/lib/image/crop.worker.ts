/**
 * 이미지 자르기·회전 워커 (crop.ts가 부른다). 사진은 메모리에서만 다룬다.
 *
 * 연 사진의 원본을 들고 있다가 저장할 때 돌리고 잘라 그린다. 결과를 canvas 하나에 그리지 못하는 크기면
 * (아이폰은 약 1,670만 화소까지) 줄 묶음씩 그려 이어 쓴다 (saveDrawing).
 * 다시 그려 저장하므로 EXIF(촬영 위치·기기 정보 등)는 결과에 남지 않는다.
 */
import { applyTurn, type Rect, type Turn } from './crop-geometry';
import type { CropFailure, CropRequest, CropResponse } from './crop';
import { openUpright, SaveFailure, saveDrawing, type UprightImage } from './worker-canvas';
import type { OutputType } from './process';

let source: ImageBitmap | undefined;

class Failure extends Error {
  constructor(readonly reason: CropFailure) {
    super(reason);
  }
}

async function open(file: Blob | ImageBitmap, previewSide: number) {
  source?.close();
  source = undefined;
  let opened: UprightImage;
  try {
    opened = await openUpright(file, previewSide);
  } catch {
    throw new Failure('decode');
  }
  source = opened.source;
  return { width: source.width, height: source.height, preview: opened.preview };
}

/** 결과의 [top, top + rows) 줄을 ctx에 그린다 */
function draw(
  ctx: OffscreenCanvasRenderingContext2D,
  image: ImageBitmap,
  turn: Turn,
  rect: Rect,
  top: number,
  rows: number,
  type: OutputType,
) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, rect.width, rows);
  if (type === 'image/jpeg') {
    // JPG에는 투명이 없어 흰 바탕 위에 그린다 (그냥 저장하면 투명한 곳이 검게 된다)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rows);
  }
  ctx.imageSmoothingQuality = 'high';
  applyTurn(ctx, image, turn, 1, rect.x, rect.y + top);
  ctx.drawImage(image, -image.width / 2, -image.height / 2);
}

async function save(turn: Turn, rect: Rect, type: OutputType, quality: number) {
  // 워커가 죽었다 살아났으면 원본이 없다 (화면은 사진을 다시 열게 한다)
  const image = source;
  if (!image) throw new Failure('decode');
  return saveDrawing(
    {
      width: rect.width,
      height: rect.height,
      whole: (ctx) => draw(ctx, image, turn, rect, 0, rect.height, type),
      strips: () => (ctx, top, rows) => {
        draw(ctx, image, turn, rect, top, rows, type);
        return ctx.getImageData(0, 0, rect.width, rows).data;
      },
    },
    type,
    quality,
  );
}

/**
 * 요청은 온 순서대로 하나씩 처리한다. 큰 사진 A를 여는 사이 B를 열면 B가 먼저 끝나고
 * 늦게 끝난 A가 원본을 덮어써, 화면은 B인데 A를 저장하게 된다
 */
let queue: Promise<void> = Promise.resolve();

addEventListener('message', (event: MessageEvent<CropRequest>) => {
  queue = queue.then(() => handle(event.data)).catch(() => undefined);
});

async function handle(request: CropRequest) {
  const send = (response: CropResponse, transfer: Transferable[] = []) =>
    postMessage(response, { transfer });
  try {
    if (request.kind === 'open') {
      const opened = await open(request.file, request.previewSide);
      send({ id: request.id, kind: 'opened', ...opened }, [opened.preview]);
    } else {
      const bytes = await save(request.turn, request.rect, request.type, request.quality);
      send({ id: request.id, kind: 'exported', bytes }, [bytes.buffer]);
    }
  } catch (error) {
    send({
      id: request.id,
      kind: 'error',
      reason:
        error instanceof Failure || error instanceof SaveFailure
          ? error.reason
          : request.kind === 'open'
            ? 'decode'
            : 'tooLarge',
    });
  }
}
