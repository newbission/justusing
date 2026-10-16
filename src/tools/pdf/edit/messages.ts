/** PDF 편집 도구 화면의 문구 (공통 문구는 src/frame/messages.ts) */
import type { Locale } from '../../../i18n/locales';

export type Mode = 'select' | 'text' | 'whiteout' | 'highlight';
export type Tint = 'black' | 'blue' | 'red';

const ko = {
  bar: 'PDF 편집',
  modeGroup: '편집 도구',
  modes: {
    select: { label: '고르기·옮기기', short: '고르기' },
    text: { label: '글자 넣기', short: '글자' },
    whiteout: { label: '흰색으로 가리기', short: '가리기' },
    highlight: { label: '형광펜', short: '형광펜' },
  } satisfies Record<Mode, { label: string; short: string }>,
  help: {
    select: '넣은 것을 눌러 고르고 끌어서 옮깁니다. 고른 것은 아래에서 고치거나 지웁니다.',
    text: '글자를 넣을 자리를 누르세요. 아래 칸에 글자를 적습니다.',
    whiteout: '가릴 곳을 끌어서 사각형을 그리세요.',
    highlight: '칠할 곳을 끌어서 사각형을 그리세요.',
  } satisfies Record<Mode, string>,
  whiteoutNote:
    '흰색 가리기는 위에 흰 사각형을 덮을 뿐이라 아래 글자는 파일에 남아 복사·검색될 수 있습니다. 개인정보를 지우는 용도로 쓰지 마세요.',
  selected: '고른 것',
  textLabel: '글자 (줄바꿈 가능)',
  sizeLabel: '글자 크기 (pt)',
  tintGroup: '글자 색',
  tints: { black: '검정', blue: '파랑', red: '빨강' } satisfies Record<Tint, string>,
  remove: '지우기',
  item: {
    text: (text: string) => `글자: ${text || '(비어 있음)'}`,
    whiteout: '흰색 가리기',
    highlight: '형광펜',
  },
  count: (count: number) => `넣은 것 ${count}개`,
  undo: '마지막 것 지우기',
  needItems: '쪽 위에 글자를 넣거나 사각형을 그려 주세요.',
  needFont: '글자를 넣으려면 아래에서 글꼴을 받아 고르세요.',
  ready: (count: number) => `${count}개를 PDF에 넣습니다.`,
  working: '저장하는 중…',
  run: '편집한 PDF 만들기',
  missing: (chars: string) => `이 글꼴에 없는 글자가 있습니다: ${chars}. 다른 글꼴을 고르세요.`,
  failed: 'PDF를 만들지 못했습니다. 파일이 손상되었거나 기기의 메모리가 부족할 수 있습니다.',
  suffix: '편집',
};

const en: typeof ko = {
  bar: 'Edit PDF',
  modeGroup: 'Editing tool',
  modes: {
    select: { label: 'Select & move', short: 'Select' },
    text: { label: 'Add text', short: 'Text' },
    whiteout: { label: 'White out', short: 'White out' },
    highlight: { label: 'Highlight', short: 'Highlight' },
  },
  help: {
    select: 'Click something you added to select it, and drag to move it. Edit or delete it below.',
    text: 'Click where you want the text. Type it in the box below.',
    whiteout: 'Drag to draw a rectangle over what you want to cover.',
    highlight: 'Drag to draw a rectangle over what you want to highlight.',
  },
  whiteoutNote:
    'White out only places a white rectangle on top. The text underneath stays in the file and can still be copied or searched. Do not use it to remove personal information.',
  selected: 'Selected',
  textLabel: 'Text (line breaks allowed)',
  sizeLabel: 'Font size (pt)',
  tintGroup: 'Text color',
  tints: { black: 'Black', blue: 'Blue', red: 'Red' },
  remove: 'Delete',
  item: {
    text: (text: string) => `Text: ${text || '(empty)'}`,
    whiteout: 'White out',
    highlight: 'Highlight',
  },
  count: (count: number) => `${count} ${count === 1 ? 'item' : 'items'} added`,
  undo: 'Delete the last one',
  needItems: 'Add text or draw a rectangle on the page.',
  needFont: 'To add text, download and choose a font below.',
  ready: (count: number) => `Add ${count} ${count === 1 ? 'item' : 'items'} to the PDF.`,
  working: 'Saving…',
  run: 'Create edited PDF',
  missing: (chars: string) =>
    `This font does not have some characters: ${chars}. Choose another font.`,
  failed: 'Could not create the PDF. The file may be damaged, or your device may be low on memory.',
  suffix: 'edited',
};

export const MESSAGES: Record<Locale, typeof ko> = { ko, en };
