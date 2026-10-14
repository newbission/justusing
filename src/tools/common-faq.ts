/**
 * 모든 도구 페이지 FAQ 맨 앞에 붙는 공통 질문.
 * 사이트의 핵심 약속(파일이 기기를 떠나지 않음)에 관한 것이라 도구마다 복사하지 않고 여기 한 곳에 둔다.
 * 답은 실제 구현과 어긋나지 않게 쓴다 (도구 격리: src/components/ToolFrame.astro, src/frame/FrameLayout.astro).
 */
import type { Locale } from '../i18n/locales';
import type { ToolContentText } from './types';

export const COMMON_FAQ: Record<Locale, ToolContentText['faq']> = {
  ko: [
    {
      q: '파일이 서버로 올라가나요?',
      a: '아니요. 파일은 브라우저 안에서만 처리되고 어떤 서버로도 전송되지 않습니다. 처리에 필요한 프로그램과 글자 정보만 이 사이트에서 내려받을 뿐, 파일 내용은 밖으로 나가지 않습니다. 브라우저 개발자 도구의 네트워크 탭에서 직접 확인할 수 있습니다.',
    },
    {
      q: '광고가 있어도 내 파일은 안전한가요?',
      a: '네. 광고는 도구 화면 바깥에서만 동작합니다. 파일을 고르고 처리하는 도구 화면은 브라우저가 따로 떼어 놓은 격리 공간이라, 광고를 포함한 페이지의 다른 스크립트는 파일 내용이나 파일 이름을 읽을 수 없습니다. 도구 화면 안에서는 외부로 아무것도 보낼 수 없도록 막혀 있습니다. 파일을 페이지로 끌어오면 도구 화면이 화면 전체로 넓어져 격리된 공간에서 파일을 받습니다.',
    },
  ],
  en: [
    {
      q: 'Are my files uploaded to a server?',
      a: "No. Files are processed only inside your browser and are never sent to any server. Only the programs and character data needed for processing are downloaded from this site; your file content never leaves. You can check this yourself in the Network tab of your browser's developer tools.",
    },
    {
      q: 'Are my files safe even with ads on the page?',
      a: 'Yes. Ads only run outside the tool area. The tool area, where you choose and process files, is an isolated space your browser keeps separate, so other scripts on the page, including ads, cannot read your file content or file names. Nothing inside the tool area can be sent out. When you drag a file onto the page, the tool area expands to fill the screen so the isolated space receives the file.',
    },
  ],
};
