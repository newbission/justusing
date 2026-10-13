# justusing

PDF·이미지 같은 파일을 **브라우저 안에서만** 처리하는 무료 도구 사이트.
지금은 PDF 도구부터 만들고, 이미지 변환·배경 제거 등으로 계속 늘려 간다.

핵심 약속: **파일이 사용자의 기기를 떠나지 않는다.** 서버·업로드·DB가 없다.

## 기술 스택

- Astro (정적 빌드) + Svelte 5 (도구 화면의 움직이는 부분만) + TypeScript strict
- npm, Node 24 LTS (CI 기준)
- Cloudflare 배포 (Workers 정적 배포, `wrangler.jsonc`), 도메인 DNS도 Cloudflare

## 명령어

```sh
npm run dev           # 개발 서버 (http://localhost:4321)
npm run build         # dist/ 에 정적 사이트 생성
npm run preview       # 빌드 결과 미리보기 (http://localhost:4322, Cloudflare와 같은 방식: 격리·CSP·_headers)
npm run build:ad-preview  # 광고 자리 점선 칸을 넣어 빌드 (위치 확인용, 배포에 쓰지 않음)
npm run check         # 타입 검사 (astro check + svelte-check)
npm run format        # 포맷 정리
npm run format:check  # 포맷 검사 (CI에서 실행)
npm run test:e2e      # 빌드 결과로 E2E (먼저 npm run build). 로컬 크롬: PLAYWRIGHT_CHANNEL=chrome
python3 tests/fixtures/make_fixtures.py  # 테스트용 PDF 다시 만들기
```

개발 서버에서 `/_dev/layout/` 주소로 도구 페이지 틀과 광고 슬롯 위치를 볼 수 있다 (배포에는 없음).

**개발 서버는 도구 격리와 CSP가 꺼져 있다.** 도구를 만들면 반드시 `npm run build` 후
`npm run preview` 또는 `npm run test:e2e`로 실제 배포 상태에서 확인한다.
(예: 격리 frame에서 form 제출이 막히는 문제는 개발 서버에서 보이지 않았다.)
미리보기와 E2E는 `wrangler dev`로 띄운다. `astro preview`는 CORS 헤더를 저절로 붙여서,
격리 frame이 우리 파일을 못 받는 문제(배포에서만 생김)를 가린다. 응답 헤더는 `public/_headers`에 둔다.

## 반드시 지킬 원칙

### 로컬 처리

- 파일 처리는 전부 클라이언트에서 한다. **파일 내용·파일 이름이 네트워크 요청에 실리는 코드는 금지.**
- 무거운 처리는 Web Worker에서 돌린다. UI가 멈추면 안 된다.
- 라이브러리·워커·폰트는 직접 호스팅한다. CDN에서 불러오지 않는다.
- 도구별 라이브러리(pdf.js, pdf-lib 등)는 그 도구 페이지에서만 불러온다. 첫 페이지는 가벼워야 한다.
- 다운로드는 Blob URL + `<a download>`로만 한다.
- 파일 이름·내용을 URL, 페이지 제목, 통계 이벤트에 넣지 않는다.

### 도구 영역 격리

광고·통계 같은 외부 스크립트는 같은 페이지에서 실행되므로 화면의 PDF 글자·파일 이름을 읽을 수 있다.
그래서 **도구 영역(파일 선택·미리보기·처리·다운로드)은 격리된 iframe 안에서만 동작**한다.

- 바깥 페이지 `/pdf/view/`가 `ToolFrame`으로 `/pdf/view/frame/`을
  `sandbox="allow-scripts allow-downloads"`(allow-same-origin 없음) iframe으로 띄운다.
  frame은 출처가 `null`이 되어 바깥 스크립트와 서로 접근할 수 없다.
- frame 문서(`src/frame/FrameLayout.astro`)의 CSP: `default-src 'none'`, `connect-src 'self'`
  (우리 사이트 파일만 읽기), `worker-src blob:` 등. 외부 연결은 도구 코드 자신도 불가.
