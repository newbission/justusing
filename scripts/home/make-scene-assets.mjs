/** 실제 견본과 도구 결과를 장면별 sprite로 축소한다. 브라우저는 처리 라이브러리를 받지 않는다. */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const raw = (name) => `${root}.cache/home-showcase/raw/${name}`;
const out = `${root}src/assets/home/scenes`;
const empty = { r: 0, g: 0, b: 0, alpha: 0 };
await mkdir(out, { recursive: true });

async function strip(name, paths, width, height) {
  const parts = await Promise.all(
    paths.map(async (path, index) => ({
      input: await sharp(path)
        .resize(width, height, { fit: 'contain', background: empty })
        .png()
        .toBuffer(),
      left: index * width,
      top: 0,
    })),
  );
  await sharp({ create: { width: width * paths.length, height, channels: 4, background: empty } })
    .composite(parts)
    .webp({ quality: 65, alphaQuality: 85, effort: 6 })
    .toFile(`${out}/${name}.webp`);
}

await strip(
  'album-input',
  ['aloe', 'flowers', 'coast'].map((name) => `${root}scripts/home/${name}.jpg`),
  240,
  300,
);
await strip(
  'album-pages',
  [0, 1, 2].map((i) => raw(`photo-page-${i}.png`)),
  210,
  297,
);
await strip('plant-cutout', [raw('cutout.png')], 260, 390);
for (const lang of ['ko', 'en']) {
  await strip(
    `document-pages-${lang}`,
    ['report', 'appendix'].map((name) => raw(`${name}-${lang}.png`)),
    210,
    297,
  );
  const { width, height } = await sharp(raw(`redact-before-${lang}.png`)).metadata();
  await strip(
    `redaction-${lang}`,
    ['before', 'after'].map((phase) => raw(`redact-${phase}-${lang}.png`)),
    600,
    Math.round((600 * height) / width),
  );
}
console.log('홈 동작 장면용 실제 입력·결과 sprite 생성 완료.');
