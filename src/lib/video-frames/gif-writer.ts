/**
 * 움직이는 GIF 쓰기 (워커 안에서 쓴다). 저장은 gifenc(LZW)에 맡기고 이 파일은 장면 사이 줄이기만 한다:
 * 앞 장면과 색 번호가 같은 화소는 투명으로 비워 앞 장면이 그대로 보이게 한다 (손실 없음).
 * 배경이 멈춰 있는 화면 녹화·설명 영상은 이것만으로 크게 줄어든다.
 */
import { GIFEncoder, type Encoder, type Palette } from 'gifenc';

export class GifWriter {
  readonly #encoder: Encoder = GIFEncoder();
  readonly #width: number;
  readonly #height: number;
  /** 색 표 (뒤에 투명 자리 하나를 더한 것) */
  readonly #palette: Palette;
  readonly #transparent: number;
  readonly #loop: boolean;
  /** 지금 화면에 보이는 색 번호 (앞 장면들이 쌓인 모습) */
  #shown: Uint8Array | undefined;
  #frames = 0;

  /** palette: 장면 화소가 쓰는 색들 (255개 이하, 투명 자리는 여기서 더한다) */
  constructor(width: number, height: number, palette: Palette, loop: boolean) {
    this.#width = width;
    this.#height = height;
    this.#transparent = palette.length;
    this.#palette = [...palette, [0, 0, 0]];
    this.#loop = loop;
  }

  get frames(): number {
    return this.#frames;
  }

  /** 지금까지 쓴 바이트 수 (용량 예상에 쓴다) */
  get size(): number {
    return this.#encoder.bytesView().length;
  }

  /** 장면 하나 (색 번호, 길이 ms) */
  add(index: Uint8Array, delay: number) {
    const shown = this.#shown;
    if (!shown) {
      this.#encoder.writeFrame(index, this.#width, this.#height, {
        palette: this.#palette,
        delay,
        // -1: 반복 표시를 쓰지 않는다 (한 번 재생), 0: 계속 반복
        repeat: this.#loop ? 0 : -1,
        dispose: 1,
      });
      this.#shown = index.slice();
    } else {
      const out = new Uint8Array(index.length);
      const transparent = this.#transparent;
      for (let i = 0; i < index.length; i++) {
        const value = index[i]!;
        if (value === shown[i]) out[i] = transparent;
        else {
          out[i] = value;
          shown[i] = value;
        }
      }
      this.#encoder.writeFrame(out, this.#width, this.#height, {
        delay,
        transparent: true,
        transparentIndex: transparent,
        dispose: 1,
      });
    }
    this.#frames++;
  }

  finish(): Uint8Array {
    this.#encoder.finish();
    return this.#encoder.bytes();
  }
}
