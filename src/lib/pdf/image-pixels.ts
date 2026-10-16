/**
 * PDF 안의 사진 화소 읽기 (사진을 다루는 워커들이 같이 쓴다): Flate 풀기, PNG 예측 풀기.
 */
/** Flate로 압축된 바이트를 푼다 */
export async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** PNG 예측(줄마다 앞에 붙은 필터 종류)을 풀어 화소만 남긴다 */
export function unpredict(
  data: Uint8Array,
  width: number,
  height: number,
  colors: number,
): Uint8Array {
  const row = width * colors;
  const out = new Uint8Array(row * height);
  for (let y = 0; y < height; y++) {
    const filter = data[y * (row + 1)];
    const src = y * (row + 1) + 1;
    const dst = y * row;
    for (let x = 0; x < row; x++) {
      const raw = data[src + x]!;
      const left = x >= colors ? out[dst + x - colors]! : 0;
      const up = y > 0 ? out[dst - row + x]! : 0;
      const upLeft = y > 0 && x >= colors ? out[dst - row + x - colors]! : 0;
      const predicted =
        filter === 1
          ? left
          : filter === 2
            ? up
            : filter === 3
              ? (left + up) >> 1
              : filter === 4
                ? paeth(left, up, upLeft)
                : 0;
      out[dst + x] = (raw + predicted) & 0xff;
    }
  }
  return out;
}
