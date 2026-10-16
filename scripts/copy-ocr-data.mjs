/**
 * 글자 인식(OCR) 엔진과 언어 데이터를 public/data/ocr/ 로 복사하고 목록(src/lib/ocr/catalog.json)을 쓴다.
 *
 * - tesseract-core-simd-lstm.wasm  인식 엔진 (tesseract.js-core, Apache-2.0)
 * - <언어>.traineddata.gz           언어 데이터 (tesseract-ocr/tessdata_best의 정수판, Apache-2.0)
 *
 * 설치된 패키지 버전(package.json에 고정)과 같은 파일이어야 해서 커밋하지 않고 dev/build 전에 복사한다.
 * 목록에는 크기·SHA-256을 적어 둔다. 도구 화면은 받은 바이트를 이 값과 맞춰 본 뒤에만 쓴다.
 */
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const modules = new URL('../node_modules/', import.meta.url);
const to = new URL('../public/data/ocr/', import.meta.url);
const catalogPath = new URL('../src/lib/ocr/catalog.json', import.meta.url);

const files = {
  engine: 'tesseract.js-core/tesseract-core-simd-lstm.wasm',
  kor: '@tesseract.js-data/kor/4.0.0_best_int/kor.traineddata.gz',
  eng: '@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz',
};

await rm(to, { recursive: true, force: true });
await mkdir(to, { recursive: true });
const catalog = {};
for (const [id, path] of Object.entries(files)) {
  const name = path.split('/').at(-1);
  const bytes = await readFile(new URL(path, modules));
  await writeFile(new URL(name, to), bytes);
  catalog[id] = {
    path: `/data/ocr/${name}`,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}
await copyFile(new URL('tesseract.js-core/LICENSE', modules), new URL('LICENSE.txt', to));

const json = `${JSON.stringify(catalog, null, 2)}\n`;
const before = await readFile(catalogPath, 'utf8').catch(() => '');
if (json !== before) await writeFile(catalogPath, json);
console.log('OCR 엔진·언어 데이터 복사 완료 → public/data/ocr/');
