/**
 * 바깥 페이지(머리글·바닥글·도구 페이지 틀·안내 창 등)의 화면 문구. 언어마다 같은 모양으로 둔다.
 * 도구 화면(격리 frame) 안의 문구는 각 도구 폴더와 src/frame/messages.ts에 따로 있다.
 *
 * 쓰는 법: const t = ui(localeOf(Astro.url.pathname));  t.footer.about
 */
import type { Locale } from './locales';

const ko = {
  nav: {
    categories: '도구 분류',
    home: '홈',
    breadcrumb: '현재 위치',
    switchTool: '다른 도구로 이동',
    soon: '준비 중',
    language: '언어',
    guides: '가이드',
    allTools: (name: string) => `${name} 도구 전체 보기`,
    allGuides: '가이드 전체 보기',
    menu: '메뉴',
    openMenu: '메뉴 열기',
    closeMenu: '메뉴 닫기',
  },
  theme: {
    toggle: '테마 전환',
    toLight: '라이트 모드로 전환',
    toDark: '다크 모드로 전환',
  },
  footer: {
    localNote: '모든 파일은 브라우저 안에서만 처리되며 서버로 업로드되지 않습니다.',
    siteInfo: '사이트 정보',
    about: '소개',
    safety: '파일이 안전한 이유',
    privacy: '개인정보처리방침',
    terms: '이용약관',
    contact: '문의',
  },
  tool: {
    localNote:
      '파일은 이 기기를 떠나지 않습니다. 모든 처리는 브라우저 안에서 이루어지며 서버로 업로드되지 않습니다.',
    uses: (name: string) => `${name}, 이럴 때 쓰세요`,
    howTo: (name: string) => `${name} 사용법`,
    faq: '자주 묻는 질문',
    related: '관련 도구',
    frameTitle: (name: string) => `${name} 도구 화면`,
    noscript: '이 도구는 JavaScript가 켜져 있어야 동작합니다.',
    browserRequirements: 'JavaScript가 켜진 최신 브라우저',
    priceCurrency: 'KRW',
  },
  guide: {
    indexTitle: '가이드',
    indexDescription:
      'PDF와 이미지를 다루는 방법을 단계별로 설명합니다. 설치·업로드 없이 브라우저에서 바로 따라 할 수 있습니다.',
    published: (date: string) => `${date} 작성`,
    updated: (date: string) => `${date} 고침`,
    tryTool: '이 글의 도구',
    ctaTitle: '바로 해 보기',
    ctaText: '설치·가입 없이 브라우저에서 바로 씁니다. 파일은 이 기기를 떠나지 않습니다.',
    openTool: (name: string) => `${name} 열기`,
    more: '다른 가이드',
    forTool: '관련 가이드',
    openDialog: '가이드 보기',
    closeDialog: '닫기',
    loading: '가이드를 불러오는 중…',
    loadFailed: '가이드를 불러오지 못했습니다. 다시 열어 보거나 아래 링크로 가 주세요.',
    readFull: '가이드 페이지에서 보기',
    tour: '예시로 따라 하기',
    tourTitle: (name: string) => `${name} 예시로 따라 하기`,
    tourFrame: (name: string) => `${name} 따라 하기 화면`,
    categoryTitle: (name: string) => `${name} 가이드`,
    categoryDescription: (name: string) =>
      `${name} 도구로 하는 일을 도구 묶음별로 나눠 설명합니다. 설치·업로드 없이 브라우저에서 바로 따라 할 수 있습니다.`,
    categoryLink: (name: string) => `${name} 가이드 묶음별로 보기`,
  },
  category: {
    title: (name: string) => `${name} 도구`,
  },
  ads: {
    label: '광고',
    collapse: '광고 접기',
    expand: '광고 펼치기',
  },
  adblock: {
    title: '광고 차단을 꺼 주세요',
    body: (site: string) =>
      `${site}은 광고 수익으로 무료로 운영됩니다. 이 사이트에서는 광고 차단 프로그램을 꺼 주세요.`,
    note: '광고는 도구 화면 바깥에만 있어서 파일 내용을 볼 수 없습니다.',
    close: '닫기',
    reload: '껐어요, 새로 고침',
  },
  promises: {
    label: '이 사이트의 약속',
    items: [
      {
        title: '업로드 없음',
        text: '파일이 서버로 가지 않고 내 기기 안에서 처리됩니다. 회사 문서나 개인 서류도 안심하고 쓰세요.',
      },
      {
        title: '설치·가입 없음',
        text: '프로그램을 깔거나 회원가입할 필요 없이, 브라우저에서 바로 시작합니다.',
      },
      {
        title: '무료',
        text: '횟수 제한 없이 무료로 씁니다. PC와 휴대폰 모두에서 같은 기능을 씁니다.',
      },
    ],
  },
  motion: {
    browser: '내 브라우저',
    myFiles: '내 파일',
    processing: '브라우저가 처리',
    saved: '내 기기에 저장',
    noTransfer: '파일 전송 없음',
    server: '서버',
    serverNote: '파일을 받지 않음',
    title: '고른 파일은 브라우저 안에서 처리됩니다',
    text: '파일을 고르면 이 기기의 브라우저가 바로 처리하고, 결과 파일도 브라우저 안에서 만들어 내 기기에 저장합니다. 그동안 파일은 서버로 가지 않습니다.',
    replay: '다시 보기',
    replayLabel: '그림 움직임 다시 보기',
  },
  safety: {
    title: '왜 안전한가요',
    others: '보통 온라인 도구',
    myDevice: '내 기기',
    upload: '업로드',
    theirServer: '남의 서버',
    fileStays: '파일이 남음',
    doneHere: '여기서 처리하고 끝',
    noTransfer: '전송 없음',
    server: '서버',
    fileNeverArrives: '파일이 오지 않음',
    localTitle: '파일이 내 기기를 떠나지 않습니다',
    localText:
      '보통 온라인 도구는 파일을 자기 서버로 올려서 처리합니다. 이 사이트는 내 브라우저 안에서 바로 처리하고, 파일을 어디로도 보내지 않습니다.',
    toolScreen: '도구 화면',
    filesOnlyHere: '내 파일은 이 안에만',
    ad: '광고',
    cannotSeeThrough: '벽 너머를 볼 수 없음',
    adsTitle: '광고는 내 파일을 볼 수 없습니다',
    adsText:
      '파일을 다루는 도구 화면은 브라우저가 따로 떼어 놓은 잠긴 방입니다. 바깥의 광고는 방 안을 들여다볼 수 없고, 방 안에서는 이 사이트 말고 다른 곳으로 연결할 수 없습니다.',
    more: '직접 확인하는 법 보기',
  },
};

