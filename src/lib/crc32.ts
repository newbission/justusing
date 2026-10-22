/** CRC-32 (PNG 조각 끝의 검사 값). 표는 처음 부를 때 한 번 만든다 */
let table: Uint32Array | undefined;

export function crc32(bytes: Uint8Array, crc = 0): number {
  if (!table) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  crc = ~crc;
  for (const byte of bytes) crc = table[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return ~crc >>> 0;
}
