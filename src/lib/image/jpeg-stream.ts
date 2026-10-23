/**
 * 아주 큰 JPG를 줄 묶음씩 받아 저장한다 (자르기·회전, 모자이크, 이어 붙이기). 결과 전체를 canvas 하나에
 * 그리지 않아 브라우저 canvas 크기 한계(아이폰은 약 1,670만 화소)를 넘는 사진도 JPG로 만들 수 있다.
 *
 * 기본(baseline) JPEG: 색 줄이기 4:2:0, JPEG 표준(부록 K)의 양자화표를 품질에 맞춰 늘이고(IJG 방식,
 * 브라우저 저장과 같은 계산) 표준 허프만표를 쓴다. 16줄(MCU 한 줄)이 모일 때마다 바로 압축하고 버리므로
 * 들고 있는 화소는 16줄뿐이다. 투명한 곳은 흰 바탕 위에 놓은 색으로 저장한다.
 */

/** JPEG 머리에 적을 수 있는 가장 긴 변 (libjpeg가 읽는 한계 65,500) */
export const JPEG_MAX_SIDE = 65_500;

/** 지그재그 순서의 i번째 계수가 8×8 칸(가로 줄 순서)에서 놓인 자리 */
const ZIGZAG = (() => {
  const order: number[] = [];
  for (let s = 0; s < 15; s++) {
    const low = Math.max(0, s - 7);
    const high = Math.min(s, 7);
    if (s % 2 === 0) for (let y = high; y >= low; y--) order.push(y * 8 + (s - y));
    else for (let y = low; y <= high; y++) order.push(y * 8 + (s - y));
  }
  return order;
})();

// 표준 양자화표 (가로 줄 순서, 부록 K.1)
const LUMA_QUANT = [
  16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55, 14, 13, 16, 24, 40, 57, 69, 56,
  14, 17, 22, 29, 51, 87, 80, 62, 18, 22, 37, 56, 68, 109, 103, 77, 24, 35, 55, 64, 81, 104, 113,
  92, 49, 64, 78, 87, 103, 121, 120, 101, 72, 92, 95, 98, 112, 100, 103, 99,
];
const CHROMA_QUANT = [
  17,
  18,
  24,
  47,
  99,
  99,
  99,
  99,
  18,
  21,
  26,
  66,
  99,
  99,
  99,
  99,
  24,
  26,
  56,
  99,
  99,
  99,
  99,
  99,
  47,
  66,
  99,
  99,
  99,
  99,
  99,
  99,
  ...Array<number>(32).fill(99),
];

// 표준 허프만표 (부록 K.3): 길이 1~16인 부호 수, 값
const LUMA_DC = { counts: [0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0], values: range(12) };
const CHROMA_DC = { counts: [0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0], values: range(12) };
const LUMA_AC = {
  counts: [0, 2, 1, 3, 3, 2, 4, 3, 5, 5, 4, 4, 0, 0, 1, 0x7d],
  values: [
    0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07,
    0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08, 0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0,
    0x24, 0x33, 0x62, 0x72, 0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28,
    0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49,
    0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69,
    0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
    0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7,
    0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5,
    0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2,
    0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8,
    0xf9, 0xfa,
  ],
};
const CHROMA_AC = {
  counts: [0, 2, 1, 2, 4, 4, 3, 4, 7, 5, 4, 4, 0, 1, 2, 0x77],
  values: [
    0x00, 0x01, 0x02, 0x03, 0x11, 0x04, 0x05, 0x21, 0x31, 0x06, 0x12, 0x41, 0x51, 0x07, 0x61, 0x71,
    0x13, 0x22, 0x32, 0x81, 0x08, 0x14, 0x42, 0x91, 0xa1, 0xb1, 0xc1, 0x09, 0x23, 0x33, 0x52, 0xf0,
    0x15, 0x62, 0x72, 0xd1, 0x0a, 0x16, 0x24, 0x34, 0xe1, 0x25, 0xf1, 0x17, 0x18, 0x19, 0x1a, 0x26,
    0x27, 0x28, 0x29, 0x2a, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48,
    0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68,
    0x69, 0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87,
    0x88, 0x89, 0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5,
    0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3,
    0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda,
    0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8,
    0xf9, 0xfa,
  ],
};

