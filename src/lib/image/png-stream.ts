/**
 * 아주 긴 PNG를 줄 묶음씩 받아 저장한다 (이미지 이어 붙이기). 결과 전체를 canvas 하나에 그리지 않아
 * 브라우저 canvas 크기 한계(아이폰은 약 1,670만 화소)를 넘는 이미지도 만들 수 있다.
 * 압축은 브라우저의 CompressionStream('deflate')(zlib 형식)이 한다.
 */
import { crc32 } from '../crc32';

export class PngStream {
  readonly #width: number;
  readonly #height: number;
  /** 화소 하나의 바이트 수 (RGB 3, RGBA 4) */
  readonly #channels: number;
  readonly #writer: WritableStreamDefaultWriter<BufferSource>;
  readonly #compressed: Promise<ArrayBuffer>;
  /** 필터에 쓰는 바로 윗줄 (처음에는 0) */
  #previous: Uint8Array<ArrayBuffer>;
  #rows = 0;

  /** alpha: 투명도를 담는다 (아니면 RGB로 저장해 작아진다) */
  constructor(width: number, height: number, alpha: boolean) {
    this.#width = width;
    this.#height = height;
    this.#channels = alpha ? 4 : 3;
    this.#previous = new Uint8Array(width * this.#channels);
    const stream = new CompressionStream('deflate');
    this.#writer = stream.writable.getWriter();
    this.#compressed = new Response(stream.readable).arrayBuffer();
  }

  /** RGBA 화소(ImageData.data)의 줄 몇 개를 위에서부터 이어서 쓴다 */
  async write(rgba: Uint8ClampedArray, rows: number): Promise<void> {
    if (this.#rows + rows > this.#height) throw new Error('PNG 높이를 넘었습니다');
    const stride = this.#width * this.#channels;
    const out = new Uint8Array((stride + 1) * rows);
    let current = new Uint8Array(stride);
    for (let y = 0; y < rows; y++) {
      for (let x = 0, from = y * this.#width * 4, to = 0; x < this.#width; x++, from += 4) {
        current[to++] = rgba[from]!;
        current[to++] = rgba[from + 1]!;
        current[to++] = rgba[from + 2]!;
        if (this.#channels === 4) current[to++] = rgba[from + 3]!;
      }
      filterRow(current, this.#previous, this.#channels, out.subarray(y * (stride + 1)));
      [this.#previous, current] = [current, this.#previous];
    }
    this.#rows += rows;
    await this.#writer.write(out);
  }

  /** 모든 줄을 쓴 뒤 PNG 파일을 돌려준다 */
  async finish(): Promise<Uint8Array> {
    if (this.#rows !== this.#height) throw new Error('PNG 줄이 모자랍니다');
    await this.#writer.close();
    const data = new Uint8Array(await this.#compressed);
    const header = new Uint8Array(13);
    const view = new DataView(header.buffer);
    view.setUint32(0, this.#width);
    view.setUint32(4, this.#height);
    // 8비트, 색 종류 2(RGB)·6(RGB+투명도)
    header.set([8, this.#channels === 4 ? 6 : 2, 0, 0, 0], 8);
    const parts = [
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', header),
      chunk('IDAT', data),
      chunk('IEND', new Uint8Array()),
    ];
    const png = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
    let at = 0;
    for (const part of parts) {
      png.set(part, at);
      at += part.length;
    }
    return png;
  }
}

/**
 * 한 줄을 필터해 out에 쓴다 (첫 바이트는 필터 종류). 없음·왼쪽·위·Paeth 가운데 값의 절댓값 합이
 * 가장 작은 것을 고른다 (PNG 명세가 권하는 방법). 화면 캡처처럼 같은 색이 이어지면 훨씬 작아진다
 */
function filterRow(row: Uint8Array, up: Uint8Array, bpp: number, out: Uint8Array) {
  const length = row.length;
  const costs = [0, 0, 0, 0];
  for (let i = 0; i < length; i++) {
    const a = i >= bpp ? row[i - bpp]! : 0;
    const b = up[i]!;
    const c = i >= bpp ? up[i - bpp]! : 0;
    const x = row[i]!;
    costs[0]! += signed(x);
    costs[1]! += signed(x - a);
    costs[2]! += signed(x - b);
    costs[3]! += signed(x - paeth(a, b, c));
  }
  const best = costs.indexOf(Math.min(...costs));
  out[0] = [0, 1, 2, 4][best]!;
  for (let i = 0; i < length; i++) {
    const a = i >= bpp ? row[i - bpp]! : 0;
    const b = up[i]!;
    const c = i >= bpp ? up[i - bpp]! : 0;
    const x = row[i]!;
    const predicted = best === 0 ? 0 : best === 1 ? a : best === 2 ? b : paeth(a, b, c);
    out[i + 1] = (x - predicted) & 0xff;
  }
}

/** 바이트 차이를 -128~127로 보고 그 크기 */
function signed(value: number): number {
  const byte = value & 0xff;
  return byte < 128 ? byte : 256 - byte;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function chunk(type: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + body.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, body.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(body, 8);
  view.setUint32(8 + body.length, crc32(out.subarray(4, 8 + body.length)));
  return out;
}
