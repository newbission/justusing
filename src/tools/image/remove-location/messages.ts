/** 위치 정보 지우기 도구 화면의 문구 (공통 문구는 src/frame/messages.ts) */
import type { Locale } from '../../../i18n/locales';
import type { CleanMode } from '../../../lib/image/metadata';

const ko = {
  bar: '정보 지우기',
  hint: 'JPG·PNG·WebP·HEIC 사진을 여러 장 한 번에 고를 수 있습니다 · 사진은 이 기기를 떠나지 않습니다',
  modeGroup: '지울 정보',
  modes: {
    all: { label: '모든 정보 지우기 (추천)', short: '모두' },
    location: { label: '위치만 지우기', short: '위치만' },
  } satisfies Record<CleanMode, { label: string; short: string }>,
  modeHelp: {
    all: '위치, 찍은 날짜, 기기, 편집 프로그램 기록을 모두 지웁니다. 사진이 눕지 않게 방향 정보만 남깁니다.',
    location: '위치만 지우고 찍은 날짜·기기는 남깁니다. 사진 앱에서 날짜순 정리가 그대로 됩니다.',
  } satisfies Record<CleanMode, string>,
  note: '사진을 다시 저장하지 않고 정보만 떼어 내므로 화질이 그대로입니다.',
  appended: (count: number) =>
    `사진 ${count}장에 HDR 밝기 정보나 움직이는 사진의 영상이 붙어 있습니다. 여기에도 촬영 정보가 있을 수 있어 함께 빼므로, HDR 사진은 일반 사진으로, 움직이는 사진은 멈춘 사진으로 저장됩니다.`,
  reading: '사진 정보를 읽는 중입니다…',
  needOne: '정보를 지울 사진을 넣어 주세요.',
  ready: (count: number, located: number) =>
    located > 0 ? `사진 ${count}장 중 ${located}장에 위치가 있습니다.` : `사진 ${count}장`,
  working: '지우는 중…',
  run: '정보 지우기',
  done: (count: number) => `완료: 사진 ${count}장에서 지웠습니다.`,
  nothing: '지울 정보가 없었습니다. 원본을 그대로 써도 됩니다.',
  failed: '정보를 지우지 못한 사진이 있습니다. 목록에서 확인하세요.',
  downloadAll: (count: number) => `모두 받기 (ZIP, ${count}장)`,
  zipName: '사진_정보삭제.zip',
  /** 목록 줄: 지우기 전 */
  infoReading: '정보 읽는 중…',
  located: (latitude: string, longitude: string) => `위치 ${latitude}, ${longitude}`,
  locatedUnknown: '위치 있음',
  noLocation: '위치 없음',
  /** 목록 줄: 지운 뒤 */
  itemWorking: '지우는 중…',
  itemDone: {
    all: (before: string, after: string) => `정보를 모두 지웠습니다 · ${before} → ${after}`,
    location: (before: string, after: string) => `위치를 지웠습니다 · ${before} → ${after}`,
  } satisfies Record<CleanMode, (before: string, after: string) => string>,
  itemKept: '지울 정보가 없어 원본 그대로',
  itemFailed: '이 사진은 지우지 못했습니다',
  broken: '열 수 없는 사진입니다. 빼고 처리합니다.',
  /** 결과 파일 이름 뒤에 붙는 말 */
  suffix: { all: '정보삭제', location: '위치삭제' } satisfies Record<CleanMode, string>,
};

const en: typeof ko = {
  bar: 'Remove info',
  hint: 'You can pick several JPG, PNG, WebP or HEIC photos at once · Your photos never leave this device',
  modeGroup: 'What to remove',
  modes: {
    all: { label: 'Remove all info (recommended)', short: 'All' },
    location: { label: 'Location only', short: 'Location' },
  },
  modeHelp: {
    all: 'Removes the location, date taken, device and editing history. Only the orientation is kept so photos stay upright.',
    location:
      'Removes only the location and keeps the date taken and device, so photo apps still sort by date.',
  },
  note: 'Only the info is taken out and the photo is not saved again, so the quality stays the same.',
  appended: (count: number) =>
    `${count} ${count === 1 ? 'photo has' : 'photos have'} HDR brightness data or a motion photo video attached. These can hold shooting data too, so they are removed: HDR photos are saved as regular photos and motion photos as still photos.`,
  reading: 'Reading photo info…',
  needOne: 'Add the photos you want to clean.',
  ready: (count: number, located: number) =>
    located > 0
      ? `${located} of ${count} ${count === 1 ? 'photo has' : 'photos have'} a location.`
      : `${count} ${count === 1 ? 'photo' : 'photos'}`,
  working: 'Removing…',
  run: 'Remove info',
  done: (count: number) => `Done: cleaned ${count} ${count === 1 ? 'photo' : 'photos'}.`,
  nothing: 'There was nothing to remove. You can use the originals as they are.',
  failed: 'Some photos could not be cleaned. Check the list.',
  downloadAll: (count: number) => `Download all (ZIP, ${count})`,
  zipName: 'cleaned-photos.zip',
  infoReading: 'Reading info…',
  located: (latitude: string, longitude: string) => `Location ${latitude}, ${longitude}`,
  locatedUnknown: 'Has location',
  noLocation: 'No location',
  itemWorking: 'Removing…',
  itemDone: {
    all: (before: string, after: string) => `All info removed · ${before} → ${after}`,
    location: (before: string, after: string) => `Location removed · ${before} → ${after}`,
  },
  itemKept: 'Nothing to remove, kept as is',
  itemFailed: 'Could not clean this photo',
  broken: 'This photo cannot be opened. It will be left out.',
  suffix: { all: 'clean', location: 'no-location' },
};

export const MESSAGES: Record<Locale, typeof ko> = { ko, en };
