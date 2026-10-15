/**
 * ZIP 워커. 받은 파일들을 ZIP 하나로 묶는다 (zip.ts가 부른다).
 * 파일이 크면 묶는 동안 화면이 멈추지 않도록 워커에서 한다. 파일은 메모리에서만 다룬다.
 */
import { zipSync } from 'fflate';
import type { ZipRequest, ZipResponse } from './zip';

addEventListener('message', (event: MessageEvent<ZipRequest>) => {
  const { id, entries } = event.data;
  const send = (response: ZipResponse, transfer: Transferable[] = []) =>
    postMessage(response, { transfer });
  try {
    // PDF·JPG·PNG는 이미 압축된 형식이라 다시 압축해도 거의 줄지 않는다. 담기만 한다(level 0)
    const bytes = zipSync(entries, { level: 0 });
    send({ id, kind: 'done', bytes }, [bytes.buffer]);
  } catch (error) {
    send({ id, kind: 'error', message: error instanceof Error ? error.message : String(error) });
  }
});
