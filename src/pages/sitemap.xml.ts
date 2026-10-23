/**
 * 검색엔진용 사이트맵. 레지스트리와 가이드 글 목록에서 자동으로 만든다. 모든 페이지를 모든 언어로 싣는다.
 */
import type { APIRoute } from 'astro';
import { LOCALES, localizePath } from '../i18n/locales';
import { liveTools, visibleCategories } from '../tools/registry';
import { guideCategories, guideSlugs } from '../guides';

export const GET: APIRoute = ({ site }) => {
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
    .flatMap((path) => LOCALES.map((locale) => localizePath(path, locale)))
    .map((path) => `  <url><loc>${new URL(path, site)}</loc></url>`)
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
};
