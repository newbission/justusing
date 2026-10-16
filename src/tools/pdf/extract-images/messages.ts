/** PDF 사진 꺼내기 도구 화면의 문구 (공통 문구는 src/frame/messages.ts) */
import type { Locale } from '../../../i18n/locales';

const ko = {
  bar: '사진 꺼내기',
  skipSmall: '아주 작은 그림 빼기 (가로·세로 50화소 미만: 아이콘·선 등)',
  reading: (done: number, total: number) => `사진 꺼내는 중 ${done}/${total}`,
  scanning: 'PDF 안의 사진을 찾는 중…',
  found: (count: number, size: string) => `사진 ${count}개 · ${size}`,
  none: '꺼낼 사진이 없습니다.',
  failedNote: (count: number) =>
    `${count}개는 흑백 팩스·CMYK 같은 특수한 형식이라 꺼내지 못했습니다. 쪽 전체를 그림으로 받으려면 "PDF를 이미지로"를 쓰세요.`,
  downloadAll: '모두 받기 (ZIP)',
  download: '받기',
  jp2: 'JPEG 2000 (브라우저에서 미리 볼 수 없음)',
  caption: (page: number, width: number, height: number, ext: string, size: string) =>
    `${page}쪽 · ${width}×${height} · ${ext} · ${size}`,
  imageLabel: (n: number) => `사진 ${n}`,
  failed: 'PDF를 읽지 못했습니다. 파일이 손상되었을 수 있습니다.',
};

const en: typeof ko = {
  bar: 'Extract images',
  skipSmall: 'Skip tiny images (under 50 pixels wide or high: icons, lines and so on)',
  reading: (done: number, total: number) => `Extracting images ${done}/${total}`,
  scanning: 'Looking for images in the PDF…',
  found: (count: number, size: string) => `${count} ${count === 1 ? 'image' : 'images'} · ${size}`,
  none: 'There are no images to extract.',
  failedNote: (count: number) =>
    `${count} ${count === 1 ? 'image is' : 'images are'} in a special format, such as black-and-white fax or CMYK, and could not be extracted. To save whole pages as images, use "PDF to Image".`,
  downloadAll: 'Download all (ZIP)',
  download: 'Download',
  jp2: 'JPEG 2000 (no preview in the browser)',
  caption: (page: number, width: number, height: number, ext: string, size: string) =>
    `Page ${page} · ${width}×${height} · ${ext} · ${size}`,
  imageLabel: (n: number) => `Image ${n}`,
  failed: 'Could not read the PDF. The file may be damaged.',
};

export const MESSAGES: Record<Locale, typeof ko> = { ko, en };
