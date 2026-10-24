/**
 * 움직이는 WebP 묶기. 장면마다 브라우저가 저장한 WebP 한 장(canvas → image/webp)을 받아
 * 그 그림 조각(VP8·VP8L·ALPH)을 ANMF 조각으로 감싸 한 파일로 잇는다. 그림을 다시 풀거나 저장하지 않는다.
 * 형식: https://developers.google.com/speed/webp/docs/riff_container
 */

const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

/** 그림 한 장의 조각들 (VP8X·메타데이터 조각은 뺀다) */
export interface WebpStill {
  chunks: Uint8Array[];
  /** 투명도가 있는 조각 (ALPH, VP8L) */
  alpha: boolean;
}

/** WebP 파일 한 장에서 그림 조각을 꺼낸다. WebP가 아니면 예외 */
export function readStill(file: Uint8Array): WebpStill {
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  const tag = (at: number) => String.fromCharCode(...file.subarray(at, at + 4));
  if (file.length < 20 || tag(0) !== 'RIFF' || tag(8) !== 'WEBP') {
    throw new Error('WebP가 아닙니다');
  }
  const chunks: Uint8Array[] = [];
  let alpha = false;
  let image = false;
  for (let at = 12; at + 8 <= file.length;) {
    const name = tag(at);
    const size = view.getUint32(at + 4, true);
    const end = at + 8 + size;
    if (end > file.length) throw new Error('WebP 조각이 잘렸습니다');
    if (name === 'VP8 ' || name === 'VP8L' || name === 'ALPH') {
      // 홀수 크기 조각은 뒤에 0 한 바이트를 채운다 (파일 끝 조각은 채움이 빠져 있기도 하다)
      const padded = new Uint8Array(8 + size + (size & 1));
      padded.set(file.subarray(at, end));
      chunks.push(padded);
      if (name !== 'VP8 ') alpha = true;
      if (name !== 'ALPH') image = true;
    }
    at = end + (size & 1);
  }
  if (!image) throw new Error('WebP 그림 조각이 없습니다');
  return { chunks, alpha };
}

function uint24(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff];
}

function chunk(name: string, payload: Uint8Array[]): Uint8Array {
  const size = payload.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(8 + size + (size & 1));
  out.set(ascii(name), 0);
  new DataView(out.buffer).setUint32(4, size, true);
  let at = 8;
  for (const part of payload) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** ANMF 조각의 크기 (용량 예상: 그림 조각 + 머리) */
export const FRAME_OVERHEAD = 8 + 16;

/**
 * 장면들을 움직이는 WebP 하나로. 장면은 모두 width × height이고 앞 장면을 덮어 그린다(섞지 않음).
 * loop가 false면 한 번만 재생한다
 */
export function muxAnimation(
  frames: { still: WebpStill; duration: number }[],
  width: number,
  height: number,
  loop: boolean,
): Uint8Array {
  const alpha = frames.some((frame) => frame.still.alpha);
  const vp8x = chunk('VP8X', [
    new Uint8Array([alpha ? 0x12 : 0x02, 0, 0, 0, ...uint24(width - 1), ...uint24(height - 1)]),
  ]);
  // 배경색(BGRA)은 흰색 불투명, 반복 횟수 0 = 계속
  const anim = chunk('ANIM', [new Uint8Array([255, 255, 255, 255, loop ? 0 : 1, 0])]);
  const anmf = frames.map(({ still, duration }) =>
    chunk('ANMF', [
      new Uint8Array([
        ...uint24(0),
        ...uint24(0),
        ...uint24(width - 1),
        ...uint24(height - 1),
        ...uint24(Math.max(1, Math.round(duration))),
        // 섞지 않고 덮어 그림(bit 1), 다음 장면 전에 지우지 않음(bit 0 = 0)
        0b10,
      ]),
      ...still.chunks,
    ]),
  );
  const body = [new Uint8Array(ascii('WEBP')), vp8x, anim, ...anmf];
  const size = body.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(8 + size);
  out.set(ascii('RIFF'), 0);
  new DataView(out.buffer).setUint32(4, size, true);
  let at = 8;
  for (const part of body) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
