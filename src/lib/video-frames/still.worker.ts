/**
 * 장면 저장 워커 (장면 캡처). 화면이 원래 크기로 담아 보낸 장면(ImageBitmap)을 JPG·PNG로 저장한다.
 */
import type { StillRequest, StillResponse } from './still';

addEventListener('message', async (event: MessageEvent<StillRequest>) => {
  const { id, bitmap, type, quality } = event.data;
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  let response: StillResponse;
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas');
    ctx.drawImage(bitmap, 0, 0);
    const blob = await canvas.convertToBlob({ type, quality });
    if (blob.type !== type) throw new Error(type);
    response = { id, kind: 'done', bytes: new Uint8Array(await blob.arrayBuffer()) };
  } catch {
    response = { id, kind: 'error' };
  } finally {
    bitmap.close();
    canvas.width = 0;
    canvas.height = 0;
  }
  postMessage(response, {
    transfer: response.kind === 'done' ? [response.bytes.buffer as ArrayBuffer] : [],
  });
});
