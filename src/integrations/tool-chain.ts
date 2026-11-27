/**
 * 결과를 다음 도구로 넘기기 (docs/foundations/tool-chaining)의 빌드 쪽.
 *
 * 1. `virtual:tool-chain` 모듈: 도구마다 넘길 수 있는 도구(ID·이름·여러 장을 받는지). meta.ts의 sendTo·receives에서 만든다.
 *    '다음 도구로' 메뉴(src/frame/SendMenu.svelte)만 쓰고, 그 메뉴는 결과가 생길 때 받는다 (첫 화면 무게에 들지 않는다)
 *
 * 2. 빌드 뒤 받는 도구마다 `/_chain/<id>.json`: 그 도구의 frame 페이지가 부르는 스크립트·CSS 주소와 frame 제목.
 *    넘길 때 frame이 이 목록으로 같은 문서 안에 다음 도구를 불러온다 (src/frame/chain.ts).
 *    다음 도구 코드를 앞 도구에서 import하지 않는 까닭: Astro는 동적 import로 닿는 모듈의 CSS도 그 페이지에 넣어
 *    넘길 도구들의 CSS가 앞 도구 첫 화면에 실린다. frame 페이지의 인라인 <style>은 이 문서 CSP 해시에 없어
 *    `/_chain/<id>.<해시>.css` 파일로 뺀다 (실행 중에 <style>을 만들지 않는다)
 *
 * 3. 빌드 뒤 확인 (어기면 멈춘다): 넘긴 도구는 처음 연 frame 문서의 CSP로 돈다. 넘길 수 있는 모든 경로(여러 번 넘기기 포함)에서
 *    받는 도구 frame의 CSP 값(해시 말고)이 처음 frame CSP 안에 들어야 하고, 받는 도구 frame의 인라인 스크립트(테마)가 처음 frame에도 있어야 한다.
 *    예: 동영상 frame에만 있는 media-src blob:가 필요한 도구로는 이미지 도구에서 넘길 수 없다
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { LOCALES, localizePath, type Locale } from '../i18n/locales';
import { liveTools, type Tool } from '../tools/registry';

const VIRTUAL_ID = 'virtual:tool-chain';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

/** 넘길 수 있는 도구 하나 (virtual:tool-chain) */
export interface ChainTarget {
  id: string;
  name: Record<Locale, string>;
  multiple: boolean;
}

/** 도구 ID → 넘길 수 있는 도구 (sendTo 순서) */
export function chainTable(tools: Tool[]): Record<string, ChainTarget[]> {
  const table: Record<string, ChainTarget[]> = {};
  for (const tool of tools) {
    if (!tool.sendTo?.length) continue;
    table[tool.id] = tool.sendTo.map((id) => {
      const target = tools.find((other) => other.id === id)!;
      return {
        id,
        name: Object.fromEntries(LOCALES.map((l) => [l, target.text[l].name])) as Record<
          Locale,
          string
        >,
        multiple: target.receives!.multiple,
      };
    });
  }
  return table;
}

/** frame 페이지가 부르는 것 */
interface FrameAssets {
  scripts: string[];
  styles: string[];
  inlineStyles: string[];
  inlineScripts: string[];
  title: string;
  /** CSP 지시어 → 해시가 아닌 값들 */
  policy: Map<string, Set<string>>;
}

const HASH = /^'(sha256|sha384|sha512)-[A-Za-z0-9+/=]+'$/;

function readFrame(root: string, id: string, locale: Locale): FrameAssets {
  const path = join(root, localizePath(`/${id}/frame/`, locale), 'index.html');
  if (!existsSync(path)) throw new Error(`넘길 도구의 frame 페이지가 없습니다: ${path}`);
  const html = readFileSync(path, 'utf8');
  const scripts: string[] = [];
  const inlineScripts: string[] = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    const attrs = m[1]!;
    const src = attrs.match(/\ssrc="([^"]+)"/)?.[1];
    if (src) {
      if (!/\stype="module"/.test(attrs)) throw new Error(`${path}: 모듈이 아닌 스크립트 ${src}`);
      scripts.push(src);
    } else inlineScripts.push(m[2]!);
  }
  const styles = [...html.matchAll(/<link\b[^>]*\srel="stylesheet"[^>]*>/g)].map(
    (m) => m[0].match(/\shref="([^"]+)"/)![1]!,
  );
  const inlineStyles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]!);
  // 제목은 document.title에 그대로 넣으므로 HTML 글자 표현을 푼다 (예: Crop &amp; Rotate)
  const title = (html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '').replace(
    /&(amp|lt|gt|quot|#39);/g,
    (_, name: string) =>
      ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[name as 'amp'] ?? '',
  );
  const content = html.match(/<meta http-equiv="content-security-policy" content="([^"]*)">/)?.[1];
  if (!content) throw new Error(`${path}: CSP가 없습니다`);
  const policy = new Map<string, Set<string>>();
  for (const part of content.split(';')) {
    const [name, ...values] = part.trim().split(/\s+/);
    if (!name) continue;
    policy.set(name, new Set(values.filter((value) => !HASH.test(value))));
  }
  for (const href of [...scripts, ...styles]) {
    if (!href.startsWith('/') || href.startsWith('//')) {
      throw new Error(`${path}: 우리 사이트 밖 파일 ${href}`);
    }
  }
  return { scripts, styles, inlineStyles, inlineScripts, title, policy };
}

