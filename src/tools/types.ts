/**
 * 도구 정의 타입. 각 도구 폴더의 meta.ts가 defineTool()로 자기 정보를 내보낸다.
 *
 * 도구 ID와 URL은 폴더 경로에서 정해진다:
 *   src/tools/pdf/merge/meta.ts → ID 'pdf/merge' → 주소 /pdf/merge/
 */

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
  /** 언어별 문구. 기본 언어(ko)는 필수, 나머지는 번역이 생기면 추가 */
  text: { ko: ToolText };
  /** 관련 도구 ID 목록 (예: ['pdf/split']) */
  related?: string[];
}

export function defineTool(meta: ToolMeta): ToolMeta {
  return meta;
}
