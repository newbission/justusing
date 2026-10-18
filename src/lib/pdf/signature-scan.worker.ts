/**
 * 서명 바이트 찾기 워커. 큰 PDF 전체를 훑어도 화면이 멈추지 않게 따로 돈다 (pdfjs.ts의 isSigned).
 * 받은 파일은 이 워커에서 읽기만 하고 어디로도 보내지 않는다.
 */

/** PDF의 공백 바이트: NUL, 탭, LF, 폼 피드, CR, 스페이스 */
const WHITESPACE = new Set([0x00, 0x09, 0x0a, 0x0c, 0x0d, 0x20]);

/** "/ByteRange" 다음에 (공백 뒤) "[" 가 오는 자리가 있는지 (서명 값 사전) */
function hasByteRange(bytes: Uint8Array): boolean {
  const key = [0x2f, 0x42, 0x79, 0x74, 0x65, 0x52, 0x61, 0x6e, 0x67, 0x65];
  for (let at = bytes.indexOf(key[0]!); at !== -1; at = bytes.indexOf(key[0]!, at + 1)) {
    if (!key.every((byte, i) => bytes[at + i] === byte)) continue;
    let next = at + key.length;
    while (WHITESPACE.has(bytes[next]!)) next++;
    if (bytes[next] === 0x5b) return true;
  }
  return false;
}

addEventListener('message', async (event: MessageEvent<{ id: number; file: Blob }>) => {
  const { id, file } = event.data;
  try {
    postMessage({ id, found: hasByteRange(new Uint8Array(await file.arrayBuffer())) });
  } catch {
    postMessage({ id, found: false });
  }
});
