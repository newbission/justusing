/** HEIC 변환 도구 화면의 문구 (화면은 형식 변환과 같은 ConvertTool, 공통 문구는 src/frame/messages.ts) */
import type { Locale } from '../../../i18n/locales';
import type { ConvertMessages } from '../../../lib/image/ConvertTool.svelte';

const ko: ConvertMessages = {
  hint: 'HEIC·HEIF 사진(아이폰)을 여러 장 한 번에 고를 수 있습니다 · 사진은 이 기기를 떠나지 않습니다',
  bar: 'HEIC 변환',
  formatGroup: '바꿀 형식',
  formats: {
    'image/jpeg': 'JPG',
    'image/png': 'PNG',
    'image/webp': 'WebP',
  },
  help: {
    'image/jpeg': '어디서나 열리는 형식입니다. 사진을 높은 화질로 저장합니다.',
    'image/png': '화질 손실 없이 저장합니다. 사진은 용량이 몇 배 커집니다.',
    'image/webp': 'JPG보다 작습니다. 오래된 프로그램에서는 열리지 않을 수 있습니다.',
  },
  note: '여러 장이 든 사진(라이브 포토 등)은 대표 사진 한 장만 바뀌고, 촬영 날짜·위치 같은 정보는 남지 않습니다.',
  gifNote: '움직이는 GIF는 첫 장면만 바뀝니다.',
  reading: '사진을 읽는 중입니다…',
  needOne: '바꿀 사진을 넣어 주세요.',
  ready: (count: number, format: string) => `사진 ${count}장을 ${format}로 바꿉니다.`,
  working: (done: number, total: number) => `바꾸는 중… ${done}/${total}`,
  workingShort: '바꾸는 중…',
  run: '변환하기',
  done: (count: number) => `완료: 사진 ${count}장`,
  failed: '바꾸지 못한 사진이 있습니다. 목록에서 확인하세요.',
  downloadAll: (count: number) => `모두 받기 (ZIP, ${count}장)`,
  zipName: 'HEIC_변환.zip',
  itemPlan: (size: string, from: string, to: string) => `${size} · ${from} → ${to}`,
  itemWorking: '바꾸는 중…',
  itemDone: (to: string, size: string) => `완료: ${to} · ${size}`,
  itemFailed: '바꾸지 못했습니다.',
  noWebp: '이 브라우저는 WebP로 저장하지 못합니다. 다른 형식을 고르세요.',
  unreadable: '읽지 못하는 사진입니다. HEIC가 아니거나 파일이 깨졌습니다.',
};

const en: ConvertMessages = {
  hint: 'You can pick several HEIC or HEIF photos (iPhone) at once · Your photos never leave this device',
  bar: 'HEIC to JPG',
  formatGroup: 'Convert to',
  formats: {
    'image/jpeg': 'JPG',
    'image/png': 'PNG',
    'image/webp': 'WebP',
  },
  help: {
    'image/jpeg': 'Opens everywhere. Photos are saved at high quality.',
    'image/png': 'Saved without loss. Photos become several times larger.',
    'image/webp': 'Smaller than JPG. Some older programs cannot open it.',
  },
  note: 'For a file holding several images (such as a Live Photo), only the main photo is converted. Date, location and other photo information are not kept.',
  gifNote: 'Only the first frame of an animated GIF is converted.',
  reading: 'Reading photos…',
  needOne: 'Add the photos you want to convert.',
  ready: (count: number, format: string) =>
    `Convert ${count} ${count === 1 ? 'photo' : 'photos'} to ${format}.`,
  working: (done: number, total: number) => `Converting… ${done}/${total}`,
  workingShort: 'Converting…',
  run: 'Convert photos',
  done: (count: number) => `Done: ${count} ${count === 1 ? 'photo' : 'photos'}`,
  failed: 'Some photos could not be converted. Check the list.',
  downloadAll: (count: number) => `Download all (ZIP, ${count})`,
  zipName: 'heic-converted.zip',
  itemPlan: (size: string, from: string, to: string) => `${size} · ${from} → ${to}`,
  itemWorking: 'Converting…',
  itemDone: (to: string, size: string) => `Done: ${to} · ${size}`,
  itemFailed: 'Could not convert.',
  noWebp: 'This browser cannot save WebP. Choose another format.',
  unreadable: 'Cannot read this photo. It is not HEIC or the file is damaged.',
};

export const MESSAGES: Record<Locale, ConvertMessages> = { ko, en };
