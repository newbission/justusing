/**
 * '예시 파일로 해 보기'의 견본 파일. 내 파일이 없어도 도구를 바로 써 볼 수 있게 한다.
 *
 * 파일은 scripts/samples/make_samples.py가 만들어 public/samples/<언어>/에 둔다 (내용은 모두 지어낸 것).
 * frame이 우리 사이트에서 바로 받는다 (CORS는 public/_headers). 사용자 파일은 오가지 않는다.
 */
import type { Locale } from '../i18n/locales';
import { withoutLocale } from '../i18n/locales';
import { frameLocale } from './locale';

type SampleKey =
  | 'report'
  | 'appendix'
  | 'locked'
  | 'photos'
  | 'scan'
  | 'form'
  | 'docPhoto1'
  | 'docPhoto2'
  | 'photo'
  | 'face'
  | 'located'
  | 'tilted'
  | 'car'
  /** 탁자 위 머그잔 (배경 지우기) */
  | 'product'
  | 'screen'
  | 'chat1'
  | 'chat2'
  | 'chat3'
  /** 엑셀이 기본으로 읽지 않는 예전 인코딩의 CSV (한국어 CP949, 영어 Windows-1252) */
  | 'legacyCsv'
  /** BOM 없는 UTF-8 CSV (엑셀에서 깨짐) */
  | 'utf8Csv'
  | 'heic1'
  | 'heic2'
  /** 직접 그린 짧은 동영상 (공이 튀어 오름, 동영상을 GIF로·장면 캡처) */
  | 'ballClip'
  /** 해 지는 바다를 지나는 돛단배 동영상 (그림·소리 모두 직접 만든 것, make_sea_video.py) */
  | 'seaClip';

/** 언어별 파일 이름 (make_samples.py의 TEXT와 같게) */
const NAMES: Record<Locale, Record<SampleKey, string>> = {
  ko: {
    report: '예시-보고서.pdf',
    appendix: '예시-부록.pdf',
    locked: '예시-암호0000.pdf',
    photos: '예시-사진모음.pdf',
    scan: '예시-스캔본.pdf',
    form: '예시-신청서.pdf',
    docPhoto1: '예시-서류사진1.jpg',
    docPhoto2: '예시-서류사진2.jpg',
    photo: '예시-사진.jpg',
    face: '예시-증명사진.jpg',
    located: '예시-위치사진.jpg',
    tilted: '예시-기운사진.jpg',
    car: '예시-번호판사진.jpg',
    product: '예시-상품사진.jpg',
    screen: '예시-화면캡처.png',
    chat1: '예시-대화캡처1.png',
    chat2: '예시-대화캡처2.png',
    chat3: '예시-대화캡처3.png',
    legacyCsv: '예시-은행거래내역-CP949.csv',
    utf8Csv: '예시-주문목록-UTF8.csv',
    heic1: '예시-아이폰사진1.heic',
    heic2: '예시-아이폰사진2.heic',
    ballClip: '예시-공튀기기.mp4',
    seaClip: '예시-바다영상.mp4',
  },
  en: {
    report: 'sample-report.pdf',
    appendix: 'sample-appendix.pdf',
    locked: 'sample-password-0000.pdf',
    photos: 'sample-photos.pdf',
    scan: 'sample-scan.pdf',
    form: 'sample-form.pdf',
    docPhoto1: 'sample-document-photo-1.jpg',
    docPhoto2: 'sample-document-photo-2.jpg',
    photo: 'sample-photo.jpg',
    face: 'sample-id-photo.jpg',
    located: 'sample-photo-with-location.jpg',
    tilted: 'sample-tilted-photo.jpg',
    car: 'sample-license-plate.jpg',
    product: 'sample-product-photo.jpg',
    screen: 'sample-screenshot.png',
    chat1: 'sample-chat-1.png',
    chat2: 'sample-chat-2.png',
    chat3: 'sample-chat-3.png',
    legacyCsv: 'sample-contacts-windows-1252.csv',
    utf8Csv: 'sample-orders-utf8.csv',
    heic1: 'sample-iphone-photo-1.heic',
    heic2: 'sample-iphone-photo-2.heic',
    ballClip: 'sample-bouncing-ball.mp4',
    seaClip: 'sample-sea-video.mp4',
  },
};

