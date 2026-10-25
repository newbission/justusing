/**
 * 배경 지우기의 사진 워커 (cutout.ts가 부른다). 사진은 메모리에서만 다룬다.
 *
 * 두 가지 일을 한다.
 * - 고치는 사진 한 장(open·mask·preview): 미리보기 사진과 마스크를 들고 있다가 미리보기를 그린다. 요청마다 어느 사진인지
 *   (photo) 함께 받아, 들고 있는 사진이 아니면 그리지 않는다 (다른 사진의 마스크가 섞이지 않게)
 * - 들고 있지 않는 일(prepare·thumb·export): 필요한 것을 모두 받아 처리하고 버린다. 여러 장을 워커 여러 개가 나눠 한다.
 *   저장(export)은 파일을 원본 크기로 다시 읽어, 다듬은 투명도(물체 나누기용 작은 크기)를 원본 크기로 늘려 깔고, 붓질로
 *   지우거나 되살린 뒤, 그 모양대로 원본을 남긴다. 배경색을 고르면 뒤에 칠한다. canvas 하나에 그리지 못하는 크기면
 *   (아이폰은 약 1,670만 화소까지) 줄 묶음씩 그려 이어 쓴다 (saveDrawing). 원본은 저장하는 동안만 든다.
 * 다시 그려 저장하므로 EXIF(촬영 위치·기기 정보 등)는 결과에 남지 않는다.
 */
import type { CutoutFailure, CutoutRequest, CutoutResponse, TrimBox } from './cutout';
import { bounds, refine, type Look, type Mask } from './matte';
import { openUpright, SaveFailure, saveDrawing } from '../image/worker-canvas';
import type { OutputType } from '../image/process';

/** 다듬은 투명도 그림 (다듬기 설정이 같으면 다시 쓴다) */
interface Alpha {
  mask: Mask;
  cache?: { key: string; canvas: OffscreenCanvas };
}

/** 고치는 사진 */
let slot:
  | {
      photo: number;
      /** 화면에 넘긴 것과 같은 미리보기 사진 (미리보기를 그릴 때 바탕) */
      base: ImageBitmap;
      alpha?: Alpha;
    }
  | undefined;
let previewCanvas: OffscreenCanvas | undefined;

class Failure extends Error {
  constructor(readonly reason: CutoutFailure | 'stale') {
    super(reason);
  }
}

async function shrink(image: ImageBitmap, side: number) {
  const scale = Math.min(1, side / Math.max(image.width, image.height));
  return createImageBitmap(image, {
    resizeWidth: Math.max(1, Math.round(image.width * scale)),
    resizeHeight: Math.max(1, Math.round(image.height * scale)),
    resizeQuality: 'high',
  });
}

/** 사진을 바로 세워 읽는다 (EXIF 방향). 읽지 못하면 Failure('decode') */
async function upright(file: Blob | ImageBitmap): Promise<ImageBitmap> {
  try {
    return file instanceof ImageBitmap
      ? file
      : await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Failure('decode');
  }
}

async function open(request: Extract<CutoutRequest, { kind: 'open' }>) {
  slot?.base.close();
  slot = undefined;
  let opened;
  try {
    opened = await openUpright(request.file, request.previewSide);
  } catch {
    throw new Failure('decode');
  }
  // 원본은 들고 있지 않는다 (저장할 때 파일을 다시 읽는다). 여러 장을 고쳐도 큰 원본이 쌓이지 않게
  const { source } = opened;
  try {
    // 화면에 넘기는 미리보기는 옮겨지므로(transfer) 미리보기를 그릴 바탕을 하나 더 둔다
    const base = await createImageBitmap(opened.preview);
    const analysis = await shrink(source, request.analysisSide);
    slot = { photo: request.photo, base };
    return { width: source.width, height: source.height, preview: opened.preview, analysis };
  } finally {
    source.close();
  }
}

/** 사진을 읽어 크기와 물체 나누기용 사진·목록 그림 바탕만 만든다 (여러 장을 읽고 미리 나눌 때) */
async function prepare(request: Extract<CutoutRequest, { kind: 'prepare' }>) {
  const source = await upright(request.file);
  try {
    const analysis =
      request.analysisSide > 0 ? await shrink(source, request.analysisSide) : undefined;
    const thumb = request.thumbSide > 0 ? await shrink(source, request.thumbSide) : undefined;
    return { width: source.width, height: source.height, analysis, thumb };
  } finally {
    source.close();
  }
}

