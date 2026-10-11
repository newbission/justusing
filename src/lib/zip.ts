/**
 * 여러 파일을 ZIP 하나로 묶는다 (나누기 결과 받기 등). 메모리 안에서만 만든다.
 *
 * PDF는 이미 압축된 형식이라 다시 압축해도 거의 줄지 않는다. 압축 없이 담기만 해서(level 0)
 * 빠르고 화면이 멈추지 않는다.
 */
import { zipSync } from 'fflate';

export function makeZip(files: { name: string; bytes: Uint8Array }[]): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const { name, bytes } of files) {
    // 같은 이름이 있으면 뒤에 번호를 붙인다 (ZIP 안에서 덮어써지지 않게)
    let unique = name;
    for (let n = 2; unique in entries; n++) unique = name.replace(/(\.[^.]+)?$/, ` (${n})$1`);
    entries[unique] = bytes;
  }
  return zipSync(entries, { level: 0 });
}
