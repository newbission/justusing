/**
 * '다음 도구로' 메뉴 문구 (src/frame/SendMenu.svelte). 메뉴와 함께 받으려고 frame 공통 문구(messages.ts)와 나눴다
 * (도구 첫 화면에 실리지 않게).
 */
import type { Locale } from '../i18n/locales';

export const CHAIN_MESSAGES: Record<
  Locale,
  {
    button: string;
    sending: string;
    title: string;
    note: string;
    singleOnly: string;
    failed: string;
    /** 넘긴 뒤 화면 읽기가 읽는 글 */
    moved: (name: string, count: number) => string;
  }
> = {
  ko: {
    button: '다음 도구로',
    sending: '넘기는 중…',
    title: '결과를 바로 넘길 도구',
    note: '파일은 이 도구 칸 안에서만 넘어갑니다.',
    singleOnly: '한 장일 때만',
    failed: '넘기지 못했습니다. 다시 해 보세요.',
    moved: (name, count) => `${name} 화면으로 파일 ${count}개를 넘겼습니다.`,
  },
  en: {
    button: 'Send to…',
    sending: 'Sending…',
    title: 'Send the result straight to',
    note: 'Files move only inside this tool area.',
    singleOnly: 'One image only',
    failed: "Couldn't send. Please try again.",
    moved: (name, count) => `Sent ${count === 1 ? '1 file' : `${count} files`} to ${name}.`,
  },
};
