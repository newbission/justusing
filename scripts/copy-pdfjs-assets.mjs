/**
 * pdf.js가 실행 중에 읽는 보조 파일을 public/vendor/pdfjs/ 로 복사한다.
 *
 * - cmaps/          한글·중국어·일본어 PDF의 글자 매핑 (없으면 한글이 깨진다)
 * - standard_fonts/ PDF에 폰트가 안 들어 있을 때 쓰는 기본 폰트
 * - wasm/           JPEG2000 등 이미지 디코더
 * - iccs/           색 프로필
 *
 * CDN 대신 우리 사이트에서 직접 내려준다 (로컬 처리 원칙). 설치된 pdfjs-dist 버전과
 * 항상 같은 파일이어야 해서 커밋하지 않고 dev/build 전에 매번 복사한다 (.gitignore).
 */
import { cp, rm } from 'node:fs/promises';

const from = new URL('../node_modules/pdfjs-dist/', import.meta.url);
const to = new URL('../public/vendor/pdfjs/', import.meta.url);

await rm(to, { recursive: true, force: true });
for (const dir of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  await cp(new URL(`${dir}/`, from), new URL(`${dir}/`, to), { recursive: true });
}
console.log('pdf.js 보조 파일 복사 완료 → public/vendor/pdfjs/');
