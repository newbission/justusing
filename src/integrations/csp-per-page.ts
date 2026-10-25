/**
 * 빌드 뒤 페이지마다 CSP `<meta>`의 해시를 그 페이지에 실제로 있는 것만 남긴다.
 *
 * Astro(`security.csp`)는 사이트 전체의 인라인 스타일·CSS 파일·스크립트 해시(100개 남짓)를 모든 페이지의
 * `script-src`·`style-src`에 넣는다. 페이지마다 gzip 약 5KB로, 도구 화면(frame) HTML의 대부분이었다.
 *
 * 하는 일 (허용 범위를 줄이기만 한다. 넓히지 않는다):
 * - `script-src`·`style-src`의 해시 중 그 페이지의 인라인 `<script>`·`<style>` 내용, 그 페이지가 부르는
 *   스크립트·CSS 파일 내용의 해시와 같은 것만 남긴다. 새 해시는 더하지 않는다
 * - 해시가 아닌 값('self', 사이트 주소, 광고·통계 주소, 'wasm-unsafe-eval' 등)과 다른 지시어
 *   (default-src, connect-src, style-src-attr …)는 글자 하나 바꾸지 않는다
 * - CSP `<meta>` 뒤에 있는 실행되는 인라인 스크립트·스타일의 해시가 원래 목록에 없으면 빌드를 멈춘다.
 *   해시 계산이 Astro와 어긋났다는 뜻이고, 그대로 두면 그 스크립트·스타일이 막힌다
 *   (`<meta>` 앞의 DropGuard·LocaleRedirect·ThemeInit는 CSP가 걸리기 전에 돌아 해시가 없다)
 *
 * 실행 중에 페이지가 새로 넣는 인라인 스타일·스크립트는 이 목록으로 허용되지 않는다. 그런 코드를 쓰지 않는다
 * (가이드 창은 가이드 페이지의 `<style>`을 빼고 읽는다). E2E(csp.spec.ts, test.ts)가 위반을 찾는다.
 * 개발 서버에는 CSP가 없어 빌드에서만 돈다.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';

const META = /<meta http-equiv="content-security-policy" content="([^"]*)">/g;
const HASH = /^'(sha256|sha384|sha512)-[A-Za-z0-9+/=]+'$/;
/** 해시를 줄이는 지시어 */
const TRIMMED = new Set(['script-src', 'style-src']);
/** 실행되는 스크립트 종류 (type이 없거나 이것들). JSON-LD 같은 데이터 블록은 CSP와 상관없다 */
const RUNNABLE = /^(|module|text\/javascript|application\/javascript)$/;

function htmlFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return htmlFiles(path);
    return name.endsWith('.html') ? [path] : [];
  });
}

function digest(algorithm: string, content: string): string {
  return `'${algorithm}-${createHash(algorithm).update(content).digest('base64')}'`;
}

interface Inline {
  kind: 'script' | 'style';
  content: string;
  /** 문서 안 위치 (CSP <meta>보다 뒤인지 보려고) */
  at: number;
  runnable: boolean;
}

function inlineBlocks(html: string): Inline[] {
  const blocks: Inline[] = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    const attrs = m[1]!;
    if (/\ssrc=/.test(attrs)) continue;
    const type = attrs.match(/\stype="([^"]*)"/)?.[1] ?? '';
    blocks.push({ kind: 'script', content: m[2]!, at: m.index!, runnable: RUNNABLE.test(type) });
  }
  for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)) {
    blocks.push({ kind: 'style', content: m[1]!, at: m.index!, runnable: true });
  }
  return blocks;
}

