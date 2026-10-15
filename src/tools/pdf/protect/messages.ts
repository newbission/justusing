/** PDF 암호 걸기 도구 화면의 문구 (공통 문구는 src/frame/messages.ts) */
import type { Locale } from '../../../i18n/locales';

const ko = {
  bar: '암호 걸기',
  password: '새 암호',
  confirm: '암호 확인',
  enterPassword: '걸 암호를 입력하세요.',
  mismatch: '두 암호가 서로 다릅니다.',
  ready: '열 때 이 암호를 묻는 PDF로 저장합니다.',
  note: '암호를 잊으면 이 PDF를 열 수 없고, 우리도 되찾아 드릴 수 없습니다. 암호는 어디에도 저장되지 않습니다.',
  working: '거는 중…',
  run: '암호 걸기',
  failed: '암호를 걸지 못했습니다. 파일이 손상되었을 수 있습니다.',
  /** 결과 파일 이름 뒤에 붙는 말 */
  suffix: '암호',
};

const en: typeof ko = {
  bar: 'Protect',
  password: 'New password',
  confirm: 'Confirm password',
  enterPassword: 'Enter the password to set.',
  mismatch: 'The two passwords do not match.',
  ready: 'Saves a PDF that asks for this password when opened.',
  note: 'If you forget the password, the PDF cannot be opened and we cannot recover it for you. The password is not stored anywhere.',
  working: 'Protecting…',
  run: 'Protect PDF',
  failed: 'Could not protect the PDF. The file may be damaged.',
  suffix: 'protected',
};

export const MESSAGES: Record<Locale, typeof ko> = { ko, en };
