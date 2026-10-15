/**
 * 글 모음. 가이드는 src/content/guides/<언어>/<주소>.md 에 언어마다 하나씩 쓴다
 * (예: ko/compress-pdf.md → /guide/compress-pdf/, en/compress-pdf.md → /en/guide/compress-pdf/).
 * 모든 언어판이 있어야 한다 (src/guides.ts가 빌드 때 확인).
 */
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const guides = defineCollection({
  loader: glob({ pattern: '*/*.md', base: './src/content/guides' }),
  schema: z.object({
    /** 글 제목 (h1, <title>) */
    title: z.string(),
    /** 검색 결과·목록 카드 설명 */
    description: z.string(),
    /** 글이 안내하는 도구 ID (예: 'pdf/compress'). 글 위아래에 도구로 가는 버튼을 단다 */
    tool: z.string(),
    /** 처음 쓴 날, 마지막으로 고친 날 */
    published: z.coerce.date(),
    updated: z.coerce.date().optional(),
    /** 목록 순서 (작을수록 앞) */
    order: z.number(),
  }),
});

export const collections = { guides };
