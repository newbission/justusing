/** 이미지 형식 변환 도구 화면의 문구 (공통 문구는 src/frame/messages.ts) */
import type { Locale } from '../../../i18n/locales';
import type { ConvertMessages } from '../../../lib/image/ConvertTool.svelte';

const ko: ConvertMessages = {
  hint: 'JPG·PNG·WebP·HEIC·GIF·BMP·AVIF 등 여러 장을 한 번에 고를 수 있습니다 · 파일은 이 기기를 떠나지 않습니다',
  bar: '형식 변환',
  formatGroup: '바꿀 형식',
  formats: {
    'image/jpeg': 'JPG',
    'image/png': 'PNG',
    'image/webp': 'WebP',
  },
  help: {
    'image/jpeg':
      '가장 널리 열리는 형식입니다. 투명한 부분은 흰색이 되고, 사진은 높은 화질로 저장합니다.',
    'image/png': '화질 손실 없이 저장하고 투명한 부분도 남깁니다. 사진은 용량이 커질 수 있습니다.',
    'image/webp': 'JPG보다 작고 투명도 지원합니다. 오래된 프로그램에서는 열리지 않을 수 있습니다.',
  },
  gifNote: '움직이는 GIF는 첫 장면만 바뀝니다.',
  reading: '이미지를 읽는 중입니다…',
  needOne: '바꿀 이미지를 넣어 주세요.',
  ready: (count: number, format: string) => `이미지 ${count}장을 ${format}로 바꿉니다.`,
  working: (done: number, total: number) => `바꾸는 중… ${done}/${total}`,
  workingShort: '바꾸는 중…',
  run: '변환하기',
  done: (count: number) => `완료: 이미지 ${count}장`,
  failed: '바꾸지 못한 이미지가 있습니다. 목록에서 확인하세요.',
  downloadAll: (count: number) => `모두 받기 (ZIP, ${count}장)`,
  zipName: '이미지_변환.zip',
  itemPlan: (size: string, from: string, to: string) => `${size} · ${from} → ${to}`,
  itemWorking: '바꾸는 중…',
  itemDone: (to: string, size: string) => `완료: ${to} · ${size}`,
  itemFailed: '바꾸지 못했습니다.',
  noWebp: '이 브라우저는 WebP로 저장하지 못합니다. 다른 형식을 고르세요.',
  unreadable: '읽지 못하는 이미지입니다. 지원하지 않는 형식이거나 파일이 깨졌습니다.',
};

const en: ConvertMessages = {
  hint: 'You can pick several JPG, PNG, WebP, HEIC, GIF, BMP, AVIF or other images at once · Your files never leave this device',
  bar: 'Convert',
  formatGroup: 'Convert to',
  formats: {
    'image/jpeg': 'JPG',
    'image/png': 'PNG',
    'image/webp': 'WebP',
  },
  help: {
    'image/jpeg':
      'The most widely supported format. Transparent areas become white, and photos are saved at high quality.',
    'image/png':
      'Saved without loss, and transparent areas stay transparent. Photos may become larger.',
    'image/webp': 'Smaller than JPG and supports transparency. Some older programs cannot open it.',
  },
  gifNote: 'Only the first frame of an animated GIF is converted.',
  reading: 'Reading images…',
  needOne: 'Add the images you want to convert.',
  ready: (count: number, format: string) =>
    `Convert ${count} ${count === 1 ? 'image' : 'images'} to ${format}.`,
  working: (done: number, total: number) => `Converting… ${done}/${total}`,
  workingShort: 'Converting…',
  run: 'Convert images',
  done: (count: number) => `Done: ${count} ${count === 1 ? 'image' : 'images'}`,
  failed: 'Some images could not be converted. Check the list.',
  downloadAll: (count: number) => `Download all (ZIP, ${count})`,
  zipName: 'converted-images.zip',
  itemPlan: (size: string, from: string, to: string) => `${size} · ${from} → ${to}`,
  itemWorking: 'Converting…',
  itemDone: (to: string, size: string) => `Done: ${to} · ${size}`,
  itemFailed: 'Could not convert.',
  noWebp: 'This browser cannot save WebP. Choose another format.',
  unreadable: 'Cannot read this image. The format is not supported or the file is damaged.',
};

export const MESSAGES: Record<Locale, ConvertMessages> = { ko, en };
