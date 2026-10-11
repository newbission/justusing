/**
 * 도구 카테고리. 카테고리 ID는 URL 첫 경로가 된다 (pdf → /pdf/).
 * 새 카테고리(예: image)는 여기에 추가한다. 순서가 곧 화면 노출 순서다.
 */

export interface CategoryText {
  name: string;
  description: string;
}

export const CATEGORIES = {
  pdf: {
    text: {
      ko: {
        name: 'PDF',
        description: 'PDF를 업로드 없이 보고, 합치고, 나누고, 편집하는 도구',
      },
    },
  },
} as const satisfies Record<string, { text: { ko: CategoryText } }>;

export type CategoryId = keyof typeof CATEGORIES;

export function isCategoryId(id: string): id is CategoryId {
  return id in CATEGORIES;
}
