/**
 * Pretendard 글꼴의 사용 허가서(SIL OFL 1.1)를 public/vendor/pretendard/ 로 복사한다.
 *
 * 글꼴 파일(사이트 글자만 덜어 낸 고친 판 src/styles/site-font.css, 도구 화면의 원래 조각 FrameLayout)은
 * 빌드할 때 /_astro/로 나간다. OFL은 글꼴을 나눠 줄 때 허가서를 함께 두라고 하는데, 빌드한 CSS에서는
 * 허가서 주석이 빠지므로 따로 둔다.
 * 설치된 패키지와 같은 파일이어야 해서 커밋하지 않고 dev/build 전에 복사한다 (.gitignore).
 */
import { copyFile, mkdir } from 'node:fs/promises';

const from = new URL('../node_modules/pretendard/dist/LICENSE.txt', import.meta.url);
const to = new URL('../public/vendor/pretendard/', import.meta.url);

await mkdir(to, { recursive: true });
await copyFile(from, new URL('LICENSE.txt', to));
console.log('Pretendard 허가서 복사 완료 → public/vendor/pretendard/LICENSE.txt');
