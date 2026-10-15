/**
 * 이미지 준비 워커 (embed.ts가 부른다). 큰 사진을 바로 세우고 다시 저장하는 일이 화면을
 * 멈추지 않도록 여기서 한다. 파일은 메모리에서만 다룬다.
 */
import { toEmbeddable } from './prepare';
import type { EmbedRequest, EmbedResponse } from './embed';

addEventListener('message', async (event: MessageEvent<EmbedRequest>) => {
  const { id, file } = event.data;
  const send = (response: EmbedResponse, transfer: Transferable[] = []) =>
    postMessage(response, { transfer });
  try {
    const embed = await toEmbeddable(file);
    send({ id, kind: 'done', embed }, [embed.bytes.buffer]);
  } catch (error) {
    send({ id, kind: 'error', message: error instanceof Error ? error.message : String(error) });
  }
});
