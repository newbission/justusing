/**
 * 도구 레지스트리. 사이트에 노출되는 도구 목록의 유일한 출처.
 *
 * 새 도구 추가 방법:
 *   1. src/tools/<카테고리>/<이름>/ 폴더를 만든다.
 *      - meta.ts      상태·문구·관련 도구 (defineTool)
 *      - content.ts   사용법·FAQ (defineContent) — live 도구는 필수
 *      - Frame.astro  격리 frame 안의 도구 화면 (FrameLayout + App)
 *      - App.svelte   실제 도구 UI
 *   2. 아래 TOOL_IDS에 '<카테고리>/<이름>' 한 줄을 넣는다.
 * 허브·카테고리 목록·사이트맵·메뉴·관련 도구가 이 목록에서 자동으로 만들어진다.
 */
import { CATEGORIES, isCategoryId, type CategoryId, type SectionText } from './categories';
import type { ToolContent, ToolMeta } from './types';

/** 노출 순서대로, 한 줄에 하나 (포맷터가 한 줄로 합치지 않게 prettier-ignore) */
// prettier-ignore
const TOOL_IDS: readonly string[] = [
  'pdf/view',
  'pdf/extract-text',
  'pdf/extract-images',
  'pdf/merge',
  'pdf/split',
  'pdf/rotate',
  'pdf/organize',
  'pdf/n-up',
  'pdf/crop',
  'pdf/to-image',
  'pdf/from-image',
  'pdf/ocr',
  'pdf/compress',
  'pdf/page-numbers',
  'pdf/watermark',
  'pdf/header-footer',
  'pdf/add-image',
  'pdf/sign',
  'pdf/unlock',
  'pdf/protect',
  'pdf/metadata',
  'pdf/redact',
  'pdf/edit',
  'pdf/fill-form',
  'image/compress',
  'image/resize',
  'image/convert',
  'image/heic-to-jpg',
  'image/id-photo',
  'image/remove-location',
  'image/stitch',
  'image/crop',
  'image/mosaic',
  'text/csv-encoding',
];

export interface Tool extends ToolMeta {
  /** 'pdf/merge' */
  id: string;
  category: CategoryId;
  /** 페이지 주소 '/pdf/merge/' */
  href: string;
  /** 사용법·FAQ (content.ts). live 도구는 반드시 있다. */
  content?: ToolContent;
}

const metaModules = import.meta.glob<{ default: ToolMeta }>('./*/*/meta.ts', { eager: true });
const contentModules = import.meta.glob<{ default: ToolContent }>('./*/*/content.ts', {
  eager: true,
});

function loadTool(id: string): Tool {
  const meta = metaModules[`./${id}/meta.ts`]?.default;
  if (!meta) throw new Error(`도구 정의 파일이 없습니다: src/tools/${id}/meta.ts`);

  const category = id.split('/')[0] ?? '';
  if (!isCategoryId(category)) throw new Error(`등록되지 않은 카테고리입니다: ${id}`);

  const content = contentModules[`./${id}/content.ts`]?.default;
  if (meta.status === 'live' && !content) {
    throw new Error(`공개(live) 도구에는 사용법·FAQ가 필요합니다: src/tools/${id}/content.ts`);
  }

  if (!(meta.section in CATEGORIES[category].sections)) {
    throw new Error(`${id}의 section이 ${category} 카테고리에 없습니다: ${meta.section}`);
  }

  return { ...meta, id, category, href: `/${id}/`, content };
}

export const tools: Tool[] = TOOL_IDS.map(loadTool);

// 관련 도구에 오타나 빠진 도구가 있으면 빌드를 멈춘다
for (const tool of tools) {
  for (const relatedId of tool.related ?? []) {
    if (!TOOL_IDS.includes(relatedId)) {
      throw new Error(`${tool.id}의 관련 도구가 레지스트리에 없습니다: ${relatedId}`);
    }
  }
}

export function getTool(id: string): Tool | undefined {
  return tools.find((tool) => tool.id === id);
}

export function toolsInCategory(category: CategoryId): Tool[] {
  return tools.filter((tool) => tool.category === category);
}

export interface ToolSection {
  id: string;
  text: SectionText;
  tools: Tool[];
}

/** 카테고리의 도구를 묶음별로 (categories.ts의 sections 순서, 도구가 없는 묶음은 뺀다) */
export function sectionsInCategory(category: CategoryId): ToolSection[] {
  const sections: Record<string, SectionText> = CATEGORIES[category].sections;
  return Object.entries(sections)
    .map(([id, text]) => ({
      id,
      text,
      tools: toolsInCategory(category).filter((tool) => tool.section === id),
    }))
    .filter((section) => section.tools.length > 0);
}

/** 실제 페이지가 있는 도구 */
export const liveTools: Tool[] = tools.filter((tool) => tool.status === 'live');

/** 도구가 하나라도 있는 카테고리. 목록 페이지와 메뉴는 이것만 보여준다. */
export const visibleCategories: CategoryId[] = (Object.keys(CATEGORIES) as CategoryId[]).filter(
  (category) => toolsInCategory(category).length > 0,
);
