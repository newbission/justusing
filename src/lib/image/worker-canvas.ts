/**
 * 사진 한 장을 원본째 들고 다시 그려 저장하는 워커들이 같이 쓰는 부분 (자르기·회전, 모자이크).
 * 워커 안에서만 부른다 (OffscreenCanvas).
 */

export interface UprightImage {
  /** 바로 세운 원본 (워커가 들고 있다가 저장에 쓴다) */
  source: ImageBitmap;
  /** 긴 변을 previewSide 이하로 줄인 미리보기 (화면에 넘긴다) */
  preview: ImageBitmap;
}

/** 사진을 EXIF 방향대로 바로 세워 읽고 미리보기를 만든다. 읽지 못하면 예외 */
export async function openUpright(file: Blob, previewSide: number): Promise<UprightImage> {
  // 휴대폰 사진의 EXIF 방향을 적용해 바로 세운다
  const source = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const { width, height } = source;
  const scale = Math.min(1, previewSide / Math.max(width, height));
  try {
    const preview = await createImageBitmap(source, {
      resizeWidth: Math.max(1, Math.round(width * scale)),
      resizeHeight: Math.max(1, Math.round(height * scale)),
      resizeQuality: 'high',
    });
    return { source, preview };
  } catch (error) {
    source.close();
    throw error;
  }
}

/** canvas를 만들었는지 맨 끝 화소로 확인한다. 한계를 넘으면 오류 없이 아무것도 그리지 않는다 (Safari) */
export function usableContext(
  canvas: OffscreenCanvas,
): OffscreenCanvasRenderingContext2D | undefined {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return undefined;
  const x = canvas.width - 1;
  const y = canvas.height - 1;
  ctx.fillStyle = '#010203';
  ctx.fillRect(x, y, 1, 1);
  const probe = ctx.getImageData(x, y, 1, 1).data;
  return probe[0] === 1 && probe[1] === 2 && probe[2] === 3 ? ctx : undefined;
}
