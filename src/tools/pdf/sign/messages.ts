/** PDF 서명 넣기 도구 화면의 문구 (공통 문구는 src/frame/messages.ts) */
import type { Locale } from '../../../i18n/locales';
import type { StampMessages } from '../../../lib/pdf/StampTool.svelte';

const ko = {
  bar: '서명 넣기',
  needImage: '아래 칸에 서명을 그리고 "서명 완료"를 누르세요.',
  ready: (pages: number) =>
    pages === 1 ? '이 쪽의 고른 자리에 서명을 넣습니다.' : `${pages}쪽 모두 같은 자리에 넣습니다.`,
  working: '넣는 중…',
  run: '서명 넣기',
  failed: '서명을 넣지 못했습니다. 파일이 손상되었을 수 있습니다.',
  suffix: '서명',
  scopeGroup: '넣을 쪽',
  scopes: { page: '이 쪽만', all: '모든 쪽' },
  redraw: '다시 그리기',
  upload: '서명 이미지 올리기',
  uploadHint: '종이에 한 서명을 찍은 사진이나 PNG 서명 이미지도 쓸 수 있습니다.',
  cannotOpen: '이 이미지를 열 수 없습니다. 다른 이미지를 골라 주세요.',
};

const en: typeof ko = {
  bar: 'Sign',
  needImage: 'Draw your signature in the box below and click "Done".',
  ready: (pages: number) =>
    pages === 1
      ? 'Adds your signature at the chosen spot on this page.'
      : `Adds it at the same spot on all ${pages} pages.`,
  working: 'Adding…',
  run: 'Sign PDF',
  failed: 'Could not add the signature. The file may be damaged.',
  suffix: 'signed',
  scopeGroup: 'Pages',
  scopes: { page: 'This page', all: 'All pages' },
  redraw: 'Draw again',
  upload: 'Upload signature image',
  uploadHint: 'You can also use a photo of a signature on paper or a PNG signature image.',
  cannotOpen: 'This image cannot be opened. Please choose a different one.',
};

export const MESSAGES: Record<Locale, typeof ko & StampMessages> = { ko, en };
