/**
 * 도구 카테고리. 카테고리 ID는 URL 첫 경로가 된다 (pdf → /pdf/).
 * 새 카테고리는 여기에 추가한다. 순서가 곧 화면 노출 순서다.
 * 카테고리 ID는 주소 첫 경로라 public/의 폴더(data·samples·vendor)나 다른 페이지(guide·en·brand 등)와
 * 겹치면 안 된다 (예: /data/는 글꼴·OCR 데이터 자리라 텍스트 도구는 text로 했다).
 */
import type { Locale } from '../i18n/locales';

export interface CategoryText {
  name: string;
  /** 검색 결과에 보이는 페이지 제목 (사이트 이름은 뒤에 붙는다) */
  title: string;
  description: string;
}

/** 카테고리 안의 도구 묶음. 목록 페이지에서 소제목으로 나눠 보여준다 */
export type SectionText = Record<Locale, string>;

export const CATEGORIES = {
  pdf: {
    text: {
      ko: {
        name: 'PDF',
        title: '무료 PDF 도구 모음 - 합치기·나누기·압축·변환, 업로드 없이',
        description: 'PDF를 업로드 없이 보고, 합치고, 나누고, 고치고, 변환하는 도구',
      },
      en: {
        name: 'PDF',
        title: 'Free PDF tools - Merge, split, compress and convert PDFs without uploading',
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
        title: '무료 이미지 도구 모음 - 사진 압축·크기 조절·변환·증명사진, 업로드 없이',
        description:
          '이미지를 업로드 없이 줄이고, 정한 용량에 맞추고, 크기를 바꾸고, 변환하고(아이폰 HEIC 포함), 글자를 뽑고, 이어 붙이고, 자르고 돌리고, 모자이크로 가리고, 증명사진으로 맞추고, 위치 정보를 지우는 도구',
      },
      en: {
        name: 'Image',
        title: 'Free image tools - Compress, resize and convert photos without uploading',
        description:
          'Compress, fit to a file size, resize, convert (including iPhone HEIC), extract text, stitch, crop, rotate, pixelate, make ID photos and remove location data without uploading',
      },
    },
    sections: {
      optimize: { ko: '용량·크기', en: 'Size' },
      convert: { ko: '변환', en: 'Convert' },
      edit: { ko: '편집', en: 'Edit' },
      photo: { ko: '사진 다듬기', en: 'Photo' },
    },
  },
  text: {
    text: {
      ko: {
        name: '텍스트·CSV',
        title: '무료 텍스트·CSV 도구 - CSV 한글 깨짐 고치기, 업로드 없이',
        description:
          'CSV·TXT 같은 글자 파일을 업로드 없이 고치는 도구. 엑셀에서 깨지는 한글을 바로잡습니다',
      },
      en: {
        name: 'Text & CSV',
        title: 'Free text and CSV tools - Fix garbled CSV text without uploading',
        description:
          'Fix text files such as CSV and TXT without uploading them, including text that shows up garbled in Excel',
      },
    },
    sections: {
      encoding: { ko: '인코딩', en: 'Encoding' },
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