- 광고·통계 스크립트는 바깥 페이지에만 둔다. 광고는 처리 중에도 계속 보인다.
- frame 높이는 고정(`ToolFrame`), 안에서 스크롤한다. 처리 전후로 바깥 레이아웃이 밀리지 않는다.
- 모든 페이지에 Astro CSP(`security.csp`)가 켜져 있다. 광고를 붙일 때 바깥 페이지 CSP에 광고 업체를 추가한다.
- 파일 놓기: 바깥 페이지에서 파일 끌기가 시작되면 도구 iframe이 화면 전체로 넓어져
  어디에 놓든 격리 frame이 받는다 (`ToolFrame`). 그래도 바깥에 놓이면 `DropGuard`가
  `<head>` 맨 앞에서 가장 먼저 가로채 다른 스크립트(광고 등)에 전달되지 않게 막는다.

**격리 frame 안에서 지킬 것** (어기면 배포 환경에서만 깨진다):

- 워커는 `src/lib/worker.ts`의 `createWorker(url)`로만 띄운다 (`import url from './x.worker.ts?worker&url'`).
  일반 `new Worker()`는 막히고, 워커는 IIFE로 번들된다 (`astro.config.mjs`).
- `<form>` 제출을 쓰지 않는다 (sandbox에 allow-forms 없음). 버튼 클릭·Enter 키로 직접 처리한다.
- HTML `style="..."` 속성을 쓰지 않는다 (CSP가 막음). CSS 클래스나 Svelte `style:` 지시자를 쓴다.
- `localStorage`를 쓸 수 없다. 테마는 바깥 페이지가 주소(`#theme=`)와 `postMessage`로 알려 준다.
- `scrollIntoView`는 바깥 페이지까지 스크롤하므로 스크롤 영역의 `scrollTop`을 직접 바꾼다.
- 파일 끌어다 놓기는 도구가 직접 처리하지 않는다. frame 전체가 받아서(`src/frame/drop.ts`)
  도구는 `onFrameFiles(files => ...)`로 받기만 한다. 첫 화면 버튼은 `FileDrop`.
- 외부 리소스가 필요하면 우리 사이트에 복사해 둔다 (예: pdf.js CMap → `public/vendor/pdfjs/`,
  `scripts/copy-pdfjs-assets.mjs`가 dev/build 전에 복사).

### 설정은 한 곳에

- 사이트명·도메인·설명·광고 설정은 `src/site.config.ts`에만 둔다. 코드·문서에 하드코딩하지 않는다.
- 도메인 연결은 코드가 아니라 Cloudflare 대시보드에서 한다 (아래 "배포 수동 설정").

### 주소 구조

- 서브도메인이 아니라 경로로 나눈다: `/`(허브), `/pdf/`(목록), `/pdf/merge/`(도구).
- 주소는 항상 끝 슬래시로 끝난다 (`trailingSlash: 'always'`).
- 기본 언어는 한국어. 영어는 나중에 `/en/...`로 추가한다.

### 도구 레지스트리

새 도구 추가 방법:

1. `src/tools/<카테고리>/<이름>/` 폴더를 만든다.
   - `meta.ts`: `defineTool({ status, text: { ko: { name, title, description } }, related })`
   - `content.ts`: `defineContent({ ko: { howTo: [...], faq: [{ q, a }] } })` — live 도구는 필수
     (업로드 여부·광고 안전성 같은 모든 도구 공통 질문은 `src/tools/common-faq.ts`에 있고 자동으로 붙는다)
   - `Frame.astro`: 격리 frame 페이지. `FrameLayout` 안에 `App.svelte`를 `mount`한다 (`pdf/view` 참고)
   - `App.svelte`: 실제 도구 UI. 첫 화면은 `src/frame/FileDrop.svelte`를 쓴다
2. `src/tools/registry.ts`의 `TOOL_IDS`에 `'<카테고리>/<이름>'` 한 줄을 넣는다.
3. 다 만들면 `meta.ts`의 `status`를 `'live'`로 바꾸고 `tests/e2e/`에 E2E를 추가한다.

