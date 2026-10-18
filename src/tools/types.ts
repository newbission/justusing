/**
 * 도구 정의 타입. 각 도구 폴더의 meta.ts가 defineTool()로 자기 정보를 내보낸다.
 *
 * 도구 ID와 URL은 폴더 경로에서 정해진다:
 *   src/tools/pdf/merge/meta.ts → ID 'pdf/merge' → 주소 /pdf/merge/
 */

import type { Locale } from '../i18n/locales';

/** 화면·검색에 쓰이는 문구 (언어별) */
export interface ToolText {
  /** 화면 제목·카드 이름 (예: 'PDF 합치기') */
  name: string;
  /** <title> (예: 'PDF 합치기 - 업로드 없이 브라우저에서') */
  title: string;
  /** 검색 결과 설명·카드 설명 */
  description: string;
}

export interface ToolMeta {
  /** live: 공개 / soon: 목록에만 '준비 중'으로 표시하고 페이지는 만들지 않음 */
  status: 'live' | 'soon';
  /** 언어별 문구. 사이트의 모든 언어가 있어야 한다 (src/i18n/locales.ts) */
  text: Record<Locale, ToolText>;
  /** 카테고리 안의 묶음 (src/tools/categories.ts의 sections 키, 예: 'convert') */
  section: string;
  /**
   * 목록 카드의 아이콘. 24×24 칸에 선으로 그린 SVG path의 d 값들 (채우지 않고 선만 그린다).
   * 색은 카드가 정한다. 도구끼리 한눈에 구분되게 그린다.
   */
  icon: string[];
  /** 관련 도구 ID 목록 (예: ['pdf/split']) */
  related?: string[];
}

export function defineTool(meta: ToolMeta): ToolMeta {
  return meta;
}

/** 도구 페이지 아래쪽 글 (쓰임새·사용법·FAQ). 검색 노출과 광고 심사를 위해 충분히 쓴다. */
export interface ToolContentText {
  /**
   * 이럴 때 쓰세요: 이 도구가 필요한 실제 상황 3개. 도구마다 다른 내용이라 페이지가 틀에 박혀 보이지 않게 한다.
   * 도구가 실제로 하는 일만 쓴다 (못 하는 일을 할 수 있는 것처럼 쓰지 않는다)
   */
  uses?: { title: string; text: string }[];
  /** 사용법 단계. 순서대로 한 단계씩 */
  howTo: string[];
  /** 자주 묻는 질문 */
  faq: { q: string; a: string }[];
}

/** 각 도구 폴더의 content.ts가 내보낸다. 사이트의 모든 언어가 있어야 한다. */
export type ToolContent = Record<Locale, ToolContentText>;

export function defineContent(content: ToolContent): ToolContent {
  return content;
}
