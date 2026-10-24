/** 이미지 글자 추출(OCR) 도구 화면의 문구 (공통 문구는 src/frame/messages.ts) */
import type { Locale } from '../../../i18n/locales';

const ko = {
  bar: '글자 인식',
  hint: '사진·화면 캡처·스캔 이미지를 여러 장 한 번에 고를 수 있습니다 · 이미지는 이 기기를 떠나지 않습니다',
  broken: '열 수 없는 이미지입니다. 빼고 읽습니다.',
  tips: '밝고 반듯하게, 글자가 또렷하게 찍힌 이미지일수록 잘 읽습니다. 기울어지거나 옆으로 누운 이미지는 바로 세워 읽습니다.',
  boxes: '읽은 줄 표시',
  loading: '이미지를 여는 중…',
  needOne: '글자를 읽을 이미지를 넣어 주세요.',
  ready: (count: number) => `이미지 ${count}장의 글자를 읽습니다.`,
  starting: '인식 엔진을 준비하는 중…',
  working: (done: number, total: number) => `글자 읽는 중 ${done}/${total}장`,
  done: (count: number, characters: string) =>
    `이미지 ${count}장에서 글자 ${characters}자를 읽었습니다. 글자 칸에서 고쳐 쓸 수 있습니다.`,
  someFailed: (count: number) => `${count}장은 읽지 못했습니다. 목록에서 확인하세요.`,
  failed:
    '글자를 읽지 못했습니다. 기기의 메모리가 부족할 수 있습니다. 다른 앱을 닫고 다시 해 보세요.',
  run: '글자 인식',
  copyAll: '모두 복사',
  downloadText: 'TXT 다운로드',
  copied: '글자를 복사했습니다.',
  copyFailed: '복사하지 못했습니다. 글자 칸을 직접 골라 복사해 주세요.',
  /** 목록 줄 */
  itemWorking: '읽는 중…',
  itemDone: (lines: number, characters: string) => `${lines}줄 · 글자 ${characters}자`,
  itemEmpty: '찾은 글자가 없습니다',
  itemFailed: '이 이미지는 읽지 못했습니다',
  copy: (name: string) => `${name}의 글자 복사`,
  copyShort: '복사',
  textLabel: (name: string) => `${name}에서 읽은 글자`,
  placeholder: {
    waiting: '글자 인식을 누르면 읽은 글자가 여기에 나옵니다.',
    working: '읽는 중…',
    empty: '이 이미지에서 글자를 찾지 못했습니다.',
    failed: '이 이미지는 읽지 못했습니다. 메모리가 모자라거나 이미지가 손상됐을 수 있습니다.',
  },
  boxesLabel: (name: string) => `${name}에서 읽은 줄의 자리`,
  /** 여러 장을 하나로 합칠 때 장마다 붙는 머리 줄 */
  fileMark: (name: string) => `--- ${name} ---`,
  /** 결과 파일 이름 (한 장이면 '원래이름_글자인식.txt') */
  suffix: '글자인식',
  allName: '이미지_글자인식.txt',
};

const en: typeof ko = {
  bar: 'OCR',
  hint: 'Choose photos, screenshots or scans, several at once · Your images never leave this device',
  broken: 'This image cannot be opened. It will be skipped.',
  tips: 'Bright, straight photos with sharp text work best. Tilted or sideways images are straightened before reading.',
  boxes: 'Show read lines',
  loading: 'Opening images…',
  needOne: 'Add an image to read.',
  ready: (count: number) => `Read the text in ${count} ${count === 1 ? 'image' : 'images'}.`,
  starting: 'Starting the recognition engine…',
  working: (done: number, total: number) => `Reading text: image ${done} of ${total}`,
  done: (count: number, characters: string) =>
    `Read ${characters} characters from ${count} ${count === 1 ? 'image' : 'images'}. You can fix the text in the boxes.`,
  someFailed: (count: number) =>
    `${count} ${count === 1 ? 'image' : 'images'} could not be read. Check the list.`,
  failed:
    'Could not read the text. Your device may be low on memory. Close other apps and try again.',
  run: 'Recognize text',
  copyAll: 'Copy all',
  downloadText: 'Download TXT',
  copied: 'Text copied.',
  copyFailed: 'Could not copy. Select the text in the box and copy it yourself.',
  itemWorking: 'Reading…',
  itemDone: (lines: number, characters: string) =>
    `${lines} ${lines === 1 ? 'line' : 'lines'} · ${characters} characters`,
  itemEmpty: 'No text found',
  itemFailed: 'This image could not be read',
  copy: (name: string) => `Copy the text from ${name}`,
  copyShort: 'Copy',
  textLabel: (name: string) => `Text read from ${name}`,
  placeholder: {
    waiting: 'Press Recognize text and the text appears here.',
    working: 'Reading…',
    empty: 'No text was found in this image.',
    failed:
      'This image could not be read. The device may be low on memory or the image may be damaged.',
  },
  boxesLabel: (name: string) => `Where the lines were read in ${name}`,
  fileMark: (name: string) => `--- ${name} ---`,
  suffix: 'ocr',
  allName: 'images_ocr.txt',
};

export const MESSAGES: Record<Locale, typeof ko> = { ko, en };
