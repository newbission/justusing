/**
 * 가이드 글 목록 (src/content/guides/<언어>/<주소>.md). 가이드 목록·글 페이지·사이트맵·도구 페이지가 쓴다.
 * 빌드 때 모든 언어판이 있는지, 안내하는 도구가 공개된 도구인지 확인한다.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { LOCALES, type Locale } from './i18n/locales';
import { getTool } from './tools/registry';

export type Guide = CollectionEntry<'guides'>;

/** 가이드 주소 이름 (ko/compress-pdf → compress-pdf) */
export const slugOf = (guide: Guide) => guide.id.split('/')[1]!;
const localeOfGuide = (guide: Guide) => guide.id.split('/')[0] as Locale;

const all = await getCollection('guides');

for (const guide of all) {
  if (!(LOCALES as readonly string[]).includes(localeOfGuide(guide))) {
    throw new Error(`가이드 폴더가 언어가 아닙니다: src/content/guides/${guide.id}.md`);
  }
  const tool = getTool(guide.data.tool);
  if (tool?.status !== 'live') {
    throw new Error(
      `가이드가 안내하는 도구가 공개되지 않았습니다: ${guide.id} → ${guide.data.tool}`,
    );
  }
}
for (const slug of new Set(all.map(slugOf))) {
  for (const locale of LOCALES) {
    if (!all.some((guide) => slugOf(guide) === slug && localeOfGuide(guide) === locale)) {
      throw new Error(`가이드의 ${locale} 글이 없습니다: src/content/guides/${locale}/${slug}.md`);
    }
  }
}

/** 한 언어의 가이드들 (order 순) */
export function guidesIn(locale: Locale): Guide[] {
  return all
    .filter((guide) => localeOfGuide(guide) === locale)
    .sort((a, b) => a.data.order - b.data.order);
}

/** 모든 가이드 주소 이름 */
export const guideSlugs: string[] = [...new Set(all.map(slugOf))];

/** 가이드 글 페이지들 (한국어·영어 라우트가 같이 쓴다) */
export const guidePaths = () => guideSlugs.map((slug) => ({ params: { slug }, props: { slug } }));

/** 이 도구를 안내하는 가이드들 (도구 페이지 아래에 단다) */
export function guidesForTool(toolId: string, locale: Locale): Guide[] {
  return guidesIn(locale).filter((guide) => guide.data.tool === toolId);
}