/** source frame에서 target 도구를 돌려도 되는지. 안 되면 그 까닭 */
function incompatibility(source: FrameAssets, target: FrameAssets): string | undefined {
  for (const [name, values] of target.policy) {
    const allowed = source.policy.get(name);
    if (!allowed) return `CSP ${name}가 없습니다`;
    for (const value of values) if (!allowed.has(value)) return `CSP ${name}에 ${value}가 없습니다`;
  }
  for (const script of target.inlineScripts) {
    if (!source.inlineScripts.includes(script))
      return '받는 도구 frame에 다른 인라인 스크립트가 있습니다';
  }
  return undefined;
}

/** 처음 연 도구에서 넘겨 갈 수 있는 모든 도구 (여러 번 넘기기 포함) */
function reachable(tools: Tool[], from: Tool): string[] {
  const seen = new Set<string>();
  const queue = [...(from.sendTo ?? [])];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id) || id === from.id) continue;
    seen.add(id);
    queue.push(...(tools.find((tool) => tool.id === id)?.sendTo ?? []));
  }
  return [...seen];
}

function writeManifests(root: string, tools: Tool[]): number {
  const frames = new Map<string, Record<Locale, FrameAssets>>();
  const frame = (id: string) => {
    let entry = frames.get(id);
    if (!entry) {
      entry = Object.fromEntries(LOCALES.map((l) => [l, readFrame(root, id, l)])) as Record<
        Locale,
        FrameAssets
      >;
      frames.set(id, entry);
    }
    return entry;
  };

  // 경로마다 CSP·인라인 스크립트 확인 (언어마다)
  for (const source of tools.filter((tool) => tool.sendTo?.length)) {
    for (const id of reachable(tools, source)) {
      for (const locale of LOCALES) {
        const reason = incompatibility(frame(source.id)[locale], frame(id)[locale]);
        if (reason) throw new Error(`${source.id}에서 ${id}로 넘길 수 없습니다: ${reason}`);
      }
    }
  }

  const targets = new Set(tools.flatMap((tool) => tool.sendTo ?? []));
  for (const id of targets) {
    const pages = frame(id);
    const base = pages[LOCALES[0]];
    // 언어판은 문구만 다르고 부르는 파일은 같아야 한다 (목록 하나를 같이 쓴다)
    for (const locale of LOCALES) {
      const page = pages[locale];
      const same = (a: string[], b: string[]) => JSON.stringify(a) === JSON.stringify(b);
      if (
        !same(page.scripts, base.scripts) ||
        !same(page.styles, base.styles) ||
        !same(page.inlineStyles, base.inlineStyles)
      ) {
        throw new Error(`${id} frame 페이지의 언어판이 다른 파일을 부릅니다 (${locale})`);
      }
    }
    const styles = [...base.styles];
    const inline = base.inlineStyles.join('\n');
    if (inline.trim()) {
      const hash = createHash('sha256').update(inline).digest('hex').slice(0, 10);
      const href = `/_chain/${id}.${hash}.css`;
      const file = join(root, href);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, inline);
      styles.push(href);
    }
    const manifest = {
      scripts: base.scripts,
      styles,
      title: Object.fromEntries(LOCALES.map((l) => [l, pages[l].title])),
    };
    const file = join(root, `/_chain/${id}.json`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(manifest));
  }
  return targets.size;
}

export function toolChain(): AstroIntegration {
  return {
    name: 'tool-chain',
    hooks: {
      'astro:config:setup': ({ updateConfig }) => {
        updateConfig({
          vite: {
            plugins: [
              {
                name: 'tool-chain',
                resolveId: (id) => (id === VIRTUAL_ID ? RESOLVED_ID : undefined),
                load: (id) =>
                  id === RESOLVED_ID
                    ? `export default ${JSON.stringify(chainTable(liveTools))};`
                    : undefined,
              },
            ],
          },
        });
      },
      'astro:build:done': ({ dir, logger }) => {
        const count = writeManifests(fileURLToPath(dir), liveTools);
        logger.info(`받는 도구 ${count}개의 넘기기 목록을 만들었습니다 (/_chain/)`);
      },
    },
  };
}
