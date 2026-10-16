/**
 * 도구에서 쓸 수 있는 한글 글꼴 목록. 파일 정보(크기·SHA-256)는 scripts/fonts/build_fonts.py가 만든
 * catalog.json에서 오고, 이름·분류는 여기서 정한다. 글꼴을 더하면 두 곳을 함께 고친다.
 * 모두 SIL OFL 1.1 글꼴이다 (허가서: /data/fonts/licenses/).
 */
import type { Locale } from '../../i18n/locales';
import type { DataFile } from '../../frame/data';
import files from './catalog.json';

export type FontWeight = 400 | 700;

export interface FontFile extends DataFile {
  weight: FontWeight;
  /** 들어 있는 한글 음절 수 (전체 11172) */
  hangul: number;
}

export interface FontEntry {
  id: string;
  name: Record<Locale, string>;
  kind: 'sans' | 'serif' | 'hand' | 'display';
  files: FontFile[];
  /** 모든 굵기 합친 크기 */
  bytes: number;
}

const NAMES: Record<string, { name: Record<Locale, string>; kind: FontEntry['kind'] }> = {
  pretendard: { name: { ko: '프리텐다드', en: 'Pretendard' }, kind: 'sans' },
  'noto-sans-kr': { name: { ko: '본고딕 (Noto Sans KR)', en: 'Noto Sans KR' }, kind: 'sans' },
  'noto-serif-kr': { name: { ko: '본명조 (Noto Serif KR)', en: 'Noto Serif KR' }, kind: 'serif' },
  'nanum-gothic': { name: { ko: '나눔고딕', en: 'Nanum Gothic' }, kind: 'sans' },
  'nanum-myeongjo': { name: { ko: '나눔명조', en: 'Nanum Myeongjo' }, kind: 'serif' },
  'nanum-pen': { name: { ko: '나눔손글씨 펜', en: 'Nanum Pen Script' }, kind: 'hand' },
  'gowun-dodum': { name: { ko: '고운돋움', en: 'Gowun Dodum' }, kind: 'sans' },
  'black-han-sans': { name: { ko: '검은고딕', en: 'Black Han Sans' }, kind: 'display' },
};

export const FONTS: FontEntry[] = files.map((entry) => {
  const info = NAMES[entry.id];
  if (!info) throw new Error(`글꼴 이름이 없습니다: ${entry.id}`);
  const fontFiles = entry.files.map((file) => ({
    ...file,
    weight: file.weight as FontWeight,
    // 내용이 바뀌면 주소도 바뀌게 해 예전 보관본을 쓰지 않는다
    path: `${file.path}?v=${file.sha256.slice(0, 12)}`,
  }));
  return {
    id: entry.id,
    ...info,
    files: fontFiles,
    bytes: fontFiles.reduce((sum, file) => sum + file.bytes, 0),
  };
});

/** 보관소에서 글꼴 받기 동의를 기억하는 이름 (글꼴마다 따로) */
export const fontConsent = (font: FontEntry) => `font:${font.id}`;

/** 미리보기 그림 주소 (빌드 때 미리 그린 SVG) */
export const fontPreview = (font: FontEntry, locale: Locale) =>
  `/data/fonts/previews/${font.id}.${locale}.svg`;
