/** gifenc (MIT, https://github.com/mattdesl/gifenc). 쓰는 모양만 적는다 (animation.worker.ts) */
declare module 'gifenc' {
  export type Palette = number[][];

  export interface FrameOptions {
    /** 첫 장면에는 반드시 준다 (전체 색 표). 뒤 장면에 주면 그 장면만의 색 표가 된다 */
    palette?: Palette;
    /** ms (GIF는 10ms 단위로 반올림) */
    delay?: number;
    /** -1: 한 번, 0: 계속 반복, n: n번 */
    repeat?: number;
    transparent?: boolean;
    transparentIndex?: number;
    /** 0~7, 1이면 앞 장면을 그대로 두고 위에 그린다 */
    dispose?: number;
  }

  export interface Encoder {
    writeFrame(index: Uint8Array, width: number, height: number, options?: FrameOptions): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
  }

  export function GIFEncoder(options?: { initialCapacity?: number; auto?: boolean }): Encoder;
  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: { format?: 'rgb565' | 'rgb444' | 'rgba4444' },
  ): Palette;
}
