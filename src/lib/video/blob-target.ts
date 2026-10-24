/**
 * mediabunny가 쓰는 결과를 Blob 조각으로 모은다 (StreamTarget에 넘기는 WritableStream).
 *
 * 결과를 ArrayBuffer 하나에 모으면(BufferTarget) 커질 때마다 두 배로 다시 잡아 큰 동영상에서 메모리가 모자란다.
 * Blob 조각은 브라우저가 따로 보관하므로(크롬은 크면 디스크로 옮긴다) 워커 메모리에 결과 전체를 들고 있지 않는다.
 * MP4는 끝에 앞쪽 상자 크기를 고쳐 쓴다. 이미 모은 자리에 다시 쓰면 그 조각을 잘라(slice, 복사 없음) 바꿔 끼운다.
 */
import type { StreamTargetChunk } from 'mediabunny';

interface Part {
  position: number;
  blob: Blob;
}

export class BlobCollector {
  /** 자리 순서대로, 서로 겹치지 않는 조각 */
  private parts: Part[] = [];
  private end = 0;

  readonly writable = new WritableStream<StreamTargetChunk>({
    write: (chunk) => this.write(chunk.position, chunk.data),
  });

  private write(position: number, data: Uint8Array<ArrayBuffer>) {
    const blob = new Blob([data]);
    if (position === this.end) {
      this.parts.push({ position, blob });
      this.end += blob.size;
      return;
    }
    if (position > this.end) {
      // 건너뛴 자리는 0으로 채운다 (실제로는 일어나지 않지만 자리가 어긋나지 않게)
      this.parts.push({
        position: this.end,
        blob: new Blob([new Uint8Array(position - this.end)]),
      });
      this.parts.push({ position, blob });
      this.end = position + blob.size;
      return;
    }
    const writeEnd = position + blob.size;
    const next: Part[] = [];
    for (const part of this.parts) {
      const partEnd = part.position + part.blob.size;
      if (partEnd <= position || part.position >= writeEnd) {
        next.push(part);
        continue;
      }
      if (part.position < position) {
        next.push({ position: part.position, blob: part.blob.slice(0, position - part.position) });
      }
      if (partEnd > writeEnd) {
        next.push({ position: writeEnd, blob: part.blob.slice(writeEnd - part.position) });
      }
    }
    next.push({ position, blob });
    next.sort((a, b) => a.position - b.position);
    this.parts = next;
    this.end = Math.max(this.end, writeEnd);
  }

  toBlob(type: string): Blob {
    return new Blob(
      this.parts.map((part) => part.blob),
      { type },
    );
  }
}