/** AAN DCT의 배율 (8×8 칸의 가로·세로 자리마다) */
const AAN_SCALE = [
  1.0, 1.387039845, 1.306562965, 1.175875602, 1.0, 0.785694958, 0.5411961, 0.275899379,
];

interface HuffmanSpec {
  counts: number[];
  values: number[];
}

/** 값 → 부호, 부호 길이 */
interface HuffmanTable {
  code: Uint16Array;
  length: Uint8Array;
}

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

/** 부호 길이별 수로 부호를 만든다 (부록 C) */
function huffman(spec: HuffmanSpec): HuffmanTable {
  const code = new Uint16Array(256);
  const length = new Uint8Array(256);
  let next = 0;
  let k = 0;
  for (let bits = 1; bits <= 16; bits++) {
    for (let i = 0; i < spec.counts[bits - 1]!; i++) {
      const value = spec.values[k++]!;
      code[value] = next++;
      length[value] = bits;
    }
    next <<= 1;
  }
  return { code, length };
}

/** 품질(0~1, canvas와 같은 뜻)에 맞춘 양자화표 (가로 줄 순서). IJG(libjpeg)와 같은 계산 */
function scaledQuant(base: number[], quality: number): Uint8Array {
  const q = Math.min(100, Math.max(1, Math.round(quality * 100)));
  const scale = q < 50 ? 5000 / q : 200 - q * 2;
  return Uint8Array.from(base, (value) =>
    Math.min(255, Math.max(1, Math.floor((value * scale + 50) / 100))),
  );
}

/** 양자화표를 DCT 결과에 바로 곱할 수로 (AAN 배율 포함) */
function divisors(quant: Uint8Array): Float32Array {
  const out = new Float32Array(64);
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const k = row * 8 + col;
      out[k] = 1 / (quant[k]! * AAN_SCALE[row]! * AAN_SCALE[col]! * 8);
    }
  }
  return out;
}

const LUMA_DC_TABLE = huffman(LUMA_DC);
const LUMA_AC_TABLE = huffman(LUMA_AC);
const CHROMA_DC_TABLE = huffman(CHROMA_DC);
const CHROMA_AC_TABLE = huffman(CHROMA_AC);

/** 압축한 바이트를 조각으로 모은다 (한 번에 큰 배열을 다시 잡지 않게) */
class ByteSink {
  readonly #parts: Uint8Array[] = [];
  #buffer = new Uint8Array(1 << 16);
  #at = 0;

  byte(value: number) {
    if (this.#at === this.#buffer.length) {
      this.#parts.push(this.#buffer);
      this.#buffer = new Uint8Array(1 << 20);
      this.#at = 0;
    }
    this.#buffer[this.#at++] = value;
  }

  bytes(values: ArrayLike<number>) {
    for (let i = 0; i < values.length; i++) this.byte(values[i]!);
  }

  word(value: number) {
    this.byte(value >> 8);
    this.byte(value & 0xff);
  }

  result(): Uint8Array {
    const total = this.#parts.reduce((sum, part) => sum + part.length, 0) + this.#at;
    const out = new Uint8Array(total);
    let at = 0;
    for (const part of this.#parts) {
      out.set(part, at);
      at += part.length;
    }
    out.set(this.#buffer.subarray(0, this.#at), at);
    return out;
  }
}

export class JpegStream {
  readonly #width: number;
  readonly #height: number;
  /** 16의 배수로 늘린 폭 (오른쪽 끝은 마지막 화소를 되풀이) */
  readonly #paddedWidth: number;
  readonly #lumaDivisors: Float32Array;
  readonly #chromaDivisors: Float32Array;
  readonly #sink = new ByteSink();
  /** 지금 모으는 16줄의 Y·Cb·Cr (가운데를 0으로 옮긴 값) */
  readonly #y: Float32Array;
  readonly #cb: Float32Array;
  readonly #cr: Float32Array;
  /** 지금 모은 줄 수 (0~15) */
  #bandRows = 0;
  #rows = 0;
  readonly #block = new Float32Array(64);
  readonly #coefficients = new Int32Array(64);
  #dcY = 0;
  #dcCb = 0;
  #dcCr = 0;
  #bitBuffer = 0;
  #bitCount = 0;

