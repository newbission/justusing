/**
 * UPNG.js를 워커에서 쓰기 전에 불러 둔다 (process.worker.ts가 upng-js보다 먼저 import한다).
 *
 * UPNG.js는 require가 있으면 require('pako')로, 없으면 window.pako로 zlib을 찾는다.
 * 번들된 워커에는 require도 window도 없어 바로 오류가 난다. 그래서 window를 마련하고,
 * UPNG가 쓰는 두 함수(deflate·inflate)를 이미 쓰고 있는 fflate로 넣어 준다 (같은 zlib 형식).
 */
import { unzlibSync, zlibSync } from 'fflate';

const scope = self as unknown as { window?: unknown; pako?: unknown };
scope.window ??= self;
scope.pako = {
  deflate: (data: Uint8Array) => zlibSync(data),
  inflate: (data: Uint8Array) => unzlibSync(data),
};
