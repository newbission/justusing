/** PDF 암호 해제 도구 화면의 문구 (공통 문구는 src/frame/messages.ts) */
import type { Locale } from '../../../i18n/locales';

const ko = {
  bar: '암호 해제',
  checking: '암호가 걸려 있는지 확인하는 중…',
  locked: '암호를 풀었습니다. 암호 없는 PDF로 저장합니다.',
  restricted: '인쇄·복사 같은 제한이 걸린 PDF입니다. 제한 없는 PDF로 저장합니다.',
  plain: '이 PDF에는 암호나 제한이 없습니다.',
  working: '푸는 중…',
  run: '암호 해제',
  failed: '암호를 풀지 못했습니다. 파일이 손상되었거나 지원하지 않는 암호 방식일 수 있습니다.',
  /** 결과 파일 이름 뒤에 붙는 말 */
  suffix: '암호해제',
  note: '암호를 아는 PDF만 풀 수 있습니다. 내 파일이거나 다룰 권리가 있는 파일에만 쓰세요.',
};

const en: typeof ko = {
  bar: 'Unlock',
  checking: 'Checking whether the PDF is protected…',
  locked: 'The password worked. Saves a copy without a password.',
  restricted:
    'This PDF has restrictions such as no printing or copying. Saves a copy without them.',
  plain: 'This PDF has no password or restrictions.',
  working: 'Unlocking…',
  run: 'Unlock PDF',
  failed: 'Could not unlock. The file may be damaged or use an unsupported encryption method.',
  suffix: 'unlocked',
  note: 'You can only unlock a PDF if you know its password. Only use this on files you own or have the right to handle.',
};

export const MESSAGES: Record<Locale, typeof ko> = { ko, en };