  /** quality: 0~1 (canvas convertToBlob과 같은 뜻) */
  constructor(width: number, height: number, quality: number) {
    if (width < 1 || height < 1 || width > JPEG_MAX_SIDE || height > JPEG_MAX_SIDE) {
      throw new RangeError('JPG에 담을 수 없는 크기입니다');
    }
    this.#width = width;
    this.#height = height;
    this.#paddedWidth = Math.ceil(width / 16) * 16;
    this.#y = new Float32Array(this.#paddedWidth * 16);
    this.#cb = new Float32Array(this.#paddedWidth * 16);
    this.#cr = new Float32Array(this.#paddedWidth * 16);
    const luma = scaledQuant(LUMA_QUANT, quality);
    const chroma = scaledQuant(CHROMA_QUANT, quality);
    this.#lumaDivisors = divisors(luma);
    this.#chromaDivisors = divisors(chroma);
    this.#writeHeaders(luma, chroma);
  }

  /** RGBA 화소(ImageData.data)의 줄 몇 개를 위에서부터 이어서 쓴다. 줄 수는 아무렇게나 나눠도 된다 */
  write(rgba: Uint8ClampedArray, rows: number): void {
    if (this.#rows + rows > this.#height) throw new Error('JPG 높이를 넘었습니다');
    for (let r = 0; r < rows; r++) {
      this.#convertRow(rgba, r * this.#width * 4);
      if (++this.#bandRows === 16) this.#flushBand();
    }
    this.#rows += rows;
  }

  /** 모든 줄을 쓴 뒤 JPG 파일을 돌려준다 */
  finish(): Uint8Array {
    if (this.#rows !== this.#height) throw new Error('JPG 줄이 모자랍니다');
    if (this.#bandRows > 0) {
      // 마지막 묶음의 모자란 줄은 마지막 줄을 되풀이한다 (디코더가 잘라 낸다)
      const stride = this.#paddedWidth;
      const last = (this.#bandRows - 1) * stride;
      for (let row = this.#bandRows; row < 16; row++) {
        this.#y.copyWithin(row * stride, last, last + stride);
        this.#cb.copyWithin(row * stride, last, last + stride);
        this.#cr.copyWithin(row * stride, last, last + stride);
      }
      this.#flushBand();
    }
    // 남은 비트는 1로 채운다
    if (this.#bitCount > 0) this.#bits(0x7f, 7);
    this.#sink.word(0xffd9);
    return this.#sink.result();
  }

  /** 한 줄을 YCbCr로 바꿔 지금 묶음에 넣는다 (투명한 곳은 흰 바탕 위에 놓은 색) */
  #convertRow(rgba: Uint8ClampedArray, from: number) {
    const at = this.#bandRows * this.#paddedWidth;
    const y = this.#y;
    const cb = this.#cb;
    const cr = this.#cr;
    for (let x = 0, i = from; x < this.#width; x++, i += 4) {
      let r = rgba[i]!;
      let g = rgba[i + 1]!;
      let b = rgba[i + 2]!;
      const a = rgba[i + 3]!;
      if (a !== 255) {
        const white = 255 - a;
        r = (r * a) / 255 + white;
        g = (g * a) / 255 + white;
        b = (b * a) / 255 + white;
      }
      y[at + x] = 0.299 * r + 0.587 * g + 0.114 * b - 128;
      cb[at + x] = -0.168736 * r - 0.331264 * g + 0.5 * b;
      cr[at + x] = 0.5 * r - 0.418688 * g - 0.081312 * b;
    }
    const edge = at + this.#width - 1;
    for (let x = this.#width; x < this.#paddedWidth; x++) {
      y[at + x] = y[edge]!;
      cb[at + x] = cb[edge]!;
      cr[at + x] = cr[edge]!;
    }
  }

  /** 모은 16줄을 MCU(밝기 8×8 넷 + 색 8×8 둘)씩 압축한다 */
  #flushBand() {
    const stride = this.#paddedWidth;
    const block = this.#block;
    for (let left = 0; left < stride; left += 16) {
      for (let part = 0; part < 4; part++) {
        const x0 = left + (part & 1) * 8;
        const y0 = (part >> 1) * 8;
        for (let v = 0; v < 8; v++) {
          const row = (y0 + v) * stride + x0;
          for (let u = 0; u < 8; u++) block[v * 8 + u] = this.#y[row + u]!;
        }
        this.#dcY = this.#encodeBlock(this.#lumaDivisors, this.#dcY, LUMA_DC_TABLE, LUMA_AC_TABLE);
      }
      this.#subsample(this.#cb, left);
      this.#dcCb = this.#encodeBlock(
        this.#chromaDivisors,
        this.#dcCb,
        CHROMA_DC_TABLE,
        CHROMA_AC_TABLE,
      );
      this.#subsample(this.#cr, left);
      this.#dcCr = this.#encodeBlock(
        this.#chromaDivisors,
        this.#dcCr,
        CHROMA_DC_TABLE,
        CHROMA_AC_TABLE,
      );
    }
    this.#bandRows = 0;
  }

  /** 색 16×16을 2×2 평균으로 8×8 칸에 넣는다 */
  #subsample(plane: Float32Array, left: number) {
    const stride = this.#paddedWidth;
    const block = this.#block;
    for (let v = 0; v < 8; v++) {
      const top = v * 2 * stride + left;
      const bottom = top + stride;
      for (let u = 0; u < 8; u++) {
        const x = u * 2;
        block[v * 8 + u] =
          (plane[top + x]! + plane[top + x + 1]! + plane[bottom + x]! + plane[bottom + x + 1]!) / 4;
      }
    }
  }

