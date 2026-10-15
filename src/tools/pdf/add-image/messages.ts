/** PDF 이미지 넣기 도구 화면의 문구 (공통 문구는 src/frame/messages.ts) */
import type { Locale } from '../../../i18n/locales';
import type { StampMessages } from '../../../lib/pdf/StampTool.svelte';

const ko = {
  bar: '이미지 넣기',
  needImage: 'PDF에 넣을 이미지를 고르세요.',
  ready: (pages: number) =>
    pages === 1
      ? '이 쪽의 고른 자리에 이미지를 넣습니다.'
      : `${pages}쪽 모두 같은 자리에 넣습니다.`,
  working: '넣는 중…',
  run: '이미지 넣기',
  failed: '이미지를 넣지 못했습니다. 다른 이미지로 해 보세요.',
  suffix: '이미지',
  scopeGroup: '넣을 쪽',
  scopes: { page: '이 쪽만', all: '모든 쪽' },
  choose: '이미지 선택',
  chooseHint:
    'JPG·PNG 이미지를 고르세요. 로고·도장처럼 배경이 투명한 PNG는 투명한 채로 들어갑니다.',
  otherImage: '다른 이미지',
  cannotOpen: '이 이미지를 열 수 없습니다. 다른 이미지를 골라 주세요.',
};

const en: typeof ko = {
  bar: 'Add image',
  needImage: 'Choose the image to add to the PDF.',
  ready: (pages: number) =>
    pages === 1
      ? 'Adds the image at the chosen spot on this page.'
      : `Adds it at the same spot on all ${pages} pages.`,
  working: 'Adding…',
  run: 'Add image',
  failed: 'Could not add the image. Try a different image.',
  suffix: 'with-image',
  scopeGroup: 'Pages',
  scopes: { page: 'This page', all: 'All pages' },
  choose: 'Choose image',
  chooseHint:
    'Choose a JPG or PNG image. PNG images with a transparent background, like logos or stamps, stay transparent.',
  otherImage: 'Change image',
  cannotOpen: 'This image cannot be opened. Please choose a different one.',
};

export const MESSAGES: Record<Locale, typeof ko & StampMessages> = { ko, en };
