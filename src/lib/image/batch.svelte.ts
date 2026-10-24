/**
 * 여러 이미지를 받아 목록으로 들고 있는다 (이미지 압축·크기 조절 같은 여러 장 도구).
 * 크기를 읽고 썸네일 주소를 만들고, 빼면 썸네일 메모리를 돌려준다. 파일은 어디로도 보내지 않는다.
 */
import { readForDisplay } from './heif';
import type { OutputType } from './process';

export interface BatchItem {
  id: number;
  name: string;
  file: File;
  /** 원래 형식. JPG·PNG·WebP가 아니면 없다 (anyFormat이 아니면 열 수 없음으로 표시) */
  type?: OutputType;
  status: 'loading' | 'ready' | 'error';
  /** 바로 세운 뒤의 가로·세로 화소 */
  width: number;
  height: number;
  /** 목록 썸네일 (blob 주소). 원본, 또는 브라우저가 못 읽는 HEIC는 줄인 JPG */
  thumb?: string;
}

/** 받는 형식. 브라우저가 확실히 다시 저장할 수 있는 것만 받는다 */
export const BATCH_ACCEPT = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';
/** 형식 변환처럼 읽을 수 있으면 무엇이든 받을 때 (HEIC는 브라우저가 못 읽으면 libheif로 연다) */
const ANY_ACCEPT = 'image/*,.heic,.heif,.avif';
const ANY_IMAGE = /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif|tiff?|ico)$/i;

/** 브라우저가 못 읽는 HEIC의 목록·비교 화면용 미리보기 크기 (긴 변) */
const HEIF_PREVIEW_SIDE = 2048;

/** 결과 파일 확장자 */
export const EXTENSIONS: Record<OutputType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function typeOf(file: File): OutputType | undefined {
  if (file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name)) return 'image/jpeg';
  if (file.type === 'image/png' || /\.png$/i.test(file.name)) return 'image/png';
  if (file.type === 'image/webp' || /\.webp$/i.test(file.name)) return 'image/webp';
  return undefined;
}

export class ImageBatch {
  items: BatchItem[] = $state([]);
  readonly ready = $derived(this.items.filter((item) => item.status === 'ready'));
  readonly loading = $derived(this.items.some((item) => item.status === 'loading'));
  readonly totalSize = $derived(this.items.reduce((sum, item) => sum + item.file.size, 0));
  /** 파일 고르기 창에 넘길 형식 */
  readonly accept: string;
  readonly #anyFormat: boolean;
  #nextId = 0;

  /**
   * anyFormat: JPG·PNG·WebP가 아니어도 읽을 수 있으면 받는다 (형식 변환)
   * accept: 파일 고르기 창에 넘길 형식을 바꾼다 (HEIC 변환은 HEIC만 보이게). 끌어다 놓은 파일은 형식으로 거르지 않는다
   */
  constructor({ anyFormat = false, accept }: { anyFormat?: boolean; accept?: string } = {}) {
    this.#anyFormat = anyFormat;
    this.accept = accept ?? (anyFormat ? ANY_ACCEPT : BATCH_ACCEPT);
  }

  /** 이미지 파일만 더한다. 더한 것이 있으면 true */
  add(files: File[]): boolean {
    const images = files.filter(
      (file) =>
        file.type.startsWith('image/') ||
        (this.#anyFormat ? ANY_IMAGE : /\.(jpe?g|png|webp)$/i).test(file.name),
    );
    for (const file of images) {
      const type = typeOf(file);
      const readable = type !== undefined || this.#anyFormat;
      this.items.push({
        id: this.#nextId++,
        name: file.name,
        file,
        type,
        status: readable ? 'loading' : 'error',
        width: 0,
        height: 0,
      });
      if (readable) this.#load(this.items.at(-1)!);
    }
    return images.length > 0;
  }

  async #load(item: BatchItem) {
    try {
      // 브라우저가 못 읽는 HEIC(크롬 등의 아이폰 사진)는 libheif로 풀어 크기와 줄인 미리보기를 얻는다
      const info = await readForDisplay(item.file, HEIF_PREVIEW_SIDE);
      // 읽는 동안 목록에서 뺐으면 썸네일 주소를 만들지 않는다 (해제할 곳이 없어 메모리에 남는다)
      if (!this.items.includes(item)) return;
      item.width = info.width;
      item.height = info.height;
      item.thumb = URL.createObjectURL(info.display);
      item.status = 'ready';
    } catch {
      item.status = 'error';
    }
  }

  remove(item: BatchItem) {
    this.items = this.items.filter((other) => other !== item);
    if (item.thumb) URL.revokeObjectURL(item.thumb);
  }
}
