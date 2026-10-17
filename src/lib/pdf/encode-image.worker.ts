/**
 * 이미지 저장 워커. 화면에서 그린 쪽(ImageBitmap)을 JPG·PNG 바이트로 바꾼다 (render-image.ts가 부른다).
 * 가리기 도구는 저장하기 전에 가린 자리를 검게 칠하게 한다.
 * 큰 쪽을 화면 스레드에서 저장하면 한 쪽마다 0.1~0.2초씩 멈춰서 여기서 한다. 파일은 메모리에서만 다룬다.
 */
import type { EncodeRequest, EncodeResponse } from './render-image';

addEventListener('message', async (event: MessageEvent<EncodeRequest>) => {
  const { id, bitmap, type, quality, fill } = event.data;
  const send = (response: EncodeResponse, transfer: Transferable[] = []) =>
    postMessage(response, { transfer });
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  try {
    const context = canvas.getContext('2d')!;
    context.drawImage(bitmap, 0, 0);
    // 가리기: 화소 경계에서 글자 끝이 비치지 않게 바깥으로 1화소씩 넓혀 칠한다
    context.fillStyle = '#000';
    for (const rect of fill ?? []) {
      const x = Math.floor(rect.x * canvas.width) - 1;
      const y = Math.floor(rect.y * canvas.height) - 1;
      const right = Math.ceil((rect.x + rect.width) * canvas.width) + 1;
      const bottom = Math.ceil((rect.y + rect.height) * canvas.height) + 1;
      context.fillRect(x, y, right - x, bottom - y);
    }
    const blob = await canvas.convertToBlob({ type, quality });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    send({ id, kind: 'done', bytes }, [bytes.buffer]);
  } catch (error) {
    send({ id, kind: 'error', message: error instanceof Error ? error.message : String(error) });
  } finally {
    bitmap.close();
    canvas.width = 0;
    canvas.height = 0;
  }
});
