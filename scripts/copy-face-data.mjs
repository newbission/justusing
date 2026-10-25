/**
 * MediaPipe 인식 엔진과 모델을 public/data/face/ 로 복사하고 목록(src/lib/face/catalog.json)을 쓴다.
 * 증명사진(얼굴 찾기), 배경 지우기, 모자이크(여러 얼굴 찾기)가 같은 엔진을 쓴다.
 *
 * - vision_wasm_module_internal.wasm  인식 엔진 (@mediapipe/tasks-vision, Apache-2.0)
 * - face_landmarker.task              얼굴 모델 (vendor/mediapipe/, Apache-2.0)
 * - selfie_segmenter.tflite           사람 영역 나누기 모델 (vendor/mediapipe/, Apache-2.0)
 * - magic_touch.tflite                누른 곳의 물체 나누기 모델 (vendor/mediapipe/, Apache-2.0)
 * - blaze_face_full_range.tflite      여러 얼굴 찾기 모델 (vendor/mediapipe/, Apache-2.0)
 *
 * 엔진은 설치된 패키지 버전(package.json에 고정)과 같은 파일이어야 해서 커밋하지 않고 dev/build 전에 복사한다.
 * 목록에는 크기·SHA-256을 적어 둔다. 도구 화면은 받은 바이트를 이 값과 맞춰 본 뒤에만 쓴다.
 */
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const to = new URL('public/data/face/', root);
const catalogPath = new URL('src/lib/face/catalog.json', root);

const files = {
  engine: 'node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_module_internal.wasm',
  model: 'vendor/mediapipe/face_landmarker.task',
  segmenter: 'vendor/mediapipe/selfie_segmenter.tflite',
  objects: 'vendor/mediapipe/magic_touch.tflite',
  detector: 'vendor/mediapipe/blaze_face_full_range.tflite',
};

await rm(to, { recursive: true, force: true });
await mkdir(to, { recursive: true });
const catalog = {};
for (const [id, path] of Object.entries(files)) {
  const name = path.split('/').at(-1);
  const bytes = await readFile(new URL(path, root));
  await writeFile(new URL(name, to), bytes);
  catalog[id] = {
    path: `/data/face/${name}`,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}
// 엔진 패키지에 허가서 파일이 없어 vendor/mediapipe/에 둔 Apache-2.0 전문을 함께 둔다
await copyFile(new URL('vendor/mediapipe/LICENSE', root), new URL('LICENSE.txt', to));

const json = `${JSON.stringify(catalog, null, 2)}\n`;
const before = await readFile(catalogPath, 'utf8').catch(() => '');
if (json !== before) {
  await mkdir(new URL('.', catalogPath), { recursive: true });
  await writeFile(catalogPath, json);
}
console.log('MediaPipe 엔진·모델 복사 완료 → public/data/face/');
