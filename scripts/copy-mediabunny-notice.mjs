/**
 * 동영상 도구가 쓰는 mediabunny(Mozilla Public License 2.0)의 허가서와 안내를 public/vendor/mediabunny/ 로 둔다.
 *
 * - LICENSE.txt  mediabunny 패키지에 든 허가서 전문 (MPL 2.0)
 * - README.txt   무엇을 어디서 쓰는지, 고정한 판과 소스가 어디 있는지 (한·영)
 *
 * MPL 2.0은 실행 파일 형태로 나눠 줄 때 받는 사람에게 소스를 얻는 방법을 알리고 허가서를 함께 두라고 한다.
 * 빌드한 처리 코드(/_astro/engine.*.js)에서는 패키지의 허가서 머리말이 빠지므로 따로 둔다.
 * 설치된 패키지와 같은 판이어야 해서 커밋하지 않고 dev/build 전에 만든다 (.gitignore의 public/vendor/).
 */
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const from = new URL('node_modules/mediabunny/', root);
const to = new URL('public/vendor/mediabunny/', root);

const { version } = JSON.parse(await readFile(new URL('package.json', from), 'utf8'));
// 소스 저장소 주소는 site.config.ts 한 곳에만 둔다
const config = await readFile(new URL('src/site.config.ts', root), 'utf8');
const sourceUrl = /sourceUrl:\s*'([^']+)'/.exec(config)?.[1];
if (!sourceUrl) throw new Error('site.config.ts에서 sourceUrl을 찾지 못했습니다');

const npm = `https://www.npmjs.com/package/mediabunny/v/${version}`;
const github = `https://github.com/Vanilagy/mediabunny/tree/v${version}`;

const notice = `mediabunny ${version} (동영상 읽기·쓰기 / Reading and writing video files)

[한국어]
이 사이트의 동영상 도구(자르기·용량 줄이기·소리 추출)는 동영상 파일(MP4·MOV·WebM·MKV 등)을 읽고 쓰는 데
mediabunny를 브라우저 안에서 씁니다. 동영상은 어디로도 보내지 않습니다.

- mediabunny ${version}  (Mozilla Public License 2.0)
  npm: ${npm}
  소스: ${github}
  npm 패키지의 파일을 고치지 않고 그대로 번들해 씁니다.

허가서 전문: 같은 폴더의 LICENSE.txt (Mozilla Public License 2.0)
이 사이트의 소스(라이브러리를 부르는 코드 포함): ${sourceUrl}
  (src/lib/video/engine.ts)

[English]
The video tools on this site (trim, compress, extract audio) use mediabunny inside your browser to read and
write video files (MP4, MOV, WebM, MKV and more). Your videos are never uploaded.

- mediabunny ${version}  (Mozilla Public License 2.0)
  npm: ${npm}
  Source: ${github}
  The files from the npm package are bundled unmodified.

Full license text: LICENSE.txt in this folder (Mozilla Public License 2.0)
Source of this site (including the code that calls the library): ${sourceUrl}
  (src/lib/video/engine.ts)
`;

await mkdir(to, { recursive: true });
await copyFile(new URL('LICENSE', from), new URL('LICENSE.txt', to));
await writeFile(new URL('README.txt', to), notice);
console.log('mediabunny 허가서·안내 → public/vendor/mediabunny/');