/** 도구마다 넣을 견본. 없는 도구는 버튼을 그리지 않는다 */
const BY_TOOL: Record<string, SampleKey[]> = {
  'pdf/view': ['report'],
  'pdf/extract-text': ['report'],
  'pdf/extract-images': ['photos'],
  'pdf/merge': ['report', 'appendix'],
  'pdf/split': ['report'],
  'pdf/rotate': ['report'],
  'pdf/organize': ['report'],
  'pdf/n-up': ['report'],
  'pdf/crop': ['report'],
  'pdf/to-image': ['report'],
  'pdf/from-image': ['docPhoto1', 'docPhoto2'],
  'pdf/ocr': ['scan'],
  'pdf/compress': ['photos'],
  'pdf/page-numbers': ['report'],
  'pdf/watermark': ['report'],
  'pdf/header-footer': ['report'],
  'pdf/add-image': ['report'],
  'pdf/sign': ['report'],
  'pdf/unlock': ['locked'],
  'pdf/protect': ['report'],
  'pdf/metadata': ['report'],
  'pdf/redact': ['report'],
  'pdf/edit': ['report'],
  'pdf/fill-form': ['form'],
  'image/compress': ['photo', 'screen'],
  'image/resize': ['photo', 'screen'],
  'image/target-size': ['photo', 'screen'],
  'image/convert': ['photo', 'screen'],
  'image/heic-to-jpg': ['heic1', 'heic2'],
  'image/ocr': ['docPhoto2', 'chat1'],
  'image/id-photo': ['face'],
  'image/remove-bg': ['product'],
  'image/remove-location': ['located', 'screen'],
  'image/stitch': ['chat1', 'chat2', 'chat3'],
  'image/crop': ['tilted'],
  'image/mosaic': ['car'],
  'text/csv-encoding': ['utf8Csv', 'legacyCsv'],
  'video/to-gif': ['ballClip'],
  'video/frame-capture': ['ballClip'],
  'video/trim': ['seaClip'],
  'video/compress': ['seaClip'],
  'video/extract-audio': ['seaClip'],
};

const TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  png: 'image/png',
  csv: 'text/csv',
  heic: 'image/heic',
  mp4: 'video/mp4',
};

/** 도구에 견본이 있는지 (바깥 페이지가 빌드 때 '따라 하기' 버튼을 그릴지 정한다) */
export function toolHasSamples(id: string): boolean {
  return BY_TOOL[id] !== undefined;
}

/** 이 frame의 도구 ID (주소 /<카테고리>/<이름>/frame/에서 읽는다) */
function toolId(): string | undefined {
  if (typeof location === 'undefined') return undefined;
  const [category, name] = withoutLocale(location.pathname).split('/').filter(Boolean);
  return category && name ? `${category}/${name}` : undefined;
}

/** 이 도구에 견본이 있는지 */
export const hasSamples = BY_TOOL[toolId() ?? ''] !== undefined;

/** 이 도구의 견본 파일 이름 (지금 언어) */
export function sampleNames(): string[] {
  return (BY_TOOL[toolId() ?? ''] ?? []).map((key) => NAMES[frameLocale][key]);
}

/** 이 도구의 견본을 받아 File로 돌려준다 */
export async function loadSamples(): Promise<File[]> {
  const keys = BY_TOOL[toolId() ?? ''] ?? [];
  return Promise.all(
    keys.map(async (key) => {
      const name = NAMES[frameLocale][key];
      const response = await fetch(`/samples/${frameLocale}/${encodeURIComponent(name)}`);
      if (!response.ok) throw new Error(`견본을 받지 못했습니다: ${response.status}`);
      const type = TYPES[name.split('.').pop()!] ?? '';
      return new File([await response.blob()], name, { type });
    }),
  );
}
