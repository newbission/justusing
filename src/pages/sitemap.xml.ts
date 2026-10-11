/**
 * 검색엔진용 사이트맵. 레지스트리에서 자동으로 만든다.
 */
import type { APIRoute } from 'astro';
import { liveTools, visibleCategories } from '../tools/registry';

export const GET: APIRoute = ({ site }) => {
  const paths = [
    '/',
    ...visibleCategories.map((category) => `/${category}/`),
    ...liveTools.map((tool) => tool.href),
  ];
  const urls = paths.map((path) => `  <url><loc>${new URL(path, site)}</loc></url>`).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
};
