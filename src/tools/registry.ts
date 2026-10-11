/**
 * 도구 레지스트리. 사이트에 노출되는 도구 목록의 유일한 출처.
 *
 * 새 도구 추가 방법:
 *   1. src/tools/<카테고리>/<이름>/ 폴더를 만들고 meta.ts, Tool.astro를 둔다.
 *   2. 아래 TOOL_IDS에 '<카테고리>/<이름>' 한 줄을 넣는다.
 * 허브·카테고리 목록·사이트맵·메뉴·관련 도구가 이 목록에서 자동으로 만들어진다.
 */
import { CATEGORIES, isCategoryId, type CategoryId } from './categories';
import type { ToolMeta } from './types';

/** 노출 순서대로, 한 줄에 하나 (포맷터가 한 줄로 합치지 않게 prettier-ignore) */
// prettier-ignore
const TOOL_IDS: readonly string[] = [
  'pdf/view',
];

export interface Tool extends ToolMeta {
  /** 'pdf/merge' */
  id: string;
  category: CategoryId;
  /** 페이지 주소 '/pdf/merge/' */
  href: string;
}

const metaModules = import.meta.glob<{ default: ToolMeta }>('./*/*/meta.ts', { eager: true });

function loadTool(id: string): Tool {
  const meta = metaModules[`./${id}/meta.ts`]?.default;
  if (!meta) throw new Error(`도구 정의 파일이 없습니다: src/tools/${id}/meta.ts`);

  const category = id.split('/')[0] ?? '';
  if (!isCategoryId(category)) throw new Error(`등록되지 않은 카테고리입니다: ${id}`);

  return { ...meta, id, category, href: `/${id}/` };
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

/** 실제 페이지가 있는 도구 */
export const liveTools: Tool[] = tools.filter((tool) => tool.status === 'live');

/** 도구가 하나라도 있는 카테고리. 목록 페이지와 메뉴는 이것만 보여준다. */
export const visibleCategories: CategoryId[] = (Object.keys(CATEGORIES) as CategoryId[]).filter(
  (category) => toolsInCategory(category).length > 0,
);
