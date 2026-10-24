/**
 * 사이트 화면 글꼴(src/styles/site-font.css)에 사이트 글자가 모두 들어 있는지 확인한다.
 *
 * 화면 글꼴은 사이트에 쓰는 글자만 담았다 (scripts/fonts/build_site_font.py). 바깥 페이지에는 뒤 글꼴이 없어
 * 빠진 글자는 시스템 글꼴로 그려진다. 새 가이드·문구에 없던 글자가 생기면 여기서 실패한다:
 *   npm run build && python3 scripts/fonts/build_site_font.py && npm run build
 * (도구 화면은 파일 이름 같은 사용자 글자 때문에 Pretendard 원래 조각을 뒤 글꼴로 두어 따로 확인하지 않는다)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from './test';

interface SiteFont {
  chunks: Record<string, string>;
  sourceRanges: [number, number][];
}

const font = JSON.parse(readFileSync('src/styles/fonts/site-font.json', 'utf8')) as SiteFont;
const covered = new Set([...Object.values(font.chunks).join('')].map((c) => c.codePointAt(0)!));
const inSource = (code: number) => font.sourceRanges.some(([a, b]) => a <= code && code <= b);

function decode(text: string): string {
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: '\u00a0',
  };
  return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (all, entity: string) => {
    if (entity[0] === '#') {
      const code =
        entity[1] === 'x' || entity[1] === 'X'
          ? parseInt(entity.slice(2), 16)
          : Number(entity.slice(1));
      return String.fromCodePoint(code);
    }
    return named[entity.toLowerCase()] ?? all;
  });
}

/** 화면에 글자로 나오는 것 (태그·스크립트·스타일·주석을 뺀 글, 입력 칸 안내 글) — 글꼴 스크립트와 같은 기준 */
function pageText(html: string): string {
  const body = html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const attrs = [...body.matchAll(/\s(?:placeholder|value)="([^"]*)"/g)].map((m) => m[1]).join(' ');
  return decode(body.replace(/<[^>]+>/g, ' ') + ' ' + attrs);
}

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'frame' ? [] : pages(path);
    return name === 'index.html' ? [path] : [];
  });
}

test('바깥 페이지의 글자가 모두 사이트 글꼴에 있다', () => {
  const missing = new Map<string, string>();
  for (const path of pages('dist')) {
    for (const char of pageText(readFileSync(path, 'utf8'))) {
      const code = char.codePointAt(0)!;
      if (code < 0x20 || covered.has(code) || !inSource(code)) continue;
      if (!missing.has(char)) missing.set(char, path);
    }
  }
  expect(
    [...missing].map(([char, path]) => `${char} (U+${char.codePointAt(0)!.toString(16)}, ${path})`),
    '사이트 글꼴을 다시 만드세요: npm run build && python3 scripts/fonts/build_site_font.py && npm run build',
  ).toEqual([]);
});

test('사이트 글꼴만 받는다 (Pretendard 원래 조각은 받지 않는다)', async ({ page }) => {
  const fonts: string[] = [];
  page.on('response', (response) => {
    if (response.request().resourceType() === 'font') fonts.push(new URL(response.url()).pathname);
  });
  await page.goto('/pdf/merge/');
  const frame = page.frameLocator('iframe[src*="/frame/"]');
  await expect(frame.locator('body')).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(fonts.length).toBeGreaterThan(0);
  expect(fonts.filter((path) => !/\/_astro\/site-[\w-]+\.[\w-]+\.woff2$/.test(path))).toEqual([]);
  // 첫 화면 글자가 사이트 글꼴로 그려진다 (빠진 글자가 있으면 시스템 글꼴로 바뀐다)
  const usedFamilies = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family);
  });
  expect(new Set(usedFamilies)).toEqual(new Set(['JUS Modern Gothic']));
});