  /** 8×8 칸 하나를 DCT·양자화·허프만 부호로 쓴다. 이 칸의 DC 값을 돌려준다 */
  #encodeBlock(
    divisor: Float32Array,
    previousDc: number,
    dcTable: HuffmanTable,
    acTable: HuffmanTable,
  ): number {
    const data = this.#block;
    forwardDct(data);
    const coefficients = this.#coefficients;
    for (let i = 0; i < 64; i++) {
      const k = ZIGZAG[i]!;
      const value = data[k]! * divisor[k]!;
      coefficients[i] = value > 0 ? (value + 0.5) | 0 : (value - 0.5) | 0;
    }

    const dc = coefficients[0]!;
    this.#value(dc - previousDc, dcTable, 0);

    let end = 63;
    while (end > 0 && coefficients[end] === 0) end--;
    let run = 0;
    for (let i = 1; i <= end; i++) {
      const value = coefficients[i]!;
      if (value === 0) {
        run++;
        continue;
      }
      while (run >= 16) {
        this.#bits(acTable.code[0xf0]!, acTable.length[0xf0]!);
        run -= 16;
      }
      this.#value(value, acTable, run << 4);
      run = 0;
    }
    if (end < 63) this.#bits(acTable.code[0]!, acTable.length[0]!);
    return dc;
  }

