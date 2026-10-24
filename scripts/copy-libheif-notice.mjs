/**
 * HEIC 읽기에 쓰는 libheif·libde265(GNU LGPL 3.0)의 허가서와 안내를 public/vendor/libheif/ 로 둔다.
 *
 * - LICENSE.txt  libheif-js 패키지에 든 허가서 전문 (GNU LGPL 3.0과 그 바탕인 GNU GPL 3.0)
 * - README.txt   무엇을 어디서 쓰는지, 소스가 어디 있는지, 고친 판으로 바꿔 쓰는 법 (한·영)
 *
 * LGPL은 라이브러리를 나눠 줄 때 이 고지와 허가서를 함께 두고, 쓰는 사람이 고친 라이브러리로 바꿔 쓸 수
 * 있게 하라고 한다. 엔진(libheif.wasm)은 빌드 때 /_astro/에 따로 나가므로 여기에는 고지만 둔다.
 * 설치된 패키지와 같은 판이어야 해서 커밋하지 않고 dev/build 전에 만든다 (.gitignore의 public/vendor/).
 */
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const from = new URL('node_modules/libheif-js/', root);
const to = new URL('public/vendor/libheif/', root);

const { version } = JSON.parse(await readFile(new URL('package.json', from), 'utf8'));
// 소스 저장소 주소는 site.config.ts 한 곳에만 둔다
const config = await readFile(new URL('src/site.config.ts', root), 'utf8');
const sourceUrl = /sourceUrl:\s*'([^']+)'/.exec(config)?.[1];
if (!sourceUrl) throw new Error('site.config.ts에서 sourceUrl을 찾지 못했습니다');
// libheif-js는 libheif의 주·부 판을 따른다 (끝자리는 패키지 자신의 판)
const libheif = version.split('.').slice(0, 2).join('.');

const notice = `libheif · libde265 (HEIC 사진 읽기 / Reading HEIC photos)

[한국어]
이 사이트의 이미지 도구는 브라우저가 HEIC·HEIF 사진(아이폰 사진)을 스스로 읽지 못할 때
다음 라이브러리를 WebAssembly로 빌드한 것을 브라우저 안에서 씁니다. 사진은 어디로도 보내지 않습니다.

- libheif ${libheif}  https://github.com/strukturag/libheif  (GNU LGPL 3.0)
- libde265 1.0  https://github.com/strukturag/libde265  (GNU LGPL 3.0)
- 빌드: libheif-js ${version}  https://github.com/catdad-experiments/libheif-js
  npm 패키지의 파일을 고치지 않고 그대로 씁니다.

허가서 전문: 같은 폴더의 LICENSE.txt (GNU LGPL 3.0과 그 바탕인 GNU GPL 3.0)
라이브러리 소스: 위 저장소들
이 사이트의 소스(라이브러리를 부르는 코드 포함): ${sourceUrl}
  (src/lib/image/heif.ts, src/lib/image/heif.worker.ts)
바꿔 쓰기: 엔진(libheif.wasm)은 사이트 코드와 따로 된 파일로 받아 씁니다. 고친 libheif로 만든
libheif-js를 넣고 이 사이트를 다시 빌드하면 고친 판으로 돌릴 수 있습니다.

[English]
When your browser cannot read HEIC/HEIF photos (iPhone photos) by itself, the image tools on this site
run the following libraries, built for WebAssembly, inside your browser. Your photos are never uploaded.

- libheif ${libheif}  https://github.com/strukturag/libheif  (GNU LGPL 3.0)
- libde265 1.0  https://github.com/strukturag/libde265  (GNU LGPL 3.0)
- Build: libheif-js ${version}  https://github.com/catdad-experiments/libheif-js
  The files from the npm package are used unmodified.

Full license text: LICENSE.txt in this folder (GNU LGPL 3.0 and the GNU GPL 3.0 it builds on)
Library source: the repositories above
Source of this site (including the code that calls the library): ${sourceUrl}
  (src/lib/image/heif.ts, src/lib/image/heif.worker.ts)
Replacing the library: the engine (libheif.wasm) is loaded as a file separate from the site code.
Build libheif-js with a modified libheif, put it in this site and rebuild to run the modified version.
`;

await mkdir(to, { recursive: true });
await copyFile(new URL('libheif-wasm/LICENSE', from), new URL('LICENSE.txt', to));
await writeFile(new URL('README.txt', to), notice);
console.log('libheif 허가서·안내 → public/vendor/libheif/');
