/**
 * 촬영 정보 워커 (metadata.ts가 부른다). 큰 사진을 통째로 읽고 다시 잇는 일이 화면을 멈추지 않게
 * 여기서 한다. 파일은 메모리에서만 다룬다.
 */
import { cleanPhoto, readPhotoInfo } from './photo-metadata';
import type { MetadataRequest, MetadataResponse } from './metadata';

addEventListener('message', async (event: MessageEvent<MetadataRequest>) => {
  const request = event.data;
  const send = (response: MetadataResponse, transfer: Transferable[] = []) =>
    postMessage(response, { transfer });
  try {
    const bytes = new Uint8Array(await request.file.arrayBuffer());
    if (request.kind === 'read') {
      const info = readPhotoInfo(bytes);
      send(info ? { id: request.id, kind: 'read', info } : { id: request.id, kind: 'error' });
      return;
    }
    const cleaned = cleanPhoto(bytes, request.mode);
    const info = cleaned && readPhotoInfo(cleaned);
    if (!cleaned || !info) {
      send({ id: request.id, kind: 'error' });
    } else if (cleaned === bytes) {
      send({ id: request.id, kind: 'clean', info });
    } else {
      send({ id: request.id, kind: 'clean', bytes: cleaned, info }, [cleaned.buffer]);
    }
  } catch {
    send({ id: request.id, kind: 'error' });
  }
});