/** 다듬은 투명도를 그림으로 (흰색, 투명도만 다름) */
function alphaImage(alpha: Alpha, look: Look): OffscreenCanvas {
  const { mask } = alpha;
  const key = `${look.edge.shift}:${look.edge.soft}`;
  if (alpha.cache?.key === key) return alpha.cache.canvas;
  const values = refine(mask, look.edge);
  const pixels = new ImageData(mask.width, mask.height);
  for (let i = 0; i < values.length; i++) {
    pixels.data[i * 4] = 255;
    pixels.data[i * 4 + 1] = 255;
    pixels.data[i * 4 + 2] = 255;
    pixels.data[i * 4 + 3] = values[i]!;
  }
  const canvas = new OffscreenCanvas(mask.width, mask.height);
  canvas.getContext('2d')!.putImageData(pixels, 0, 0);
  alpha.cache = { key, canvas };
  return canvas;
}

/**
 * 결과의 한 부분을 ctx에 그린다. 사진 전체를 full 크기로 볼 때 (ox, oy)부터 width × height만큼이다.
 * image가 없으면 남길 모양(투명도)만 그린다
 */
function paint(
  ctx: OffscreenCanvasRenderingContext2D,
  alpha: Alpha,
  look: Look,
  image: ImageBitmap | undefined,
  full: { width: number; height: number },
  ox: number,
  oy: number,
  width: number,
  height: number,
) {
  const shape = alphaImage(alpha, look);
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(shape, -ox, -oy, full.width, full.height);
  const side = Math.max(full.width, full.height);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const stroke of look.strokes) {
    if (stroke.points.length === 0) continue;
    ctx.globalCompositeOperation = stroke.mode === 'erase' ? 'destination-out' : 'source-over';
    const at = (point: { x: number; y: number }) =>
      [point.x * full.width - ox, point.y * full.height - oy] as const;
    const radius = (stroke.size * side) / 2;
    if (stroke.points.length === 1) {
      const [x, y] = at(stroke.points[0]!);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.lineWidth = radius * 2;
    ctx.beginPath();
    ctx.moveTo(...at(stroke.points[0]!));
    for (const point of stroke.points.slice(1)) ctx.lineTo(...at(point));
    ctx.stroke();
  }
  if (image) {
    ctx.globalCompositeOperation = 'source-in';
    ctx.drawImage(image, -ox, -oy, full.width, full.height);
    if (look.background) {
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = look.background;
      ctx.fillRect(0, 0, width, height);
    }
  }
  ctx.restore();
}

/** 붓질까지 반영해 남은 곳을 둘러싼 자리 (사진에 대한 비율, 둘레에 긴 변의 1%를 더함). 남은 곳이 없으면 undefined */
function trimBox(alpha: Alpha, look: Look): TrimBox | undefined {
  const { width, height } = alpha.mask;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  paint(ctx, alpha, look, undefined, { width, height }, 0, 0, width, height);
  const box = bounds(ctx.getImageData(0, 0, width, height).data, width, height, 4);
  if (!box) return undefined;
  const pad = Math.max(width, height) * 0.01;
  const x0 = Math.max(0, box.x - pad);
  const y0 = Math.max(0, box.y - pad);
  const x1 = Math.min(width, box.x + box.width + pad);
  const y1 = Math.min(height, box.y + box.height + pad);
  return { x: x0 / width, y: y0 / height, width: (x1 - x0) / width, height: (y1 - y0) / height };
}

/** 들고 있는 사진이 photo인지 확인한다. 다른 사진이면 그 사진의 마스크로 그리지 않는다 */
function slotFor(photo: number) {
  if (!slot || slot.photo !== photo) throw new Failure('stale');
  return slot;
}

function renderPreview(request: Extract<CutoutRequest, { kind: 'preview' }>) {
  const current = slotFor(request.photo);
  if (!current.alpha) throw new Failure('empty');
  const { look } = request;
  const { base } = current;
  const { width, height } = base;
  if (previewCanvas?.width !== width || previewCanvas.height !== height) {
    previewCanvas = new OffscreenCanvas(width, height);
  }
  const ctx = previewCanvas.getContext('2d')!;
  paint(ctx, current.alpha, look, base, { width, height }, 0, 0, width, height);
  const image = previewCanvas.transferToImageBitmap();
  return { image, box: look.trim ? trimBox(current.alpha, look) : undefined };
}