  /** 값의 크기 범주(비트 수)를 허프만 부호로, 이어서 값 비트를 쓴다. prefix는 AC의 앞선 0 개수 */
  #value(value: number, table: HuffmanTable, prefix: number) {
    const magnitude = value < 0 ? -value : value;
    const size = magnitude === 0 ? 0 : 32 - Math.clz32(magnitude);
    const symbol = prefix | size;
    this.#bits(table.code[symbol]!, table.length[symbol]!);
    if (size > 0) this.#bits(value < 0 ? value + (1 << size) - 1 : value, size);
  }

  /** 비트를 쓴다. 0xFF 바이트 뒤에는 0을 넣는다 (표시 부호와 헷갈리지 않게) */
  #bits(value: number, count: number) {
    this.#bitBuffer = ((this.#bitBuffer << count) | (value & ((1 << count) - 1))) >>> 0;
    this.#bitCount += count;
    while (this.#bitCount >= 8) {
      this.#bitCount -= 8;
      const byte = (this.#bitBuffer >>> this.#bitCount) & 0xff;
      this.#sink.byte(byte);
      if (byte === 0xff) this.#sink.byte(0);
    }
    this.#bitBuffer &= (1 << this.#bitCount) - 1;
  }

  #writeHeaders(luma: Uint8Array, chroma: Uint8Array) {
    const sink = this.#sink;
    sink.word(0xffd8);
    // JFIF 1.1, 화소 비율 1:1
    sink.word(0xffe0);
    sink.word(16);
    sink.bytes([0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
    // 양자화표 둘 (지그재그 순서)
    sink.word(0xffdb);
    sink.word(2 + 65 * 2);
    sink.byte(0);
    for (const k of ZIGZAG) sink.byte(luma[k]!);
    sink.byte(1);
    for (const k of ZIGZAG) sink.byte(chroma[k]!);
    // 프레임: 8비트, 세 성분 (Y 2×2, Cb·Cr 1×1 = 4:2:0)
    sink.word(0xffc0);
    sink.word(17);
    sink.byte(8);
    sink.word(this.#height);
    sink.word(this.#width);
    sink.bytes([3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
    // 허프만표 넷
    sink.word(0xffc4);
    const specs: [number, HuffmanSpec][] = [
      [0x00, LUMA_DC],
      [0x10, LUMA_AC],
      [0x01, CHROMA_DC],
      [0x11, CHROMA_AC],
    ];
    sink.word(2 + specs.reduce((sum, [, spec]) => sum + 17 + spec.values.length, 0));
    for (const [id, spec] of specs) {
      sink.byte(id);
      sink.bytes(spec.counts);
      sink.bytes(spec.values);
    }
    // 스캔 시작
    sink.word(0xffda);
    sink.word(12);
    sink.bytes([3, 1, 0x00, 2, 0x11, 3, 0x11, 0, 63, 0]);
  }
}

/** 8×8 칸의 DCT (AAN, 제자리). 결과는 AAN 배율이 곱해진 값이라 divisors()로 나눈다 */
function forwardDct(data: Float32Array) {
  for (let pass = 0; pass < 2; pass++) {
    // 첫 번째는 가로 줄, 두 번째는 세로 줄
    const step = pass === 0 ? 1 : 8;
    const next = pass === 0 ? 8 : 1;
    for (let line = 0, base = 0; line < 8; line++, base += next) {
      const i0 = base;
      const i1 = base + step;
      const i2 = base + step * 2;
      const i3 = base + step * 3;
      const i4 = base + step * 4;
      const i5 = base + step * 5;
      const i6 = base + step * 6;
      const i7 = base + step * 7;
      const tmp0 = data[i0]! + data[i7]!;
      const tmp7 = data[i0]! - data[i7]!;
      const tmp1 = data[i1]! + data[i6]!;
      const tmp6 = data[i1]! - data[i6]!;
      const tmp2 = data[i2]! + data[i5]!;
      const tmp5 = data[i2]! - data[i5]!;
      const tmp3 = data[i3]! + data[i4]!;
      const tmp4 = data[i3]! - data[i4]!;

      // 짝수 부분
      const tmp10 = tmp0 + tmp3;
      const tmp13 = tmp0 - tmp3;
      const tmp11 = tmp1 + tmp2;
      const tmp12 = tmp1 - tmp2;
      data[i0] = tmp10 + tmp11;
      data[i4] = tmp10 - tmp11;
      const z1 = (tmp12 + tmp13) * 0.707106781;
      data[i2] = tmp13 + z1;
      data[i6] = tmp13 - z1;

      // 홀수 부분
      const odd10 = tmp4 + tmp5;
      const odd11 = tmp5 + tmp6;
      const odd12 = tmp6 + tmp7;
      const z5 = (odd10 - odd12) * 0.382683433;
      const z2 = 0.5411961 * odd10 + z5;
      const z4 = 1.306562965 * odd12 + z5;
      const z3 = odd11 * 0.707106781;
      const z11 = tmp7 + z3;
      const z13 = tmp7 - z3;
      data[i5] = z13 + z2;
      data[i3] = z13 - z2;
      data[i1] = z11 + z4;
      data[i7] = z11 - z4;
    }
  }
}
