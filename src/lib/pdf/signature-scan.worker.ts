/**
 * 서명 바이트 찾기 워커. 큰 PDF 전체를 훑어도 화면이 멈추지 않게 따로 돈다 (pdfjs.ts의 isSigned).
 * 받은 바이트는 이 워커에만 있고 어디로도 보내지 않는다.
 */

/** "/ByteRange" 다음에 (공백 뒤) "[" 가 오는 자리가 있는지 (서명 값 사전) */
function hasByteRange(bytes: Uint8Array): boolean {
  const key = [0x2f, 0x42, 0x79, 0x74, 0x65, 0x52, 0x61, 0x6e, 0x67, 0x65];
  for (let at = bytes.indexOf(key[0]!); at !== -1; at = bytes.indexOf(key[0]!, at + 1)) {
    if (!key.every((byte, i) => bytes[at + i] === byte)) continue;
    let next = at + key.length;
    while (bytes[next] === 0x20 || bytes[next] === 0x0a || bytes[next] === 0x0d) next++;
    if (bytes[next] === 0x5b) return true;
  }
  return false;
}

addEventListener('message', (event: MessageEvent<{ id: number; bytes: Uint8Array }>) => {
  const { id, bytes } = event.data;
  postMessage({ id, found: hasByteRange(bytes) });
});