/** 목록에 보일 작은 결과 그림 (물체에 맞춰 자르지는 않는다) */
function renderThumb(request: Extract<CutoutRequest, { kind: 'thumb' }>) {
  const { base } = request;
  try {
    const { width, height } = base;
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d')!;
    paint(ctx, { mask: request.mask }, request.look, base, { width, height }, 0, 0, width, height);
    return canvas.transferToImageBitmap();
  } finally {
    base.close();
  }
}

async function save(request: Extract<CutoutRequest, { kind: 'export' }>) {
  const { look, type, quality } = request;
  const alpha: Alpha = { mask: request.mask };
  const box = trimBox(alpha, look);
  if (!box) {
    if (request.file instanceof ImageBitmap) request.file.close();
    throw new Failure('empty');
  }
  const image = await upright(request.file);
  try {
    return await draw(image, alpha, look, box, type, quality);
  } finally {
    image.close();
  }
}

async function draw(
  image: ImageBitmap,
  alpha: Alpha,
  look: Look,
  box: TrimBox,
  type: OutputType,
  quality: number,
) {
  const full = { width: image.width, height: image.height };
  let area = { x: 0, y: 0, width: full.width, height: full.height };
  if (look.trim) {
    const x = Math.floor(box.x * full.width);
    const y = Math.floor(box.y * full.height);
    area = {
      x,
      y,
      width: Math.max(1, Math.min(full.width, Math.ceil((box.x + box.width) * full.width)) - x),
      height: Math.max(1, Math.min(full.height, Math.ceil((box.y + box.height) * full.height)) - y),
    };
  }
  const bytes = await saveDrawing(
    {
      width: area.width,
      height: area.height,
      whole: (ctx) => paint(ctx, alpha, look, image, full, area.x, area.y, area.width, area.height),
      strips: () => (ctx, top, rows) => {
        paint(ctx, alpha, look, image, full, area.x, area.y + top, area.width, rows);
        return ctx.getImageData(0, 0, area.width, rows).data;
      },
    },
    type,
    quality,
    { alpha: !look.background },
  );
  return { bytes, width: area.width, height: area.height };
}

/**
 * 요청은 온 순서대로 하나씩 처리한다. 큰 사진 A를 여는 사이 B를 열면 B가 먼저 끝나고
 * 늦게 끝난 A가 고치는 사진을 덮어써, 화면은 B인데 A의 미리보기를 그리게 된다
 */
let queue: Promise<void> = Promise.resolve();

addEventListener('message', (event: MessageEvent<CutoutRequest>) => {
  queue = queue.then(() => handle(event.data)).catch(() => undefined);
});

async function handle(request: CutoutRequest) {
  const send = (response: CutoutResponse, transfer: Transferable[] = []) =>
    postMessage(response, { transfer });
  try {
    if (request.kind === 'open') {
      const opened = await open(request);
      send({ id: request.id, kind: 'opened', ...opened }, [opened.preview, opened.analysis]);
    } else if (request.kind === 'mask') {
      slotFor(request.photo).alpha = { mask: request.mask };
      send({ id: request.id, kind: 'done' });
    } else if (request.kind === 'preview') {
      const { image, box } = renderPreview(request);
      send({ id: request.id, kind: 'previewed', image, box }, [image]);
    } else if (request.kind === 'prepare') {
      const prepared = await prepare(request);
      send(
        { id: request.id, kind: 'prepared', ...prepared },
        [prepared.analysis, prepared.thumb].filter((image) => image !== undefined),
      );
    } else if (request.kind === 'thumb') {
      const image = renderThumb(request);
      send({ id: request.id, kind: 'thumbed', image }, [image]);
    } else {
      const saved = await save(request);
      send({ id: request.id, kind: 'exported', ...saved }, [saved.bytes.buffer]);
    }
  } catch (error) {
    send({
      id: request.id,
      kind: 'error',
      reason:
        error instanceof Failure || error instanceof SaveFailure
          ? error.reason
          : request.kind === 'open' || request.kind === 'prepare'
            ? 'decode'
            : 'tooLarge',
    });
  }
}
