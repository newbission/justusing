/** 이 도구가 만든 ZIP에서 쪽 이미지를 꺼낸다. 원본 ZIP은 재시도와 다운로드에 쓸 수 있다. */
import { unzipSync } from 'fflate';

export interface UnpackRequest {
  id: number;
  archive: Blob;
  imageType: string;
}

export type UnpackResponse =
  { id: number; kind: 'done'; files: File[] } | { id: number; kind: 'error'; message: string };

addEventListener('message', async ({ data }: MessageEvent<UnpackRequest>) => {
  const { id, archive, imageType } = data;
  try {
    const entries = unzipSync(new Uint8Array(await archive.arrayBuffer()));
    const files = Object.entries(entries).map(
      ([name, bytes]) => new File([bytes as Uint8Array<ArrayBuffer>], name, { type: imageType }),
    );
    postMessage({ id, kind: 'done', files } satisfies UnpackResponse);
  } catch (error) {
    postMessage({ id, kind: 'error', message: String(error) } satisfies UnpackResponse);
  }
});
