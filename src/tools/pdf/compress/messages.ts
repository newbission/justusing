/** PDF 압축 도구 화면의 문구 (공통 문구는 src/frame/messages.ts) */
import type { Locale } from '../../../i18n/locales';
import type { CompressLevel } from '../../../lib/pdf/compress';

const ko = {
  bar: '압축',
  levelGroup: '줄이는 정도',
  levels: {
    light: { label: '조금 (화질 우선)', short: '조금' },
    balanced: { label: '보통 (추천)', short: '보통' },
    strong: { label: '많이 (용량 우선)', short: '많이' },
  } satisfies Record<CompressLevel, { label: string; short: string }>,
  levelHelp: {
    light: '사진을 거의 그대로 두고 조금만 줄입니다.',
    balanced: '화면으로 보거나 메일로 보내기에 알맞게 줄입니다.',
    strong: '사진 화질을 낮춰 가장 작게 만듭니다. 사진을 확대하면 흐릿할 수 있습니다.',
  } satisfies Record<CompressLevel, string>,
  note: '글자와 도형은 그대로 두고 PDF 안의 사진만 다시 저장합니다. 사진이 많은 PDF일수록 많이 줄어듭니다.',
  ready: (size: string) => `지금 크기 ${size}`,
  reading: '파일을 읽는 중…',
  working: (done: number, total: number) => `사진을 줄이는 중… ${done}/${total}`,
  workingShort: '줄이는 중…',
  run: '압축하기',
  done: (name: string, before: string, after: string, percent: number) =>
    `완료: ${name} · ${before} → ${after} (${percent}% 줄어듦)`,
  noGain: '더 줄일 수 없었습니다. 이미 작게 저장된 PDF이거나 줄일 사진이 없습니다.',
  failed: '압축하지 못했습니다. 파일이 손상되었거나 기기의 메모리가 부족할 수 있습니다.',
  /** 결과 파일 이름 뒤에 붙는 말 */
  suffix: '압축',
};

const en: typeof ko = {
  bar: 'Compress',
  levelGroup: 'How much to shrink',
  levels: {
    light: { label: 'Less (better quality)', short: 'Less' },
    balanced: { label: 'Balanced (recommended)', short: 'Balanced' },
    strong: { label: 'More (smaller file)', short: 'More' },
  },
  levelHelp: {
    light: 'Keeps photos almost as they are and shrinks the file a little.',
    balanced: 'Good for reading on screen or sending by email.',
    strong: 'Lowers photo quality for the smallest file. Photos may look blurry when zoomed in.',
  },
  note: 'Text and shapes stay as they are. Only the photos inside the PDF are re-saved, so PDFs with many photos shrink the most.',
  ready: (size: string) => `Current size ${size}`,
  reading: 'Reading the file…',
  working: (done: number, total: number) => `Shrinking photos… ${done}/${total}`,
  workingShort: 'Compressing…',
  run: 'Compress PDF',
  done: (name: string, before: string, after: string, percent: number) =>
    `Done: ${name} · ${before} → ${after} (${percent}% smaller)`,
  noGain: 'Could not make it smaller. The PDF may already be compact or have no photos to shrink.',
  failed: 'Could not compress. The file may be damaged, or your device may be low on memory.',
  suffix: 'compressed',
};

export const MESSAGES: Record<Locale, typeof ko> = { ko, en };
