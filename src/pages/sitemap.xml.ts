/**
 * 검색엔진용 사이트맵. 레지스트리와 가이드 글 목록에서 자동으로 만든다. 모든 페이지를 모든 언어로 싣는다.
 *
 * 고친 날(lastmod)은 확실히 아는 페이지에만 적는다 (틀린 날짜를 적으면 검색엔진이 이 값을 믿지 않는다).
 * - 가이드: 글 머리말의 updated, 없으면 published
 * - 도구: 그 도구 폴더를 마지막으로 고친 커밋 날짜. git 기록이 다 있을 때만 (얕은 clone이면 모두 같은 날이 된다)
 */
import type { APIRoute } from 'astro';
import { execFileSync } from 'node:child_process';
import { LOCALES, localizePath } from '../i18n/locales';
import { liveTools, visibleCategories } from '../tools/registry';
import { guideCategories, guideSlugs, guidesIn, slugOf } from '../guides';

/** git 명령 결과. git이 없거나 실패하면 undefined */
function git(...args: string[]): string | undefined {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return undefined;
  }
}

const fullHistory = git('rev-parse', '--is-shallow-repository') === 'false';

/** 폴더를 마지막으로 고친 날 (YYYY-MM-DD) */
function folderDate(folder: string): string | undefined {
  if (!fullHistory) return undefined;
  return git('log', '-1', '--format=%cs', '--', folder) || undefined;
}

const day = (date: Date) => date.toISOString().slice(0, 10);

export const GET: APIRoute = ({ site }) => {
  const lastmod = new Map<string, string | undefined>();
  for (const tool of liveTools) lastmod.set(tool.href, folderDate(`src/tools/${tool.id}/`));
  // 가이드 날짜는 한국어판 기준 (두 언어판을 함께 고친다)
  for (const guide of guidesIn('ko')) {
    lastmod.set(`/guide/${slugOf(guide)}/`, day(guide.data.updated ?? guide.data.published));
  }

  const paths = [
    '/',
    ...visibleCategories.map((category) => `/${category}/`),
    ...liveTools.map((tool) => tool.href),
    '/guide/',
    ...guideCategories.map((category) => `/guide/${category}/`),
    ...guideSlugs.map((slug) => `/guide/${slug}/`),
    '/about/',
    '/safety/',
    '/privacy/',
    '/terms/',
    '/contact/',
  ];
  const urls = paths
    .flatMap((path) =>
      LOCALES.map((locale) => {
        const date = lastmod.get(path);
        const loc = new URL(localizePath(path, locale), site);
        return date
          ? `  <url><loc>${loc}</loc><lastmod>${date}</lastmod></url>`
          : `  <url><loc>${loc}</loc></url>`;
      }),
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
};
