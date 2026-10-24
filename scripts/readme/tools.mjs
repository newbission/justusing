/**
 * README의 도구 목록을 도구 레지스트리에서 만든다. 손으로 쓰면 도구를 더할 때 빠뜨리기 쉬워서다.
 *
 *   node scripts/readme/tools.mjs           README.md(한국어)·README.en.md(영어)의 목록을 고쳐 쓴다
 *   node scripts/readme/tools.mjs --check   목록이 레지스트리와 다르면 실패한다 (CI)
 *
 * <!-- tools:start --> 와 <!-- tools:end --> 사이만 바꾼다. 순서·이름·주소는 사이트와 같다:
 * 카테고리(categories.ts) → 묶음(sections) → 레지스트리(registry.ts TOOL_IDS) 순서, live 도구만.
 * registry.ts는 Vite의 import.meta.glob을 써서 Node로 바로 읽을 수 없어 TOOL_IDS만 글자로 읽고,
 * meta.ts·categories.ts·site.config.ts는 Node의 타입 지우기로 그대로 불러온다.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as prettier from 'prettier';

// 확장자 없이 부르는 상대 경로('../../types')를 .ts 파일로 찾게 한다 (Vite처럼)
register(
  'data:text/javascript,' +
    encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (/^\\.\\.?\\//.test(specifier) && !/\\.[cm]?[jt]s$/.test(specifier)) {
    try { return await next(specifier + '.ts', context); } catch {}
  }
  return next(specifier, context);
}`),
);

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const at = (path) => pathToFileURL(ROOT + path).href;

const START = '<!-- tools:start -->';
const END = '<!-- tools:end -->';

/** 언어마다 README 파일과 문구 */
const READMES = {
  ko: {
    file: 'README.md',
    count: (n) => `지금 도구 **${n}개**가 있고, 모두 무료입니다.`,
    section: '묶음',
    tools: '도구',
  },
  en: {
    file: 'README.en.md',
    count: (n) => `There are **${n} tools** right now, all free.`,
    section: 'Group',
    tools: 'Tools',
  },
};

async function loadToolIds() {
  const source = await readFile(ROOT + 'src/tools/registry.ts', 'utf8');
  const list = source.match(/const TOOL_IDS[^=]*=\s*\[([\s\S]*?)\];/)?.[1];
  if (!list) throw new Error('src/tools/registry.ts에서 TOOL_IDS를 찾지 못했습니다');
  return [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

async function loadTools() {
  const ids = await loadToolIds();
  return Promise.all(
    ids.map(async (id) => {
      const meta = (await import(at(`src/tools/${id}/meta.ts`))).default;
      return { ...meta, id, category: id.split('/')[0] };
    }),
  );
}

/** 사이트 주소: 한국어는 /pdf/merge/, 다른 언어는 /en/pdf/merge/ (src/i18n/locales.ts) */
function toolUrl(origin, locale, defaultLocale, id) {
  return `${origin}${locale === defaultLocale ? '' : `/${locale}`}/${id}/`;
}

function renderList(locale, { tools, categories, origin, defaultLocale }) {
  const text = READMES[locale];
  const live = tools.filter((tool) => tool.status === 'live');
  const out = [text.count(live.length), ''];

  for (const [categoryId, category] of Object.entries(categories)) {
    const inCategory = live.filter((tool) => tool.category === categoryId);
    if (inCategory.length === 0) continue;
    const categoryUrl = `${origin}${locale === defaultLocale ? '' : `/${locale}`}/${categoryId}/`;
    out.push(`### [${category.text[locale].name}](${categoryUrl})`, '');
    out.push(`| ${text.section} | ${text.tools} |`, '| --- | --- |');
    for (const [sectionId, sectionText] of Object.entries(category.sections)) {
      const inSection = inCategory.filter((tool) => tool.section === sectionId);
      if (inSection.length === 0) continue;
      const links = inSection.map(
        (tool) => `[${tool.text[locale].name}](${toolUrl(origin, locale, defaultLocale, tool.id)})`,
      );
      out.push(`| ${sectionText[locale]} | ${links.join(' · ')} |`);
    }
    out.push('');
  }
  return out.join('\n').trim();
}

async function main() {
  const check = process.argv.includes('--check');
  const [{ CATEGORIES }, { siteConfig }, { DEFAULT_LOCALE }, tools] = await Promise.all([
    import(at('src/tools/categories.ts')),
    import(at('src/site.config.ts')),
    import(at('src/i18n/locales.ts')),
    loadTools(),
  ]);
  const context = {
    tools,
    categories: CATEGORIES,
    origin: `https://${siteConfig.domain}`,
    defaultLocale: DEFAULT_LOCALE,
  };

  const stale = [];
  for (const locale of Object.keys(READMES)) {
    const { file } = READMES[locale];
    const path = ROOT + file;
    const current = await readFile(path, 'utf8');
    const start = current.indexOf(START);
    const end = current.indexOf(END);
    if (start < 0 || end < start) throw new Error(`${file}에 ${START} … ${END} 표시가 없습니다`);

    const replaced =
      current.slice(0, start + START.length) +
      '\n\n' +
      renderList(locale, context) +
      '\n\n' +
      current.slice(end);
    const options = (await prettier.resolveConfig(path)) ?? {};
    const next = await prettier.format(replaced, { ...options, filepath: path });

    if (next === current) continue;
    if (check) stale.push(file);
    else {
      await writeFile(path, next);
      console.log(`${file}의 도구 목록을 고쳤습니다`);
    }
  }

  if (stale.length > 0) {
    console.error(
      `README 도구 목록이 레지스트리와 다릅니다: ${stale.join(', ')}\n` +
        '`node scripts/readme/tools.mjs`로 다시 만들어 커밋하세요.',
    );
    process.exit(1);
  }
  if (check) console.log('README 도구 목록이 레지스트리와 같습니다');
}

await main();