도구 ID와 주소는 폴더 경로에서 정해진다. 도구 페이지(`[category]/[tool].astro`)와
frame 페이지(`[category]/[tool]/frame.astro`)는 레지스트리에서 자동으로 만든다.
새 카테고리는 `src/tools/categories.ts`에 추가한다. PDF 도구는 `src/lib/pdf/pdfjs.ts`의 `openPdf()`로 열고(보기·썸네일),
결과 PDF는 `src/lib/pdf/assemble.ts`의 `assemblePdf()`로 만든다(페이지 고르기·순서·회전, 워커에서 pdf-lib).
썸네일은 `src/lib/pdf/Thumbnail.svelte`, 다운로드는 `src/frame/download.ts`, 바깥 스크롤 요청은 `src/frame/parent.ts`.
PDF 하나를 다루는 도구는 `src/lib/pdf/SinglePdfTool.svelte`(파일 고르기·암호·파일 이름 막대) 안에 화면을 그리고,
실행·다운로드 막대는 `src/frame/ActionBar.svelte`를 쓴다 (나누기·회전·정리 참고).

### 도구 페이지 구성

도구 영역 → 로컬 처리 안내 → 사용법 → FAQ → 관련 도구 (`src/layouts/ToolLayout.astro`).
검색 노출과 광고 심사를 위해 텍스트 내용이 충분해야 한다.

### 광고 슬롯 규칙

- 위치는 6개뿐: `rail-left`, `rail-right`, `top-banner`, `below-tool`, `in-content`, `mobile-anchor` (`src/ads/slots.ts`).
  크기는 `src/ads/slots.css`가 유일한 출처다.
- 광고는 사이트 모든 페이지에 있다.
  - 모든 페이지: 제목 아래 `top-banner`, 모바일 하단 `mobile-anchor`(`BaseLayout`), 넓은 화면 양옆(`RailShell`)
  - 도구 페이지: + `below-tool` + `in-content`. `top-banner`와 도구 칸 사이는 32px 띄운다.
  - 홈·카테고리 페이지: + 도구 목록 아래 `in-content`
  - 휴대폰에서 버튼이 하단 고정 광고와 가까워지지 않게 한다 (첫 화면 파일 선택 버튼은 칸 위쪽에 둔다).
    화면을 바꾸면 390×844에서 버튼과 하단 광고 사이를 재 본다.
- 칸 수를 늘린다고 수익이 비례하지 않는다. 보이는 자리에 적당히 두고, 광고가 콘텐츠보다 많아 보이지 않게 한다
  (AdSense 심사의 '가치 없는 콘텐츠' 거절 위험, 페이지 속도 저하).
  - `mobile-anchor`는 `BaseLayout`에 있어 모든 페이지에 자동으로 붙는다. 새 페이지 틀을 만들면 `RailShell`을 쓴다.
- 슬롯 크기는 미리 고정한다. 광고가 떠도 레이아웃이 밀리면 안 된다 (CLS 0).
- `site.config.ts`의 `ads.enabled` 하나로 전체를 켜고 끈다 (기본 꺼짐).
  꺼져 있으면 개발 모드에서만 점선 칸을 보여주고, 배포 화면에는 아무것도 그리지 않는다.
- 슬롯마다 업체(adsense/adfit 등)를 설정으로 정한다. 특정 업체에 묶이지 않는다.
- **다운로드·파일 선택·실행 버튼 근처에 광고 슬롯을 두지 않는다.**
  도구 영역과 below-tool 사이에는 로컬 처리 안내 + 48px 버퍼를 둔다.
- 진행 표시·결과·다운로드 버튼 영역은 **처리 전후 높이가 같아야 한다.**
- 모바일에서 실행·다운로드 버튼 영역을 화면 하단에 고정하지 않는다 (하단 고정 광고와 붙음).
- 모바일 하단 광고(`mobile-anchor`)는 버튼이 보일 때도 숨기지 않는다. 대신
  버튼 영역 아래에 충분한 여백을 두고, 사용자가 접기 탭으로 직접 내릴 수 있게 한다.
