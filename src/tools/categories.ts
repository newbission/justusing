/**
 * 도구 카테고리. 카테고리 ID는 URL 첫 경로가 된다 (pdf → /pdf/).
 * 새 카테고리는 여기에 추가한다. 순서가 곧 화면 노출 순서다.
 */
import type { Locale } from '../i18n/locales';

export interface CategoryText {
  name: string;
  description: string;
}

/** 카테고리 안의 도구 묶음. 목록 페이지에서 소제목으로 나눠 보여준다 */
export type SectionText = Record<Locale, string>;

export const CATEGORIES = {
  pdf: {
    text: {
      ko: {
        name: 'PDF',
        description: 'PDF를 업로드 없이 보고, 합치고, 나누고, 고치고, 변환하는 도구',
      },
      en: {
        name: 'PDF',
        description: 'View, merge, split, edit and convert PDFs without uploading them',
      },
    },
    /** 순서가 곧 화면 순서다. 도구는 meta.ts의 section으로 들어간다 */
    sections: {
      view: { ko: '보기·추출', en: 'View & extract' },
      pages: { ko: '페이지 정리', en: 'Organize pages' },
      edit: { ko: '편집', en: 'Edit' },
      convert: { ko: '변환', en: 'Convert' },
      optimize: { ko: '최적화', en: 'Optimize' },
      security: { ko: '보안', en: 'Security' },
    },
  },
  image: {
    text: {
      ko: {
        name: '이미지',
        description:
          '이미지를 업로드 없이 줄이고, 크기를 바꾸고, 변환하고, 증명사진으로 맞추는 도구',
      },
      en: {
        name: 'Image',
        description:
          'Compress, resize, convert and crop images to ID photo size without uploading them',
      },
    },
    sections: {
      optimize: { ko: '용량·크기', en: 'Size' },
      convert: { ko: '변환', en: 'Convert' },
      photo: { ko: '사진 다듬기', en: 'Photo' },
    },
  },
} as const satisfies Record<
  string,
  { text: Record<Locale, CategoryText>; sections: Record<string, SectionText> }
>;

export type CategoryId = keyof typeof CATEGORIES;

export function isCategoryId(id: string): id is CategoryId {
  return id in CATEGORIES;
}
