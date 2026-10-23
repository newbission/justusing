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
      'PDF·이미지·CSV 파일을 다루는 방법을 단계별로 설명합니다. 설치·업로드 없이 브라우저에서 바로 따라 할 수 있습니다.',
    published: (date: string) => `${date} 작성`,
    updated: (date: string) => `${date} 고침`,
    tryTool: '이 글의 도구',
    ctaTitle: '바로 해 보기',
    ctaText: '설치·가입 없이 브라우저에서 바로 씁니다. 파일은 이 기기를 떠나지 않습니다.',
    openTool: (name: string) => `${name} 열기`,
    more: '다른 가이드',
    forTool: '관련 가이드',
    forCategory: (name: string) => `${name} 가이드`,
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
    more: '어떻게 떼어 놓는지 네 장면으로 보기',
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
  /** /safety/의 장면 넷짜리 움직이는 그림 (SafetyMotion). 그림 속 글은 짧게, 설명은 장면 글에 */
  safetyMotion: {
    title: '그림으로 보기: 파일이 지나가는 길',
    lead: '도구 칸을 어떻게 떼어 놓는지, 파일이 어디로 들어가 어디로 나오는지 네 장면으로 보여 드립니다.',
    scenesLabel: '장면 고르기',
    step: (n: number, total: number) => `장면 ${n} / ${total}`,
    pause: '일시정지',
    play: '재생',
    replay: '처음부터 다시 보기',
    // 그림 속 이름표
    outerPage: '바깥 페이지',
    ad: '광고',
    analytics: '방문 통계',
    toolArea: '도구 칸 · 격리된 iframe',
    myFile: '내 파일',
    downloads: '다운로드 폴더',
    myDevice: '내 기기',
    thisSite: '이 사이트',
    otherSites: '다른 사이트',
    internet: '인터넷',
    noOrigin: 'allow-same-origin 없음 → 출처 없는 칸',
    onlyOurFiles: '이 사이트 파일만 받고, 다른 곳엔 연결 못 함',
    ourFilesOnly: '이 사이트 파일만',
    blocked: '연결 막힘',
    dropHere: '여기에 놓으세요',
    frameFills: '도구 칸이 화면 전체로 넓어졌어요',
    worker: '작업자 (Web Worker)',
    program: '처리 프로그램',
    noUpload: '파일 전송 없음',
    download: '다운로드',
    savedDirectly: '바로 저장',
    noInternet: '인터넷 전송 없음',
    scenes: [
      {
        name: '두 칸',
        title: '한 페이지 안의 두 칸',
        text: [
          {
            text: '도구 페이지는 두 칸으로 나뉩니다. 바깥 페이지에서는 광고와 방문 통계 스크립트가 돌고, 파일을 고르고 처리하는 도구 칸은 그 안에 끼워 넣은 따로 된 문서(iframe)입니다.',
          },
          {
            text: '바깥 스크립트가 도구 칸 안의 파일 이름이나 내용을 읽으려 해도 브라우저가 막습니다.',
          },
        ],
      },
      {
        name: '막는 법',
        title: '벽을 세우는 두 가지',
        text: [
          {
            term: 'sandbox',
            text: '도구 칸에 allow-same-origin을 주지 않아 ‘출처 없는’ 문서로 만듭니다. 브라우저는 출처가 다른 문서끼리 서로의 내용을 읽지 못하게 하므로, 바깥 페이지와 도구 칸은 서로 안을 볼 수 없습니다.',
          },
          {
            term: '보안 정책(CSP)',
            text: "도구 칸은 모든 연결을 막아 둔 상태(default-src 'none')에서 이 사이트의 파일을 받는 것만 열어 둡니다. 도구 코드 자신도 다른 주소로는 연결할 수 없습니다.",
          },
        ],
      },
      {
        name: '처리',
        title: '파일은 도구 칸 안에서만',
        text: [
          {
            text: '파일을 끌고 페이지에 들어오면 도구 칸이 잠깐 화면 전체로 넓어져, 어디에 놓든 도구 칸이 받습니다. 바깥에 떨어지더라도 페이지가 가장 먼저 가로채 다른 스크립트에 넘기지 않습니다.',
          },
          {
            text: '처리는 도구 칸 안의 작업자(Web Worker)가 이 기기에서 합니다. 이 사이트에서 받는 것은 처리 프로그램뿐이고, 파일을 받아 줄 서버 프로그램은 없습니다.',
          },
        ],
      },
      {
        name: '받기',
        title: '결과 파일은 곧장 내 기기로',
        text: [
          {
            text: '다운로드를 누르면 도구 칸 안에서 만든 결과 파일을 브라우저가 바로 내 기기에 저장합니다. 바깥 페이지나 광고를 거치지 않고, 인터넷으로도 나가지 않습니다.',
          },
          {
            text: '저장된 파일은 내 기기의 보통 파일이라 이 사이트가 다시 읽거나 지울 수 없습니다. 그 뒤의 관리는 기기의 보안에 달려 있습니다.',
          },
        ],
      },
    ],
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
      'Step-by-step guides for working with PDFs, images and CSV files. Follow along right in your browser, with nothing to install or upload.',
    published: (date: string) => `Published ${date}`,
    updated: (date: string) => `Updated ${date}`,
    tryTool: 'Tool for this guide',
    ctaTitle: 'Try it now',
    ctaText:
      'Works right in your browser, with no install or sign-up. Your files never leave this device.',
    openTool: (name: string) => `Open ${name}`,
    more: 'More guides',
    forTool: 'Guides',
    forCategory: (name: string) => `${name} guides`,
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
    more: 'See how it is sealed off, in four scenes',
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
  safetyMotion: {
    title: 'See it step by step: where your file goes',
    lead: 'Four scenes show how the tool area is sealed off, and where your file goes in and comes out.',
    scenesLabel: 'Choose a scene',
    step: (n: number, total: number) => `Scene ${n} of ${total}`,
    pause: 'Pause',
    play: 'Play',
    replay: 'Play again from the start',
    outerPage: 'Outer page',
    ad: 'Ad',
    analytics: 'Analytics',
    toolArea: 'Tool area · isolated iframe',
    myFile: 'Your file',
    downloads: 'Downloads',
    myDevice: 'Your device',
    thisSite: 'This site',
    otherSites: 'Other sites',
    internet: 'Internet',
    noOrigin: 'No allow-same-origin → an area with no origin',
    onlyOurFiles: "Only this site's files, no other connections",
    ourFilesOnly: 'This site only',
    blocked: 'Blocked',
    dropHere: 'Drop it here',
    frameFills: 'The tool area now fills the page',
    worker: 'Web Worker',
    program: 'Program files',
    noUpload: 'No upload',
    download: 'Download',
    savedDirectly: 'Saved directly',
    noInternet: 'Nothing sent',
    scenes: [
      {
        name: 'Two areas',
        title: 'Two areas on one page',
        text: [
          {
            text: 'A tool page is split in two. Ads and analytics scripts run on the outer page, while the tool area where you pick and process files is a separate document (an iframe) set inside it.',
          },
          {
            text: 'If an outer script tries to read file names or contents inside the tool area, the browser stops it.',
          },
        ],
      },
      {
        name: 'The seal',
        title: 'Two things build the wall',
        text: [
          {
            term: 'sandbox',
            text: 'The tool area is not given allow-same-origin, so it becomes a document with no origin. Browsers do not let documents from different origins read each other, so the outer page and the tool area cannot look inside each other.',
          },
          {
            term: 'Security policy (CSP)',
            text: "The tool area starts with every connection blocked (default-src 'none') and only opens the way to download this site's files. Even the tool's own code cannot connect anywhere else.",
          },
        ],
      },
      {
        name: 'Processing',
        title: 'Files stay inside the tool area',
        text: [
          {
            text: 'When you drag a file onto the page, the tool area briefly grows to fill the screen, so wherever you drop it, the tool area receives it. Even if it lands on the outer page, the page catches it first and does not pass it to other scripts.',
          },
          {
            text: 'A worker (Web Worker) inside the tool area does the processing on this device. All it gets from this site is the program; there is no server program to receive your file.',
          },
        ],
      },
      {
        name: 'Download',
        title: 'The result goes straight to your device',
        text: [
          {
            text: 'When you press Download, the browser saves the result made inside the tool area straight to your device. It does not pass through the outer page or the ads, and it is not sent over the internet.',
          },
          {
            text: 'The saved file is an ordinary file on your device, so this site cannot read or delete it again. What happens to it after that depends on the security of your device.',
          },
        ],
      },
    ],
  },
};

const UI: Record<Locale, Ui> = { ko, en };

export function ui(locale: Locale): Ui {
  return UI[locale];
}