- 모달·오버레이·팝업 안에는 광고 슬롯을 두지 않는다.
- 처리 중에만 나오는 광고 화면이나 일부러 기다리게 하는 대기시간은 만들지 않는다.
  (광고 칸은 처리 중에도 원래 자리에 그대로 보인다.)

### 이용 권한

- 기능 사용 가능 여부는 반드시 `src/lib/entitlement.ts`의 `canUse()`를 거친다.
- 지금은 항상 허용. 나중에 "광고 보고 고급 기능 해제" 같은 정책을 붙일 때 이 파일만 바꾼다.

### 화면·접근성

- 모노톤 + 포인트 1색(초록). 색은 `src/styles/tokens.css`의 토큰만 쓴다.
- 다크 모드 지원 (OS 설정 따름, 버튼으로 고정 가능, `localStorage`의 `theme` 키).
- 키보드로 모든 조작 가능, 라벨 필수, 대비 WCAG AA 이상.
- 모바일·데스크톱 모두 지원.

## 작업 방식 (Git)

- **커밋은 최소 단위.** 커밋 하나 = 변경 하나. 여러 수정을 한 커밋에 몰아넣지 않는다.
  사용자가 커밋 단위로 리뷰한다.
- 저장소: `newbission/justusing` (공개). 이 폴더는 newbission 계정으로 push된다.
- `main`·`dev`는 직접 건드리지 않는다.
  `dev`에서 기능 브랜치를 따고 → 작은 커밋 → 작은 PR → `dev`에 병합 → `dev`를 `main`에 병합하면 배포.
- 브랜치 이름: `<타입>/<짧은-설명>` (예: `feat/pdf-edit`, `fix/merge-password`)
- 기능 → `dev` PR은 **Rebase merge**로만 병합한다. 작은 커밋이 그대로 남는다.
  (Squash는 PR 제목·본문이 커밋 메시지가 되어 커밋 단위 리뷰가 사라진다)
- `dev` → `main` PR은 **병합 커밋**으로 넣는다 (`gh pr merge --merge --subject "<규칙에 맞는 제목>"`).
  GitHub의 Rebase merge는 커밋을 새로 만들어 해시가 바뀌므로, `dev`와 `main`의 기록이 갈라진다.
- PR 제목은 커밋 제목과 같은 형식이다 (`<타입>(<영역>): <제목>`, "~ 추가/수정/제거/변경"으로 끝냄).
  PR 본문은 `## 왜` → `## 바뀐 것` → `## 확인` (필요하면 `## 병합 뒤 할 일`) 순서로 쓴다.
- 코드 리뷰는 Codex(ChatGPT Codex Connector)가 한다. 자동 리뷰는 꺼 두고, 기능 → `dev` PR을 만든 직후
  PR에 `@codex review` 댓글을 달아 부른다. `dev` → `main` PR은 이미 리뷰한 커밋이라 부르지 않는다.
  리뷰 기준은 `AGENTS.md`에 있다.
- CI: PR마다 포맷·타입 검사·빌드·E2E (`.github/workflows/ci.yml`). 통과해야 병합한다.
- CD: `main`에 병합되면 Cloudflare가 직접 빌드(`npm run build`)하고 `dist/`를 배포한다.
  Cloudflare는 CI 결과를 보지 않으므로, main은 CI를 통과한 PR로만 들어오게 한다 (브랜치 보호).

### 커밋 메시지 규칙

```
<타입>(<영역>): <제목>

<본문: 왜 바꿨는지. 무엇을 바꿨는지는 diff에 있으니 반복하지 않는다>

Co-Authored-By: ...
```

- 타입: `feat`(기능) | `fix`(버그) | `refactor`(동작 그대로, 구조만) | `style`(포맷만, CSS 작성은 feat) |
  `docs` | `test` | `build`(의존성·빌드 설정) | `ci` | `chore`(그 외)
