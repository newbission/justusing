/** 실제 도구 결과를 축소·배치한다. 새로운 처리 결과를 그림으로 만들어 내지 않는다. */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const raw = (name) => `${root}.cache/home-showcase/raw/${name}`;
const photo = (name) => `${root}scripts/home/${name}.jpg`;
const out = `${root}src/assets/home/showcase`;
await mkdir(out, { recursive: true });
const W = 720,
  H = 440;
const empty = { r: 0, g: 0, b: 0, alpha: 0 };
const svg = (body, w, h) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`);
const check = (w, h) =>
  svg(
    '<defs><pattern id="check" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="#fafaf7"/><path d="M0 0h12v12H0zm12 12h12v12H12z" fill="#e5e7e1"/></pattern></defs><rect width="100%" height="100%" fill="url(#check)"/>',
    w,
    h,
  );
async function framed(path, width, height, angle = 0, checker = false) {
  const image = await sharp(path)
    .resize(width, height, { fit: 'contain', background: empty })
    .png()
    .toBuffer();
  const backing = checker
    ? check(width, height)
    : svg('<rect width="100%" height="100%" fill="white"/>', width, height);
  const mounted = await sharp(backing)
    .composite([{ input: image }])
    .extend({ top: 8, right: 8, bottom: 14, left: 8, background: 'white' })
    .png()
    .toBuffer();
  return sharp(mounted).rotate(angle, { background: empty }).png().toBuffer();
}
async function frame(path, width, height, left, top, angle = 0, checker = false) {
  return { input: await framed(path, width, height, angle, checker), left, top };
}
// 도형의 색·선은 실제 사진과 별개인 화살표/종이 테두리다. CSS에는 디자인 토큰만 쓴다.
function arrowSvg(down = false) {
  return svg(
    `<g fill="none" stroke="#6f9e87" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${down ? '<path d="M28 4v40m-13-13 13 13 13-13"/>' : '<path d="M4 28h44m-14-13 14 13-14 13"/>'}</g>`,
    56,
    56,
  );
}
async function compose(name, parts) {
  await sharp({ create: { width: W, height: H, channels: 4, background: empty } })
    .composite(parts)
    .webp({ quality: 64, alphaQuality: 85, effort: 6 })
    .toFile(`${out}/${name}.webp`);
  console.log(`홈 예시: ${name}`);
}
await compose('cutout', [
  await frame(photo('aloe'), 225, 338, 48, 23, -6),
  { input: arrowSvg(), left: 330, top: 180 },
  await frame(raw('cutout.png'), 222, 333, 416, 45, 5, true),
]);
await compose('crop', [
  await frame(photo('coast'), 300, 214, 12, 58, -6),
  { input: arrowSvg(), left: 340, top: 170 },
  await frame(raw('crop.jpg'), 244, 244, 434, 108, 6),
]);
await compose('stitch', [
  await frame(raw('part-0.jpg'), 86, 184, 20, 50, -6),
  await frame(raw('part-1.jpg'), 86, 184, 112, 110, 4),
  await frame(raw('part-2.jpg'), 86, 184, 205, 54, -3),
  { input: arrowSvg(), left: 303, top: 228 },
  await frame(raw('stitch.jpg'), 326, 233, 373, 110, 3),
]);
await compose('album', [
  await frame(photo('aloe'), 108, 162, 18, 78, -7),
  await frame(photo('flowers'), 108, 162, 138, 28, 5),
  await frame(photo('coast'), 168, 120, 94, 246, -4),
  { input: arrowSvg(), left: 310, top: 194 },
  await frame(raw('photo-page-0.png'), 179, 253, 387, 67, -7),
  await frame(raw('photo-page-1.png'), 179, 253, 486, 115, 6),
]);
for (const lang of ['ko', 'en']) {
  await compose(`merge-${lang}`, [
    await frame(raw(`report-${lang}.png`), 160, 226, 23, 53, -7),
    await frame(raw(`appendix-${lang}.png`), 160, 226, 171, 122, 6),
    { input: arrowSvg(), left: 347, top: 202 },
    await frame(raw(`merged-${lang}.png`), 190, 269, 437, 78, 4),
  ]);
  const before = await sharp(raw(`redact-before-${lang}.png`)).metadata();
  const ratio = before.height / before.width;
  await compose(`redact-${lang}`, [
    await frame(raw(`redact-before-${lang}.png`), 554, Math.round(554 * ratio), 40, 25, -2),
    { input: arrowSvg(true), left: 343, top: 177 },
    await frame(raw(`redact-after-${lang}.png`), 554, Math.round(554 * ratio), 100, 253, 2),
  ]);
}