type Ui = typeof ko;

const en: Ui = {
  nav: {
    categories: 'Tool categories',
    home: 'Home',
    breadcrumb: 'Breadcrumb',
    switchTool: 'Switch to another tool',
    soon: 'Coming soon',
    language: 'Language',
    guides: 'Guides',
    allTools: (name: string) => `See all ${name} tools`,
    allGuides: 'See all guides',
    menu: 'Menu',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
  },
  theme: {
    toggle: 'Toggle theme',
    toLight: 'Switch to light mode',
    toDark: 'Switch to dark mode',
  },
  footer: {
    localNote: 'Every file is processed inside your browser and never uploaded to a server.',
    siteInfo: 'Site information',
    about: 'About',
    safety: 'Why your files are safe',
    privacy: 'Privacy Policy',
    terms: 'Terms of Use',
    contact: 'Contact',
  },
  tool: {
    localNote:
      'Your files never leave this device. Everything is processed inside your browser and nothing is uploaded to a server.',
    uses: (name: string) => `When to use ${name}`,
    howTo: (name: string) => `How to use the ${name} tool`,
    faq: 'Frequently asked questions',
    related: 'Related tools',
    frameTitle: (name: string) => `${name} tool`,
    noscript: 'This tool needs JavaScript to be turned on.',
    browserRequirements: 'A modern browser with JavaScript enabled',
    priceCurrency: 'USD',
  },
  guide: {
    indexTitle: 'Guides',
    indexDescription:
      'Step-by-step guides for working with PDFs and images. Follow along right in your browser, with nothing to install or upload.',
    published: (date: string) => `Published ${date}`,
    updated: (date: string) => `Updated ${date}`,
    tryTool: 'Tool for this guide',
    ctaTitle: 'Try it now',
    ctaText:
      'Works right in your browser, with no install or sign-up. Your files never leave this device.',
    openTool: (name: string) => `Open ${name}`,
    more: 'More guides',
    forTool: 'Guides',
    openDialog: 'Read the guide',
    closeDialog: 'Close',
    loading: 'Loading the guide…',
    loadFailed: 'Could not load the guide. Open it again or use the link below.',
    readFull: 'Open the guide page',
    tour: 'Walk through with a sample',
    tourTitle: (name: string) => `${name}: walk through with a sample`,
    tourFrame: (name: string) => `${name} walkthrough`,
    categoryTitle: (name: string) => `${name} guides`,
    categoryDescription: (name: string) =>
      `Step-by-step guides for the ${name} tools, grouped by task. Follow along right in your browser, with nothing to install or upload.`,
    categoryLink: (name: string) => `${name} guides by task`,
  },
  category: {
    title: (name: string) => `${name} tools`,
  },
  ads: {
    label: 'Advertisement',
    collapse: 'Hide ad',
    expand: 'Show ad',
  },
  adblock: {
    title: 'Please turn off your ad blocker',
    body: (site: string) =>
      `${site} is kept free by ads. Please turn off your ad blocker for this site.`,
    note: 'Ads only appear outside the tool area, so they can never see your files.',
    close: 'Close',
    reload: "I've turned it off — reload",
  },
  promises: {
    label: 'Our promises',
    items: [
      {
        title: 'No uploads',
        text: 'Your files are processed on your own device and never sent to a server. Safe for work and personal documents.',
      },
      {
        title: 'Nothing to install',
        text: 'No installation or sign-up required. Start right away in your browser.',
      },
      {
        title: 'Free',
        text: 'Free with no usage limits. The same features on your computer and your phone.',
      },
    ],
  },
  motion: {
    browser: 'Your browser',
    myFiles: 'Your files',
    processing: 'Processed in the browser',
    saved: 'Saved to your device',
    noTransfer: 'No file transfer',
    server: 'Server',
    serverNote: 'Never receives files',
    title: 'Your files are processed inside your browser',
    text: 'When you pick files, the browser on this device processes them right away, builds the result file there too, and saves it to your device. Your files are never sent to a server along the way.',
    replay: 'Replay',
    replayLabel: 'Replay the animation',
  },
  safety: {
    title: 'Why is it safe?',
    others: 'Typical online tools',
    myDevice: 'Your device',
    upload: 'Upload',
    theirServer: 'Their server',
    fileStays: 'A copy stays there',
    doneHere: 'Processed right here',
    noTransfer: 'No transfer',
    server: 'Server',
    fileNeverArrives: 'Never receives your file',
    localTitle: 'Your files never leave your device',
    localText:
      'Most online tools upload your file to their server to process it. This site processes it right in your browser and never sends it anywhere.',
    toolScreen: 'Tool area',
    filesOnlyHere: 'Your files stay in here',
    ad: 'Ad',
    cannotSeeThrough: 'Cannot see through the wall',
    adsTitle: 'Ads cannot see your files',
    adsText:
      'The tool area that handles your files is a locked room that your browser keeps separate. Ads outside cannot look in, and the room cannot connect anywhere other than this site.',
    more: 'See how to check it yourself',
  },
};

const UI: Record<Locale, Ui> = { ko, en };

export function ui(locale: Locale): Ui {
  return UI[locale];
}