- 영역(생략 가능): `config`, `layout`, `theme`, `ads`, `registry`, `seo`, `entitlement`, `dev`, `hub`, `category`, `frame`,
  `pdf`(PDF 도구 공통: `src/lib/pdf/`),
  도구는 `pdf-view`, `pdf-merge` 처럼 도구 ID를 쓴다.
- 제목: 한국어, "~ 추가 / ~ 수정 / ~ 제거 / ~ 변경"으로 끝낸다. 50자 이내.
- 마지막 줄에 `Co-Authored-By` 표기를 넣는다.

## 진행 상황

단계마다 멈추고 사용자에게 결과를 보여 준 뒤 확인을 받고 다음 단계로 간다.

- [x] 1단계: 골격 — 설정 파일, 공통 레이아웃, 다크 모드, AdSlot, 레지스트리, 사이트맵·robots, 배포 워크플로
- [x] 2단계: 허브(`/`), PDF 목록(`/pdf/`), 머리글 카테고리 메뉴, 브레드크럼(+구조화 데이터), 사이트맵에 카테고리 주소 추가.
      PDF 도구 6개를 `status: 'soon'`(준비 중)으로 등록 — 도구를 만들 때마다 `live`로 바꾼다.
- [x] 3단계: PDF 보기 (`/pdf/view/`) + 공통 기반 — 격리 frame, CSP, blob 워커, pdf.js 직접 호스팅,
      FileDrop, 사용법/FAQ/관련 도구 섹션, E2E(로컬 처리 약속 검증)와 CI 연결
- [x] 4단계: PDF 합치기 (`/pdf/merge/`) + PDF 수정 도구 공통 기반
  - pdf-lib(`@cantoo/pdf-lib`)를 워커에서 돌리는 모듈 (`src/lib/pdf/`), 다운로드 도우미(`src/frame/`)
  - 페이지 썸네일, 처리 전후 높이가 같은 상태 막대(진행 → 다운로드), 실행 전 `canUse()`
  - 파일 목록: 여러 개 추가·순서 바꾸기(끌기 + 키보드)·빼기, 암호 PDF는 파일마다 암호 입력
- [ ] 5단계: 나머지 PDF 도구 — 4단계 기반을 재사용해 하나씩 (도구마다 멈추고 확인)
  - [x] 5-1 나누기 (`/pdf/split/`): 범위 지정 / 한 장씩 / 고른 페이지만. 여러 파일은 ZIP 하나로 받기 (`src/lib/zip.ts`)
  - [x] 5-2 회전 (`/pdf/rotate/`): 썸네일에서 페이지별·전체 90° 회전
  - [x] 5-3 정리 (`/pdf/organize/`): 썸네일 끌어서 순서 바꾸기, 페이지 삭제
  - 5-4 편집 (`/pdf/edit/`): MVP에서 뺀다 (2026-10-11). 첫 배포 뒤 방문 데이터를 보고 만든다.
    텍스트·이미지·서명. 한글 글꼴을 직접 호스팅해 PDF에 넣어야 해서 가장 크다. 그때까지 `soon`으로 둔다.
- [x] MVP 범위 확정 → GitHub 레포 생성 → 첫 push → `dev` 브랜치 생성 (2026-10-11)
- [x] Cloudflare 배포 연결 → 첫 배포 확인 (2026-10-11, workers.dev 주소에서 E2E 전체 통과)
- [x] 도메인 연결 → 도메인 주소에서 다시 확인 (2026-10-12, E2E 전체 통과, workers.dev 주소는 끔)

### 배포 수동 설정 (사용자가 직접, 에이전트는 이 단계를 반드시 안내할 것)

코드로는 할 수 없는 일이다.

1. Cloudflare → Workers & Pages → Create → **Connect GitHub** → 이 저장소 선택
   - 배포 브랜치(production) `main`, 빌드 명령 `npm run build`, 배포 명령 `npx wrangler deploy`
   - main이 아닌 브랜치 빌드는 끈다: Worker → Settings → Build → Branch control →
     **Enable Preview Builds** 체크 해제 (켜 두면 PR마다 빌드 알림이 온다)
