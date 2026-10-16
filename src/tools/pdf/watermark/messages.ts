/** 글자 워터마크 도구 화면의 문구 (공통 문구는 src/frame/messages.ts) */
import type { Locale } from '../../../i18n/locales';

export type Size = 'small' | 'medium' | 'large';
export type Strength = 'light' | 'medium' | 'strong';
export type Tint = 'gray' | 'red' | 'blue';
export type Angle = 'diagonal' | 'flat';

const ko = {
  bar: '워터마크 넣기',
  text: '넣을 글자',
  defaultText: '대외비',
  layoutGroup: '배치',
  layouts: { center: '가운데 하나', tile: '쪽 전체에 반복' },
  angleGroup: '기울기',
  angles: { diagonal: '비스듬히', flat: '가로' } satisfies Record<Angle, string>,
  sizeGroup: '크기',
  sizes: { small: '작게', medium: '보통', large: '크게' } satisfies Record<Size, string>,
  strengthGroup: '진하기',
  strengths: { light: '연하게', medium: '보통', strong: '진하게' } satisfies Record<
    Strength,
    string
  >,
  tintGroup: '색',
  tints: { gray: '회색', red: '빨강', blue: '파랑' } satisfies Record<Tint, string>,
  weightGroup: '굵기',
  weights: { 400: '보통', 700: '굵게' },
  preview: '미리보기입니다. 모든 쪽에 같은 모양으로 들어갑니다.',
  needText: '넣을 글자를 적어 주세요.',
  needFont: '아래에서 글꼴을 받아 고르세요.',
  ready: (pages: number) => `모든 쪽(${pages}쪽)에 워터마크를 넣습니다.`,
  working: '넣는 중…',
  run: '워터마크 넣기',
  missing: (chars: string) => `이 글꼴에 없는 글자가 있습니다: ${chars}. 다른 글꼴을 고르세요.`,
  failed: '워터마크를 넣지 못했습니다. 파일이 손상되었거나 기기의 메모리가 부족할 수 있습니다.',
  suffix: '워터마크',
};

const en: typeof ko = {
  bar: 'Add watermark',
  text: 'Watermark text',
  defaultText: 'CONFIDENTIAL',
  layoutGroup: 'Layout',
  layouts: { center: 'Once in the center', tile: 'Repeat across the page' },
  angleGroup: 'Angle',
  angles: { diagonal: 'Diagonal', flat: 'Horizontal' },
  sizeGroup: 'Size',
  sizes: { small: 'Small', medium: 'Medium', large: 'Large' },
  strengthGroup: 'Opacity',
  strengths: { light: 'Light', medium: 'Medium', strong: 'Strong' },
  tintGroup: 'Color',
  tints: { gray: 'Gray', red: 'Red', blue: 'Blue' },
  weightGroup: 'Weight',
  weights: { 400: 'Regular', 700: 'Bold' },
  preview: 'Preview. The watermark is added the same way to every page.',
  needText: 'Enter the watermark text.',
  needFont: 'Download and choose a font below.',
  ready: (pages: number) =>
    `Add the watermark to every page (${pages} ${pages === 1 ? 'page' : 'pages'}).`,
  working: 'Adding…',
  run: 'Add watermark',
  missing: (chars: string) =>
    `This font does not have some characters: ${chars}. Choose another font.`,
  failed:
    'Could not add the watermark. The file may be damaged, or your device may be low on memory.',
  suffix: 'watermark',
};

export const MESSAGES: Record<Locale, typeof ko> = { ko, en };