/** 페이지가 부르는 우리 사이트 파일 (스크립트·CSS) */
function linkedFiles(html: string, root: string): string[] {
  const urls = [
    ...[...html.matchAll(/<script\b[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]!),
    ...[
      ...html.matchAll(/<link\b[^>]*\srel="(?:stylesheet|modulepreload)"[^>]*\shref="([^"]+)"/g),
    ].map((m) => m[1]!),
  ];
  return urls
    .filter((url) => url.startsWith('/') && !url.startsWith('//'))
    .map((url) => join(root, decodeURI(url.split(/[?#]/)[0]!)))
    .filter((path) => existsSync(path))
    .map((path) => readFileSync(path, 'utf8'));
}

/** CSP 문자열 하나를 줄인다. 남길 해시는 `used`에 있는 것만 */
export function trimPolicy(policy: string, used: (algorithm: string) => Set<string>): string {
  return policy
    .split(';')
    .map((part) => {
      const tokens = part.trim().split(/\s+/);
      if (!TRIMMED.has(tokens[0]!)) return part;
      const kept = tokens.filter((token, i) => {
        if (i === 0 || !HASH.test(token)) return true;
        return used(token.slice(1, token.indexOf('-'))).has(token);
      });
      const lead = part.match(/^\s*/)![0];
      return lead + kept.join(' ');
    })
    .join(';');
}

function processPage(path: string, root: string): { before: number; after: number } {
  const html = readFileSync(path, 'utf8');
  const metas = [...html.matchAll(META)];
  if (metas.length === 0) return { before: 0, after: 0 };
  if (metas.length > 1) throw new Error(`CSP <meta>가 둘 이상입니다: ${path}`);
  const meta = metas[0]!;
  const policy = meta[1]!;
  if (policy.includes('&')) throw new Error(`CSP에 예상하지 못한 글자(&)가 있습니다: ${path}`);

  const blocks = inlineBlocks(html);
  const files = linkedFiles(html, root);
  const cache = new Map<string, Set<string>>();
  const used = (algorithm: string) => {
    let set = cache.get(algorithm);
    if (!set) {
      set = new Set([...blocks.map((b) => b.content), ...files].map((c) => digest(algorithm, c)));
      cache.set(algorithm, set);
    }
    return set;
  };

  // CSP 뒤의 인라인 스크립트·스타일은 원래 목록에 해시가 있어야 한다 (없으면 계산이 Astro와 어긋난 것)
  const sources = (name: string) =>
    policy
      .split(';')
      .map((part) => part.trim().split(/\s+/))
      .find((tokens) => tokens[0] === name)
      ?.slice(1) ?? [];
  for (const block of blocks) {
    if (!block.runnable || block.at < meta.index!) continue;
    const allowed = sources(`${block.kind}-src`);
    if (!allowed.some((token) => HASH.test(token))) continue; // 해시로 허용하지 않는 지시어 (예: 'unsafe-inline')
    const algorithms = new Set(
      allowed.filter((t) => HASH.test(t)).map((t) => t.slice(1, t.indexOf('-'))),
    );
    const ok = [...algorithms].some((a) => allowed.includes(digest(a, block.content)));
    if (!ok) {
      throw new Error(
        `${path}: CSP 뒤의 인라인 ${block.kind} 해시가 원래 CSP에 없습니다. 해시를 줄이면 막힐 수 있어 멈춥니다`,
      );
    }
  }

  const trimmed = trimPolicy(policy, used);
  const before = policy.split(/\s+/).filter((t) => HASH.test(t)).length;
  const after = trimmed.split(/\s+/).filter((t) => HASH.test(t)).length;
  const out =
    html.slice(0, meta.index!) +
    `<meta http-equiv="content-security-policy" content="${trimmed}">` +
    html.slice(meta.index! + meta[0].length);
  writeFileSync(path, out);
  return { before, after };
}

export function cspPerPage(): AstroIntegration {
  return {
    name: 'csp-per-page',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        let pages = 0;
        let before = 0;
        let after = 0;
        for (const path of htmlFiles(root)) {
          const result = processPage(path, root);
          if (result.before === 0 && result.after === 0) continue;
          pages++;
          before += result.before;
          after += result.after;
        }
        if (pages === 0)
          throw new Error(
            'CSP <meta>가 있는 페이지가 없습니다. astro.config의 security.csp를 확인하세요',
          );
        logger.info(`페이지 ${pages}개의 CSP 해시 ${before}개 → ${after}개`);
      },
    },
  };
}