2. 만든 Worker → Settings → Domains & Routes에 `site.config.ts`의 도메인과 `www.` 도메인 추가
   (DNS 레코드와 인증서는 Cloudflare가 만든다). 같은 이름의 DNS 레코드가 이미 있으면 먼저 지운다
   (예: 예전 GitHub Pages용 A 레코드 `185.199.x.x`, `www` CNAME). 연결한 뒤 같은 화면에서
   `workers.dev` 주소와 Preview URLs를 끈다 (같은 사이트가 두 주소로 열려 검색엔진에 중복으로 잡히지 않게).
3. GitHub 저장소 Settings → Branches에 `main`·`dev` 보호 규칙:
   PR로만 병합, CI(`check`) 통과 필수

### 광고 심사 신청 전에 할 일 (지금은 보류)

- 소개, 개인정보처리방침, 이용약관, 문의 페이지 + 바닥글 링크
- 문의 메일: Cloudflare Email Routing으로 `contact@<도메인>` → 개인 메일 전달
- 방문 통계: GA4 + Microsoft Clarity. **도구 영역은 Clarity 녹화에서 반드시 마스킹**하고,
  이벤트에는 파일 개수·크기 구간만 남긴다 (파일 이름·내용 금지).
  쿠키 없는 Cloudflare Web Analytics도 함께 둔다 (동의와 상관없이 전체 방문 수).
  시점: 첫 배포 직후, 쿠키 정책·개인정보처리방침과 함께.
- 쿠키 동의 배너 (2026-10-11 결정): **전 세계 공통 배너 하나**. 지역별로 나누지 않는다.
  - 동의 전에는 분석·광고 스크립트를 불러오지 않는다. GA4는 동의 모드 '고급'(거부해도 추정치)
  - "모두 허용"·"필수만" 두 버튼을 같은 크기·같은 눈에 띔으로, 쿠키 정책 링크, 바닥글 "쿠키 설정"으로 다시 바꾸기
  - 바깥 페이지에서만 동작·저장 (격리 frame과 무관). 화면 위에 떠서 레이아웃이 밀리지 않게, 배너 안에 광고 없음
  - 광고를 켤 때 다시 검토: AdSense는 유럽 방문자에게 Google 인증 동의 도구를 요구한다
    (인증 도구로 교체하거나 유럽에는 광고를 내지 않기)
- 광고 업체 스크립트 연결, `ads.txt` 채우기
- 광고를 켠 뒤 확인: 커서가 광고 iframe 위로 바로 들어와 그 위에 파일을 놓으면 광고 iframe이
  파일을 받을 수 있다 (우리 페이지는 끌기를 감지하지 못함). 광고 칸 위치·크기에서 이 경우를 검토할 것.
- og:image (로고가 정해지면)

### 정한 것

- MVP 범위 (2026-10-11): PDF 보기·합치기·나누기·회전·정리. 편집은 첫 배포 뒤에 만든다.
  나머지 개선(예: 정리에 여러 파일 넣기)은 직접 쓰면서 필요할 때 하나씩 더한다.
- 도구는 기능별로 따로 만든다 (2026-10-11). "파일 먼저 올리고 기능 고르기" 통합 화면도 검토했지만,
  쓰지 않는 기능까지 불러와 무거워진다. 한 가지 일에 집중하고 가볍게 쓰는 것이 목적이다.
  통합 버전이 필요하면 나중에 별도 도구로 만들고, 공통 모듈(조립 워커·썸네일 등)을 재사용한다.
- pdf-lib: 원본(`pdf-lib`)은 2022년 이후 릴리스가 없어 관리되는 포크 `@cantoo/pdf-lib`를 쓴다.
  API가 원본과 같고, 원본에 없는 암호 PDF 열기(복호화)를 지원한다.
