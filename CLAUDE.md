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
E2E_PORT=8790 npm run test:e2e  # 다른 작업 공간과 동시에 돌릴 때 포트 변경 (기본 8788, 검사 포트는 +1)
node scripts/perf/measure.mjs [--port 8852] [--files]  # 페이지가 처음 받는 크기 재기 (먼저 build + wrangler dev, 성능 예산의 기준 수치)
python3 tests/fixtures/make_fixtures.py  # 테스트용 PDF 다시 만들기
python3 tests/fixtures/make_image_fixtures.py  # 테스트용 이미지 다시 만들기 (Pillow·pillow-heif 필요)
python3 tests/fixtures/make_text_fixtures.py  # 테스트용 CSV(CP949·Shift_JIS) 다시 만들기
python3 tests/fixtures/make_frame_fixtures.py  # 동영상을 GIF로·장면 캡처 시험 동영상 다시 만들기 (Pillow·ffmpeg 필요)
npm run build && python3 scripts/fonts/build_site_font.py && npm run build  # 사이트 화면 글꼴 다시 만들기 (새 글자가 생겨 site-font E2E가 실패할 때)
python3 scripts/samples/make_samples.py  # '예시 파일로 해 보기' 견본 다시 만들기 (PyMuPDF·Pillow·pillow-heif, 먼저 npm install)
python3 scripts/samples/make_video_samples.py  # 동영상을 GIF로·장면 캡처 견본 동영상 다시 만들기 (Pillow·ffmpeg 필요)
PLAYWRIGHT_CHANNEL=chrome node scripts/guide-images/run-tools.mjs && python3 scripts/guide-images/render.py  # 가이드 그림 다시 만들기 (먼저 npm run preview)
node scripts/readme/tools.mjs  # README(한·영) 도구 목록을 레지스트리에서 다시 만들기 (--check: 다르면 실패, CI)
PLAYWRIGHT_CHANNEL=chrome node scripts/readme/screenshots.mjs  # README 화면 그림 다시 만들기 (먼저 npm run preview)
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

### 성능 (2026-10-24, 사용자 철칙: "사이트가 무거워지거나 느려지면 안 된다")

- 도구 전용 라이브러리·데이터(pdf.js, pdf-lib, Tesseract, libheif, MediaPipe, 글꼴·OCR 데이터)는 **그 도구 frame에서, 필요한 때에만** 받는다.
  파일을 고르기 전 첫 화면에서는 받지 않는다 (동적 `import()`로 필요한 순간에). 바깥 페이지에는 두지 않는다.
- **바깥 페이지에 새 JS·CSS를 넣지 않는 것이 기본이다.** 꼭 필요하면 작게, 필요한 페이지에서만 넣고 PR에 왜 필요한지 쓴다.
  모든 페이지에 수십 개씩 반복되는 부품(메뉴·아이콘)은 `<style is:global>` + 루트 클래스로 써서 Astro 범위 속성(`data-astro-cid-*`)이 HTML을 키우지 않게 한다.
- **성능 예산 E2E** (`tests/e2e/perf-budget.spec.ts`): 페이지 종류별로 처음 받는 HTML·JS·CSS·글꼴·그림 크기와 도구 frame 첫 화면 크기에
  상한이 있고, 넘으면 CI가 실패한다. 도구·페이지를 더하면 `node scripts/perf/measure.mjs`로 재 본다.
  **상한을 올릴 때는 spec 주석과 PR 본문에 이유를 적는다** (먼저 줄일 방법을 찾는다). 측정 표·방법은 `docs/foundations/site-structure/README.md`의 "성능 예산".

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
  빌드 뒤 `src/integrations/csp-per-page.ts`가 페이지마다 그 페이지의 인라인 스크립트·스타일 해시만 남긴다(2026-10-24). 그래서
  실행 중에 `<style>`·인라인 `<script>`를 새로 넣는 코드는 막힌다 (E2E가 CSP 위반을 실패로 본다)
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
- frame CSP에서 우리 파일을 허용할 때 `'self'`만 쓰지 않는다. **Safari(WebKit)는 출처 없는 sandbox 문서에서 `'self'`를
  우리 사이트로 보지 않아** 워커·스타일·글꼴이 모두 막힌다(2026-10-15에 발견, 크롬 E2E로는 보이지 않음).
  `FrameLayout`이 사이트 주소를 함께 적는다. Astro `insert*Resource`는 기본값을 대신하므로 `'self'`도 직접 넣는다
- 격리 frame 안의 blob 워커는 안전한 문맥(secure context)이 아니라 WebCodecs(`VideoDecoder` 등) 같은 secure-context 전용 API가 없다
  (2026-10-23, 크롬). 그런 API는 frame 본문에서 쓴다 (동영상 도구, docs/foundations/video-common)
- 외부 리소스가 필요하면 우리 사이트에 복사해 둔다 (예: pdf.js CMap → `public/vendor/pdfjs/`,
  `scripts/copy-pdfjs-assets.mjs`가 dev/build 전에 복사).

### 설정은 한 곳에

- 사이트명·도메인·설명·광고 설정은 `src/site.config.ts`에만 둔다. 코드·문서에 하드코딩하지 않는다.
  예외: `README.md`·`README.en.md`(영어판)는 저장소를 찾은 사람이 사이트로 바로 가게 사이트 링크를 직접 적는다 (사용자 결정, 2026-10-18). 도메인을 바꾸면 같이 고친다 (도구 목록은 `scripts/readme/tools.mjs`가 `site.config.ts`의 도메인으로 다시 만든다).
- 도메인 연결은 코드가 아니라 Cloudflare 대시보드에서 한다 (아래 "배포 수동 설정").

### 주소 구조

- 서브도메인이 아니라 경로로 나눈다: `/`(허브), `/pdf/`(목록), `/pdf/merge/`(도구).
- 주소는 항상 끝 슬래시로 끝난다 (`trailingSlash: 'always'`).
- 기본 언어는 한국어(앞에 아무것도 없음), 영어는 `/en/...`. 아래 "다국어" 참고.

### 도구 레지스트리

새 도구 추가 방법:

1. `src/tools/<카테고리>/<이름>/` 폴더를 만든다.
   - `meta.ts`: `defineTool({ status, section, icon, text: { ko: { name, summary, title, description } }, related })`
     - `summary`: 머리글 펼침 메뉴에서 이름 아래 붙는 한 줄 (한국어 25자·영어 40자 안팎, 실제로 하는 일만, 2026-10-23)
     - `section`: 카테고리 안의 묶음 (`categories.ts`의 `sections` 키). 목록 페이지·홈이 묶음별 소제목으로 나눠 보여준다
     - `icon`: 목록 카드 아이콘. 24×24 칸에 선으로 그린 SVG path의 `d` 값들. 다른 도구와 한눈에 구분되게 그린다
     - `flow`: 제목 아래 '넣는 것 → 나오는 것' 그림 (`ToolFlow`). 종이 종류·장수·종이 위 표시(`mark`)만 적는다 (2026-10-19)
   - `content.ts`: `defineContent({ ko: { uses: [{ title, text }], howTo: [...], faq: [{ q, a }] } })` — live 도구는 필수
     - `uses`: '이럴 때 쓰세요' 실제 상황 3개 (도구마다 다른 내용, 실제로 하는 일만). 페이지가 판에 박혀 보이지 않게 한다 (2026-10-18)
       (업로드 여부·광고 안전성 같은 모든 도구 공통 질문은 `src/tools/common-faq.ts`에 있고 자동으로 붙는다)
   - `Frame.astro`: 격리 frame 페이지. `FrameLayout` 안에 `App.svelte`를 `mount`한다 (`pdf/view` 참고)
   - `App.svelte`: 실제 도구 UI. 첫 화면은 `src/frame/FileDrop.svelte`를 쓴다
2. `src/tools/registry.ts`의 `TOOL_IDS`에 `'<카테고리>/<이름>'` 한 줄을 넣는다.
   `src/frame/samples.ts`의 `BY_TOOL`에 넣을 견본을 적는다 ('예시 파일로 해 보기', 맞는 견본이 없으면 `make_samples.py`에 더한다).
3. 다 만들면 `meta.ts`의 `status`를 `'live'`로 바꾸고 `tests/e2e/`에 E2E를 추가한다.
   `node scripts/readme/tools.mjs`로 README(한·영)의 도구 목록을 다시 만든다 (CI가 `--check`로 레지스트리와 같은지 본다).

도구 ID와 주소는 폴더 경로에서 정해진다. 도구 페이지(`[category]/[tool].astro`)와
frame 페이지는 `src/integrations/tool-frames.ts`가 live 도구마다 그 도구의 `Frame.astro`를 진입점으로 만든다(그 도구 CSS만 실리게).
새 카테고리·묶음은 `src/tools/categories.ts`에 추가한다 (묶음 순서가 곧 화면 순서). PDF 도구는 `src/lib/pdf/pdfjs.ts`의 `openPdf()`로 열고(보기·썸네일),
결과 PDF는 `src/lib/pdf/assemble.ts`의 `assemblePdf()`로 만든다(페이지 고르기·순서·회전, 워커에서 pdf-lib).
썸네일은 `src/lib/pdf/Thumbnail.svelte`, 다운로드는 `src/frame/download.ts`, 바깥 스크롤 요청은 `src/frame/parent.ts`.
PDF 하나를 다루는 도구는 `src/lib/pdf/SinglePdfTool.svelte`(파일 고르기·암호·파일 이름 막대) 안에 화면을 그리고,
실행·다운로드 막대는 `src/frame/ActionBar.svelte`를 쓴다 (나누기·회전·정리 참고).

### 도구 페이지 구성

도구 영역 → 로컬 처리 안내 → 사용법 → FAQ → 관련 도구 (`src/layouts/ToolLayout.astro`).
검색 노출과 광고 심사를 위해 텍스트 내용이 충분해야 한다.

### 다국어 (2026-10-14, 한국어·영어)

- 언어 목록과 주소 규칙은 `src/i18n/locales.ts`. 페이지 언어는 주소에서 정한다 (`localeOf(Astro.url.pathname)`).
  부품이 언어를 넘겨받지 않고 스스로 주소에서 읽는다.
- 문구 위치:
  - 바깥 페이지 부품: `src/i18n/ui.ts` (`ui(locale)`)
  - 사이트 설명·홈 제목: `site.config.ts`의 `text[locale]`
  - 도구 이름·설명: 각 도구 `meta.ts`의 `text`, 쓰임새·사용법·FAQ: `content.ts`, 공통 FAQ: `common-faq.ts` — **모든 언어 필수**(빠지면 타입 오류)
  - 도구 화면(격리 frame) 공통 부품: `src/frame/messages.ts`, 도구별: 도구 폴더의 `messages.ts`.
    frame은 `<html lang>`으로 언어를 읽는다 (`src/frame/locale.ts`의 `pick()`)
- 영어 라우트(`src/pages/en/`)는 한국어 페이지를 그대로 그리는 얇은 파일이다. 주소 목록은 `src/tools/paths.ts`를 같이 쓴다.
  글 페이지(소개·방침·약관·문의)만 영어 글을 따로 쓴다. **방침·약관은 두 언어를 함께 고치고 시행일도 맞춘다**
  (영어판에는 "다르면 한국어판이 기준"이라고 적혀 있다).
- 새 바깥 페이지를 만들면 영어판도 만든다 (BaseLayout이 모든 페이지에 다른 언어판 hreflang을 단다).
- 처음 방문: `LocaleRedirect`가 직접 고른 언어(`localStorage`의 `lang`, 머리글 `LocaleSwitch`가 저장) → 없으면
  브라우저 첫 언어 → 지원하지 않으면 영어로 보낸다. **검색 로봇과 자동화 브라우저는 보내지 않는다**
  (구글 로봇은 영어 브라우저라 보내면 한국어 페이지가 검색에서 빠진다). E2E는 자동화 브라우저라 이동이 꺼진다
  (`tests/e2e/i18n.spec.ts`가 켜서 확인).
- 버튼 이름을 바꾸면 그 도구의 쓰임새·사용법(`content.ts`)에 적힌 버튼 이름도 같은 언어로 맞춘다.
  '예시로 따라 하기'(`src/frame/tour.ts`, 도구 페이지 위 창)가 사용법에 따옴표로 적힌 이름으로 버튼을 찾아 비춘다.

### 도구 데이터 보관 (글꼴·OCR 데이터, 2026-10-15)

- 큰 공개 파일은 `public/data/`에 둔다. 도구 frame이 `src/frame/data.ts`로 요청하면 바깥 페이지
  (`src/lib/data-store.ts`, `ToolFrame`이 띄움)가 Cache API에 보관해 두고 넘겨준다. 사용자 파일은 오가지 않는다
- frame은 받은 바이트를 빌드 때 적어 둔 **SHA-256과 크기로 확인한 뒤에만** 쓴다 (바깥 페이지의 광고 스크립트가
  끼어들어도 안전). 주소에 `?v=<해시>`를 붙여 내용이 바뀌면 예전 보관본을 쓰지 않는다
- 받기로 한 데이터 묶음 이름을 바깥 `localStorage`(`data-consent`)에 적어 "보관본이 지워짐"을 알린다
- 개인정보처리방침의 "브라우저에 저장하는 것"에 밝혀 두었다. 보관하는 것을 바꾸면 방침도 고친다

### 글꼴 (2026-10-15)

- 글꼴 파일은 `scripts/fonts/build_fonts.py`가 만든다 (Google Fonts 고정 커밋 + Pretendard 패키지 → 보통·굵게,
  한글 음절·영문·숫자·문장부호만, 한자 없음 → WOFF2). 결과(`public/data/fonts/`, 미리보기 SVG, 허가서,
  `src/lib/fonts/catalog.json`)는 커밋한다. 글꼴을 더하면 `src/lib/fonts/catalog.ts`의 이름도 더한다
- WOFF2는 글리프 변환(transform)을 끄고 만든다. 켜면 PDF에 넣는 fontkit이 실패한다
- 사이트 화면 글꼴(본문)은 Pretendard에서 사이트 글자만 덜어 낸 조각 넷이다 (`scripts/fonts/build_site_font.py` → `src/styles/site-font.css`,
  굵기 400~700, 2026-10-24). 바깥 페이지에는 뒤 글꼴이 없어 새 글자가 생기면 다시 만든다 (E2E `site-font.spec.ts`가 알려 줌)
- 글자를 덜어 낸 글꼴은 OFL의 '고친 판'이다. 허가서에 **예약 글꼴 이름(Reserved Font Name)**이 있으면
  (Pretendard, Nanum…) 글꼴 파일 안의 이름과 화면 이름에 그 이름을 쓸 수 없어 우리 이름(JUS …, 모던 고딕 등)을
  붙이고 원본 이름은 출처로만 밝힌다. 글꼴을 더할 때 허가서의 예약 이름을 먼저 확인한다
- 미리보기 문구는 5줄 고정 (한글 문장, 영어 대문자·소문자 문장, 숫자, 특수문자. 영어 화면은 영어 줄이 먼저)
- PDF에 글자를 넣는 처리는 fontkit이 커서 따로 된 워커에서 하고, 쓴 글자만 넣는다(subset). 글꼴에 없는 글자는
  미리 알린다

### 가이드 글 (2026-10-15)

- `src/content/guides/<언어>/<주소>.md` 하나가 글 하나다. **모든 언어판을 같은 주소 이름으로 쓴다**
  (빠지면 `src/guides.ts`가 빌드를 멈춘다). 머리말: `title`, `description`, `tool`(안내하는 live 도구 ID),
  `published`, `updated`(고쳤을 때), `order`(목록 순서)
- 페이지: 목록 `/guide/`, 글 `/guide/<주소>/` (`src/pages/guide/`). 글 위아래에 도구 링크, 도구 페이지에는
  '관련 가이드'(`ToolGuides`)가 저절로 붙는다. 사이트맵·머리글·바닥글에도 있다
- 글 안의 링크는 그 언어의 주소로 쓴다 (영어 글은 `/en/...`). 버튼 이름은 도구 화면과 똑같이 쓴다.
  도구의 버튼·동작을 바꾸면 그 도구의 가이드도 고친다
- 실제 동작과 어긋나는 내용을 쓰지 않는다 (줄어드는 정도·지원 형식 등). 광고 심사의 '가치 있는 콘텐츠'가 목적이라
  도구 사용법을 늘여 쓰지 말고 원리·고르는 법·문제 해결처럼 읽을 거리를 담는다
- 그림 (2026-10-19): 글 하나에 1~2장, 가볍게. 꾸미는 그림·사진 자료는 쓰지 않고 **우리 도구로 견본을 처리한 실제 결과**나
  원리를 보여 주는 단순한 그림만 쓴다. `src/assets/guides/<언어>/<주소>/`에 두고 마크다운에서 상대 경로로 부른다
  (빌드가 WebP로 바꾸고 크기를 적는다). 실제 결과 그림은 `scripts/guide-images/`(도구 실행 → 그리기)로 다시 만든다.
  화면 문구는 그림에 넣지 않고 글로 쓰며, 그림을 설명하는 alt를 언어마다 쓴다. 휴대폰 폭에서 그림 속 글자가 읽히는지 본다
- 움직이는 그림 (2026-10-23): 과정이 중요한 글만(지금 이어 붙이기·자르기 2편). 같은 재료(견본·도구 결과)로 3~4초,
  한 편 몇백 KB 이하의 애니메이션 WebP를 `render.py`의 `MOTIONS`가 `public/guide-motion/<언어>/<글>/`에 만든다
  (`<이름>.webp` 움직임, `<이름>-still.webp` 멈춘 그림, 둘은 크기가 같다). 마크다운 이미지는 Astro가 정지 WebP로
  다시 만들 뿐 `prefers-reduced-motion`으로 고를 수 없어서, 글에 `<picture>`를 직접 쓴다
  (`<source media="(prefers-reduced-motion: no-preference)">` + 멈춘 그림 `<img>`, width·height·alt 필수).
  끝 화면은 도구가 만든 결과 그대로이고 중간은 같은 계산으로 그린다 (어긋나면 `render.py`가 멈춘다)

### 글 페이지와 방문 통계

- 글 페이지(소개 `/about/`, 개인정보처리방침 `/privacy/`, 이용약관 `/terms/`, 문의 `/contact/`)는
  `src/layouts/DocLayout.astro`를 쓴다. 새 글 페이지는 바닥글(`Footer.astro`)과 사이트맵에 직접 더한다.
- 문의 메일 주소는 `site.config.ts`의 `contactEmail`만 쓴다.
- **통계·광고·쿠키를 더하거나 바꾸면 같은 PR에서 개인정보처리방침과 시행일을 고친다.**
  방침에는 지금 실제로 하는 일만 적는다 (소개 페이지의 설명도 사실과 어긋나지 않게).
- 방문 통계 스크립트는 `src/components/Analytics.astro`에서만 넣는다 (바깥 페이지 전용, 개발 서버에서는 꺼짐).
  외부 스크립트 주소는 그 부품에서 페이지 CSP에 허용한다.
- E2E의 로컬 처리 검사는 `tests/e2e/local-only.ts`가 기준이다. 도구 frame의 요청은 우리 사이트로만 가야 하고,
  바깥 페이지는 거기 적힌 통계 주소로만 더 갈 수 있다. 통계·광고 업체를 더하면 이 목록을 고친다.
- E2E는 `@playwright/test`가 아니라 `tests/e2e/test.ts`의 `test`를 쓴다. 광고 주소를 빈 응답으로 바꿔
  실제 광고 서버에 연결하지 않는다 (광고 차단 상태는 `adblock.spec.ts`가 요청을 끊어서 만든다).

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
- `site.config.ts`의 `ads.enabled` 하나로 전체를 켜고 끈다 (광고 스크립트, 광고 칸, 광고 차단 안내).
  꺼져 있거나 슬롯 설정이 없으면 개발 모드에서만 점선 칸을 보여주고, 배포 화면에는 칸을 그리지 않는다.
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

### 로고

- 모양은 `src/brand/logo.ts` 한 곳에만 둔다. 머리글(`Logo.astro`), `favicon.svg`, 내려받기 SVG(`/brand/`)가 여기서 그린다.
- 심볼은 늘 같은 색(검정 네모·흰 j/u·밝은 초록 점), 글자 로고는 화면 테마를 따른다. 다크 화면에서는 네모에 선을 두른다.
- 글자 로고는 Pretendard Bold로 쓴 `justus.ing`을 도형으로 바꾼 것이고, 마침표만 초록이다.
- **점핏(Jumpit)과 겹치지 않게 한다** (2026-10-14): 점핏은 검정 네모 + 기울인 흰 j + 머리 위 초록 점이다.
  초록 점을 j 머리 위에 두지 않는다 (심볼은 u 그릇 안, 글자는 마침표).
- PNG·ICO(favicon, 홈 화면 아이콘, og:image, `/brand/*.png`)는 로고를 바꿀 때
  `PLAYWRIGHT_CHANNEL=chrome node scripts/make-brand-images.mjs`로 다시 만들어 커밋한다.

### 이용 권한

- 기능 사용 가능 여부는 반드시 `src/lib/entitlement.ts`의 `canUse()`를 거친다.
- 지금은 항상 허용. 나중에 "광고 보고 고급 기능 해제" 같은 정책을 붙일 때 이 파일만 바꾼다.

### 화면·접근성

- 모노톤 + 포인트 1색(초록). 색은 `src/styles/tokens.css`의 토큰만 쓴다.
- 다크 모드 지원 (OS 설정 따름, 버튼으로 고정 가능, `localStorage`의 `theme` 키).
- 키보드로 모든 조작 가능, 라벨 필수, 대비 WCAG AA 이상.
- 모바일·데스크톱 모두 지원.

## 기능 문서 (`docs/`, 2026-10-16)

- 기능·기반마다 폴더가 있다: `docs/features/<도구 ID>/`, `docs/foundations/<기반>/`. 목록과 규칙은 [`docs/README.md`](docs/README.md)
  - `README.md`: 어떤 기능인지 · 어떻게 만드는지(파일·흐름·결정과 이유·주의할 점) · 구현 체크리스트 · 검증
  - `history.md`: 위 **요약**(중요한 결정·큰 오류와 원인·배운 점)은 직접 쓰고, 아래 **기록**(PR·커밋·리뷰 지적)은
    `node scripts/docs/history.mjs`가 만든다
- 작업을 시작할 때 그 기능의 문서부터 읽는다
- 기능을 만들거나 고치는 PR에서 **그 기능의 README도 같이 고친다**. 새 도구는 `docs/_template/`을 복사하고
  `scripts/docs/history.mjs`의 `DOCS`에 더한다. 병합 뒤 `history.mjs`를 다시 돌린다

## 작업 방식 (Git)

- **커밋은 최소 단위.** 커밋 하나 = 변경 하나. 여러 수정을 한 커밋에 몰아넣지 않는다.
  사용자가 커밋 단위로 리뷰한다.
- 저장소: `newbission/justusing` (공개). 이 폴더는 newbission 계정으로 push된다.
- `main`·`dev`는 직접 건드리지 않는다.
  `dev`에서 기능 브랜치를 따고 → 작은 커밋 → 작은 PR → `dev`에 병합 → `dev`를 `main`에 병합하면 배포.
- 브랜치 이름: `<타입>/<짧은-설명>` (예: `feat/pdf-edit`, `fix/merge-password`)
- 기능 → `dev` PR은 **Rebase merge**로만 병합한다. 작은 커밋이 그대로 남는다.
  (Squash는 PR 제목·본문이 커밋 메시지가 되어 커밋 단위 리뷰가 사라진다)
- `dev` → `main` PR은 **Squash merge**로 넣는다 (2026-10-14). 배포 한 번 = main 커밋 하나.
  제목은 규칙대로 (`gh pr merge --squash --subject "<제목>" --body "<배포에 담긴 것 요약>"`).
  작은 커밋은 dev에 그대로 남아 커밋 단위 리뷰는 dev에서 한다.
  - **병합 직후 main을 dev에 되돌려 넣는다**: `main` → `dev` PR을 만들어 병합 커밋으로 넣는다
    (`gh pr merge --merge --subject "chore: main 병합 반영 추가"`). 안 하면 다음 배포 때 같은 줄을 서로 다르게
    고친 것으로 보여 충돌이 난다. 이 PR은 CI만 통과하면 되고 Codex 리뷰는 부르지 않는다.
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
  - 5-4 편집 (`/pdf/edit/`): MVP에서 뺐다가 8단계에서 글꼴 기반 위에 만들었다 (2026-10-15)
- [ ] 6단계: 변환 도구 (2026-10-14) — 검색이 많은 'pdf 변환'용. 도구마다 멈추고 확인
  - [x] 6-1 PDF를 이미지로 (`/pdf/to-image/`): 전체 추출 / 선택 추출, JPG·PNG, 150·300 DPI.
        쪽을 canvas에 그린다 (`src/lib/pdf/render-image.ts`, 브라우저 canvas 크기 한계 안으로 줄임)
  - [x] 6-2 이미지를 PDF로 (`/pdf/from-image/`): 이미지 한 장이 한 쪽, A4·Letter·이미지에 맞춤, 여백.
        JPG·PNG는 원본 그대로 넣고, EXIF 방향이 붙은 휴대폰 사진과 그 밖의 형식만 다시 저장한다
        (`src/lib/image/prepare.ts`, 워커 `src/lib/pdf/images-to-pdf.worker.ts`)
- [x] 7단계: 가벼운 PDF 도구 (2026-10-14) — 서버·큰 라이브러리·한글 글꼴 없이 되는 것은 모두 만든다
  - 공통: `src/lib/pdf/modify.ts`(+워커)가 PDF 하나를 고친다. 쪽 위 자리는 화면 기준 비율로 넘기고
    워커가 쪽 회전·CropBox를 계산한다. 새 도구 화면은 `src/frame/controls.css`의 공통 모양을 쓴다
  - [x] 암호 해제 (`/pdf/unlock/`), 암호 걸기 (`/pdf/protect/`, AES-256), 쪽 번호 (`/pdf/page-numbers/`),
        글자 추출 (`/pdf/extract-text/`)
  - [x] 이미지 넣기 (`/pdf/add-image/`), 서명 넣기 (`/pdf/sign/`): 같은 화면(`StampTool`, 배치 `PlacementEditor`)을
        쓰고 찍을 이미지를 고르는 부분만 다르다. 서명은 그리기 칸(`SignaturePad`) 또는 이미지 올리기
  - [x] 자르기 (`/pdf/crop/`): 보이는 영역(CropBox)만 줄인다. 잘린 내용은 파일에 남는다고 화면·FAQ에 밝힌다
  - [x] 모아찍기 (`/pdf/n-up/`, 2026-10-15): 한 장에 2·4·6·9쪽. 쪽을 그림으로 바꾸지 않고 줄여 넣는다(`embedPages`).
        내용이 없는 빈 쪽은 pdf-lib가 넣지 못해 칸만 비운다
  - 쪽을 크게 그리고 위에 겹쳐 조작하는 화면은 `src/lib/pdf/PageSheet.svelte` 위에 만든다
- [ ] 8단계: 무거운 PDF 도구 (2026-10-14) — **서버 없이 되면 오래 걸리거나 데이터가 커도 만든다** (사용자 결정).
      도구마다 멈추고 확인
  - 오래 걸리는 처리는 기기의 CPU 수(`navigator.hardwareConcurrency`)에 맞춰 워커 여러 개로 나눈다
  - 큰 데이터(한글 글꼴, OCR 엔진·언어 데이터)는 그 도구에서만 받고, **받기 전에 크기를 화면에 밝힌다**
  - 다음 방문에 다시 받지 않게 한다. 격리 frame은 저장소를 못 쓰고 **브라우저 캐시도 방문마다 비워진다**
    (2026-10-15 크롬에서 확인). 그래서 바깥 페이지가 보관한다 → 아래 "도구 데이터 보관"
  - 데이터가 필요한 도구는 처음 들어올 때(보관본이 없을 때) 받을지 묻고 크기를 밝힌다. 보관본이 지워졌으면
    조용히 다시 받지 않고 다시 묻는다 (와이파이인지 알 수 없다). "이 브라우저에만 보관"을 밝힌다
  - [x] 압축 (`/pdf/compress/`): 글자는 그대로 두고 PDF 안의 사진만 다시 저장한다 (`src/lib/pdf/compress.ts`).
        사진 워커 여러 개가 나눠 줄인다. 브라우저가 확실히 다루는 사진(JPG, 8비트 회색·RGB)만 바꾼다
  - [x] 글꼴 기반 (2026-10-15): 한글 글꼴 8종(OFL) 직접 호스팅 + 내 글꼴 올리기, 글꼴 목록(`FontPicker`)
  - [x] 글자 워터마크 (`/pdf/watermark/`): 가운데·반복, 기울기·크기·진하기·색, 쪽 위 미리보기
  - [x] 머리말·꼬리말 (`/pdf/header-footer/`): 위·아래 글자, {쪽}·{전체}·{날짜} 자리표시, 표지 빼기.
        글자 넣기 처리는 `src/lib/pdf/text-pdf.ts`(+워커) 하나를 워터마크와 같이 쓴다
  - [x] 편집 (`/pdf/edit/`, 5-4를 여기서 마침): 글자 넣기·흰색 가리기·형광펜, 고르기·옮기기(키보드 포함).
        흰색 가리기는 아래 내용이 남는다고 화면·FAQ·가이드에 밝힌다 (진짜 지우기는 따로)
  - [x] OCR (`/pdf/ocr/`, 2026-10-15): Tesseract(`tesseract.js-core`의 SIMD 엔진 + `tessdata_best` 정수판 한국어·영어).
        엔진·언어 데이터는 `scripts/copy-ocr-data.mjs`가 node_modules에서 `public/data/ocr/`로 복사하고
        목록(`src/lib/ocr/catalog.json`, 크기·SHA-256)을 쓴다. 워커(`src/lib/ocr/`)는 데이터를 화면에서 받아 쓰고
        스스로 받지 않는다. 쪽마다 Tesseract가 만든 투명 글자층 PDF를 원래 쪽 위에 겹친다(`src/lib/pdf/text-layer.ts`)
  - [x] 가리기 (`/pdf/redact/`, 2026-10-15): 상자 그리기·글자 찾아 가리기. 가린 쪽은 칠한 그림(JPG)으로 바꾸고
        나머지 쪽만 새 PDF에 옮긴다(`src/lib/pdf/redact-pages.ts`). 원래 PDF를 고치면 pdf-lib가 쓰지 않는
        객체까지 저장해 가린 내용이 남으므로 고치지 않는다. 옮기는 쪽은 주석을 평면화하고, 같이 쓰던 자원 중
        안 쓰는 것과 링크·기사 흐름을 끊는다. 책갈피·양식·문서 정보는 넣지 않는다
  - [x] 사진 꺼내기 (`/pdf/extract-images/`, 2026-10-15): JPG는 원본 바이트 그대로, Flate 8비트 이하 회색·RGB·색 목록
        (+투명도)은 PNG로, JPX는 .jp2로. 흑백 팩스·CMYK 등은 꺼내지 못한 수로 알린다(`src/lib/pdf/extract-images.worker.ts`)
  - [x] 양식 채우기 (`/pdf/fill-form/`, 2026-10-15): pdf.js가 알려 주는 입력 칸 자리에 HTML 입력 칸을 겹친다
        (`PageSheet`의 `hideForms`로 원래 칸 모양은 그리지 않음). 저장은 글자 넣기 워커가 pdf-lib 양식 API로 하고,
        기본 글꼴에 없는 글자를 적으면 글꼴을 고르게 한다. 굳히기(flatten) 선택
  - [x] 문서 정보 (`/pdf/metadata/`, 2026-10-15): 제목·작성자·주제·키워드 고치기, 모두 지우기(만든 프로그램·날짜까지).
        이 작업만 pdf-lib가 열 때 만든 프로그램·고친 날짜를 바꾸지 않게 연다(`updateMetadata: false`). XMP는 지운다
  - 하지 않음: PDF 비교 (2026-10-14 사용자 결정). 서버가 필요한 것: 오피스(워드·엑셀·PPT)→PDF,
    파일 공유·여러 사람 서명, 인증서 전자서명
- [ ] 9단계: 이미지 도구 (2026-10-15) — 프로그램을 설치하지 않고 쓰는 이미지 도구를 계속 늘린다 (사용자 방향).
      도구마다 멈추고 확인
  - 공통: 여러 장 목록 화면 `src/lib/image/ImageBatchTool.svelte`(+`batch.svelte.ts`), 처리는
    `src/lib/image/process.ts`(읽기 → 크기 바꾸기 → 저장, CPU 수에 맞춘 워커 여러 개).
    PNG 색 줄이기는 UPNG.js (`upng-globals.ts`가 워커에서 zlib을 마련한다)
  - 큰 결과 저장 (2026-10-23): 다시 그려 저장하는 워커(자르기·회전, 모자이크, 이어 붙이기)는
    `src/lib/image/worker-canvas.ts`의 `saveDrawing()`을 쓴다. canvas 하나에 그릴 수 있으면 브라우저 저장, 못 그리면
    (아이폰 약 1,670만 화소) PNG·JPG를 줄 묶음씩 직접 만든다(`png-stream.ts`, `jpeg-stream.ts`). WebP만 실패로 알린다.
    E2E는 워커 전역 `__canvasPixelLimit`으로 한계를 낮춰 시험한다(`tests/e2e/canvas-limit.ts`)
  - [x] 압축 (`/image/compress/`): JPG·WebP는 화질, PNG는 색 수로 줄인다. 원본보다 크면 원본 그대로
  - [x] 크기 조절 (`/image/resize/`): 비율(%) 또는 가로·세로 픽셀(비율 유지·정확히)
  - [x] 형식 변환 (`/image/convert/`): 브라우저가 읽는 이미지(GIF·BMP·AVIF)와 HEIC를 JPG·PNG·WebP로
  - [x] 용량 맞추기 (`/image/target-size/`, 2026-10-23): "200KB 이하"처럼 정한 용량 이하로. 화질을 이분 탐색으로 낮추고(크기를 줄여도 되면 60%까지),
        그래도 크면 가로·세로를 줄인다. 공통 워커의 `limit` 경로(`fitImage`, `src/lib/image/fit-size.ts`). 1KB = 1,000바이트로 센다
  - [x] 증명사진 (`/image/id-photo/`, 2026-10-20): MediaPipe Face Landmarker로 얼굴을 찾아 여권 규격(3.5×4.5cm,
        머리 3.2~3.6cm)에 맞게 자르기·크기·기울기를 바꾼다(`src/lib/face/`). 얼굴 보정은 하지 않는다(여권 규정).
        배경은 고를 때만 바꾸고(Selfie Segmenter) 여권에는 원래 사진을 쓰라고 알린다. 좌우 반전(앞 카메라).
        엔진·모델(16.8MB)은 받기 전에 묻고 보관한다. 엔진에 든 사용 통계 전송은 워커의 fetch를 없애 막는다.
        견본은 이미지 생성 AI로 만든 가상 인물이다 (`scripts/samples/face.jpg`)
  - [x] 사진 위치 정보 지우기 (`/image/remove-location/`, 2026-10-20): JPG·PNG·WebP를 다시 저장하지 않고 정보 조각만
        고친다(`src/lib/image/photo-metadata.ts`). 모두 지우기(방향만 새로 적음)·위치만 지우기(EXIF는 날짜·기기·촬영 설정 칸만 골라 새로 만들고 나머지 조각은 뺌).
        JPEG 끝 뒤에 덧붙은 자료(움직이는 사진 영상)는 두 방식 모두 뺀다. 지운 결과를 다시 읽어 위치가 남았으면 실패로 알린다
  - [x] 이어 붙이기 (`/image/stitch/`, 2026-10-22): 세로·가로로 잇기. 세로로 이을 때 화면 캡처의 고정 막대와 겹친 부분을
        줄 모양(칸 밝기 평균) 비교로 찾고 이음마다 고칠 수 있다(`src/lib/image/stitch-detect.ts`). 결과는 워커가 줄 묶음씩 그리고
        PNG·JPG는 직접 이어 써서 canvas 크기 한계(아이폰 약 1,670만 화소)에 묶이지 않는다(위 "큰 결과 저장"). 나누기·PDF는 빈 줄에서 자른다
  - [x] 자르기·회전 (`/image/crop/`, 2026-10-23): 한 장을 90°씩 돌리기·뒤집기·기울기 바로잡기(사진을 키워 귀퉁이를 채움)·비율 자르기.
        미리보기와 저장 워커가 같은 변환(`src/lib/image/crop-geometry.ts`)을 쓰고, 원본은 워커가 들고 있다
  - [x] 모자이크 (`/image/mosaic/`, 2026-10-23): 가릴 곳(사각형·타원)마다 모자이크·흐림·검게 칠하기. 흐림·작은 모자이크는
        되살릴 수 있다고 밝히고 검게 칠하기를 권한다. 미리보기와 워커가 같은 계산(`src/lib/image/mosaic-effects.ts`).
        얼굴 자동 찾기는 나중 (증명사진 얼굴 데이터의 받기 동의·용량)
  - [x] 글자 추출 (`/image/ocr/`, 2026-10-23): 여러 장에서 한국어·영어 글자를 읽어 복사·TXT. PDF 글자 인식과 엔진·데이터·받기 화면
        (`src/lib/ocr/OcrSetup.svelte`)을 같이 쓴다. 기울기(±20°)·눕힘을 바로 세우고 작은 글자는 키우며, 어두운 말풍선은 바탕을
        다시 그려 놓친 줄만 더한다(`src/lib/ocr/image-read.ts`). 손글씨·세로쓰기·원근 바로잡기는 하지 않는다
  - [x] HEIC를 모든 브라우저에서 (2026-10-23, 사용자가 LGPL·HEVC 특허 우려를 감수하고 결정): libheif-js(libheif+libde265
        WebAssembly)를 브라우저가 HEIC를 못 읽을 때만 워커에서 쓴다(`src/lib/image/heif.ts`). 엔진은 압축 전송 약 0.5MB라
        데이터 보관(동의) 없이 빌드 자산으로 필요할 때 받는다. 대표 그림만, irot·imir 적용, 8비트, P3 → sRGB.
        새 도구 HEIC JPG 변환(`/image/heic-to-jpg/`, 화면은 형식 변환과 같은 `ConvertTool`)과 형식 변환·자르기·모자이크·
        증명사진·이어 붙이기·이미지를 PDF로가 HEIC를 연다. LGPL 허가서·안내는 `scripts/copy-libheif-notice.mjs`가
        `public/vendor/libheif/`에 둔다. 압축·크기 조절·위치 정보 지우기는 아직 (docs/features/image-heic-to-jpg)
  - [x] 배경 제거 (`/image/remove-bg/`, 2026-10-23): 누른 곳(처음에는 가운데)의 물체를 MediaPipe MagicTouch(6.2MB, Apache-2.0)로
        나눠 남긴다. 엔진은 증명사진과 같은 파일이라 받아 둔 사람은 모델만 받는다(동의 이름 `cutout`). 지우개·되살리기 붓, 가장자리
        좁히기·넓히기·부드럽게, 투명 PNG·색 배경 JPG, 물체에 맞춰 자르기. 마스크를 원본 크기로 늘려 씌워 원본 크기로 저장한다
        (`src/lib/cutout/`). 모델 비교와 한계(머리카락·유리)는 docs/features/image-remove-bg
  - [x] 가이드 글 (`/guide/`, 2026-10-15): 검색 유입과 광고 심사용. 첫 6편 (PDF 압축·합치기·이미지로·서명,
        이미지 압축·크기 조절). 도구를 만들 때마다 그 도구의 가이드를 함께 쓴다
- [ ] 10단계: 텍스트·CSV 도구 (2026-10-23) — 카테고리 `text`(`/data/`는 데이터 파일 자리라 피함). 도구마다 멈추고 확인
  - [x] CSV 한글 깨짐 고치기 (`/text/csv-encoding/`): 인코딩 자동 판단(BOM·UTF-16·UTF-8·CP949·Windows-1252) + 직접 고르기,
        지금 열리는 모습·바꾼 뒤 미리보기 표, 엑셀용 UTF-8(BOM)·UTF-8·CP949로 저장, 줄바꿈. 워커가 조각씩 읽어 수백 MB도 된다
        (`src/lib/text/`). CP949 쓰기 표는 브라우저의 euc-kr 디코더로 만들고, 없는 글자는 ?로 바꿔 줄 번호와 알린다
- [ ] 11단계: 동영상 도구 (2026-10-24) — 카테고리 `video`. **ffmpeg.wasm 금지, 사이트가 무거워지면 안 된다** (사용자 철칙).
      GIF·장면 캡처는 브라우저 `<video>`·canvas로 풀고, frame CSP `media-src blob:`(동영상 frame만). 도구마다 멈추고 확인
  - 자르기·용량·소리 공통 `src/lib/video/` (docs/foundations/video-common): 풀기·저장은 브라우저 WebCodecs, 그릇(MP4·MOV·WebM·MKV)
    읽기·쓰기는 mediabunny(MPL-2.0, 버전 고정)만, 동영상 도구에서 파일을 열 때만 받는다. 열기·코덱 지원 확인·진행률·그만두기,
    결과는 Blob 조각. **격리 frame의 blob 워커에는 WebCodecs가 없어**(안전한 문맥 아님) frame 본문에서 돈다
  - [x] 자르기 (`/video/trim/`): 빠르게(다시 인코딩 없음, 앞 키프레임부터 담고 편집 목록으로 숨김)·정확하게(화면 다시 인코딩)
  - [x] 용량 줄이기 (`/video/compress/`): 해상도(원래·1080·720·480)·화질 또는 목표 용량, H.264 MP4(못 하면 VP9 WebM), 소리는 되도록 그대로
  - [x] 동영상을 GIF로 (`/video/to-gif/`): 구간(30초까지)·폭·초당 장면 수·색 수·디더링·반복, 예상 용량, 미리보기. 숨은 `<video>`로
        장면을 찾아가 뽑고(`src/lib/video-frames/`) 워커가 gifenc(MIT, 9KB)로 GIF(전체 색 표, 앞 장면과 같은 화소는 투명, 순서 디더링)
        또는 브라우저 WebP 장면을 직접 묶어 움직이는 WebP로 만든다(Safari는 WebP 저장 불가라 GIF만)
  - [x] 장면 캡처 (`/video/frame-capture/`): 지금 장면을 원래 크기 JPG·PNG로, 일정 간격(0.5~10초) 여러 장(200장까지)은 ZIP.
        1/30초 버튼·위치(초) 칸. 저장은 워커(OffscreenCanvas)
  - [x] 소리 추출 (`/video/extract-audio/`): 원래 소리 그대로(M4A·MP3·OGG·FLAC·WAV), WAV·M4A로 다시 저장. MP3 인코더는 브라우저에 없다
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

### 광고 심사 신청 전에 할 일

- [x] 소개, 개인정보처리방침, 이용약관, 문의 페이지 + 바닥글 링크 (2026-10-13)
- [x] 문의 메일: Cloudflare Email Routing으로 `contact@<도메인>` → 개인 메일 전달 (2026-10-13)
- [x] 검색 등록: Google Search Console, 네이버 서치어드바이저 + 사이트맵 제출 (2026-10-13)
- [x] 쿠키 없는 Cloudflare Web Analytics (2026-10-13). 대시보드의 자동 삽입은 Workers 배포에서
      들어오지 않아 "Enable with JS Snippet installation"으로 두고 코드에서 넣는다.
- 방문 통계: GA4 + Microsoft Clarity. **도구 영역은 Clarity 녹화에서 반드시 마스킹**하고,
  이벤트에는 파일 개수·크기 구간만 남긴다 (파일 이름·내용 금지). 쿠키 동의 배너와 함께 넣는다.
- 쿠키 동의 (2026-10-13 다시 정함): **우리 배너를 만들지 않는다.** 광고는 운영비라 모든 방문자에게 낸다.
  (2026-10-11에 정한 "전 세계 공통 배너 하나"는 거절하면 광고가 아예 없어져 버렸다)
  - 쿠키 사용은 개인정보처리방침에 밝힌다. 맞춤 광고 끄는 방법도 거기 있다
  - 유럽(EEA·영국·스위스)은 Google 인증 동의 도구가 필요하다: AdSense → 개인 정보 보호 및 메시지에서
    유럽 규정 메시지를 켠다 (사용자가 직접). 켠 뒤 `?fc=alwaysshow`로 동의 창이 우리 CSP에서 깨지지 않는지 확인
- GA4·Clarity는 미룬다 (2026-10-13). Cloudflare 통계로 부족할 때 넣는다. 쿠키를 쓰므로 그때 동의 방식을 다시 정한다.
- [x] AdSense 소유 확인 (2026-10-13): 메타 태그(`BaseLayout`)와 `ads.txt`(`src/pages/ads.txt.ts`)로 한다.
      게시자 ID는 `site.config.ts`의 `ads.adsenseClient`. 광고 스크립트로 확인하지 않는다 (동의 없이 쿠키를 쓰게 됨).
- [x] AdSense 스크립트 (2026-10-13): `AdsScript.astro`가 모든 바깥 페이지에서 불러온다. 바깥 페이지 CSP에
      Google 광고 주소와 `style-src-attr`를 허용한다. 자동 광고는 쓰지 않는다 (버튼 옆·전면 광고가 끼어듦).
  - `ads.enabled`가 스크립트·광고 칸·광고 차단 안내를 모두 켜고 끈다. 심사 중에는 켜 두고 `ads.slots`만 비워 둔다
  - **알려진 위험**: Google은 AdSense에 주소 허용 목록 방식의 CSP를 지원하지 않는다고 밝힌다 (주소가 바뀔 수 있음,
    nonce + `strict-dynamic` 권장: support.google.com/adsense/answer/16283098). 정적 사이트라 nonce를 쓸 수 없어
    지금은 허용 목록으로 두었고, 스크립트만 불러오는 지금 상태에서는 CSP 오류가 없다.
    광고 칸이나 유럽 동의 창을 켤 때 실제 브라우저 콘솔로 확인하고, 막히면 해시 + `strict-dynamic`
    (Astro `security.csp.scriptDirective.strictDynamic`)으로 바꾼다. 그때 우리 스크립트가 모든 브라우저에서 도는지 함께 확인
- [x] 광고 차단 안내 창 (2026-10-13): `AdblockNotice.astro`, `ads.adblockNotice`로 켜고 끈다.
  - 알아채는 법(`AdsScript`): 광고 스크립트를 받지 못함, 또는 미끼 칸이 숨겨짐
  - 뜨는 때: 어느 페이지든 열 때, 도구를 쓸 때마다 (파일 고르기·놓기, 실행·다운로드 막대의 버튼).
    frame이 내용 없는 `activity` 신호를 보낸다 (`src/frame/activity.ts` → `ToolFrame` → `toolactivity` 이벤트)
  - 언제든 닫을 수 있어야 하고(×, 닫기, Esc, 바깥 누르기) 닫아도 하던 일은 그대로 되어야 한다. 창 안에 광고 없음
  - "일부러 기다리게 하는 대기시간은 만들지 않는다"는 규칙의 예외로 사용자가 정했다. 방문자가 줄면 빈도를 낮춘다
  - 첫 심사 거절 뒤(2026-10-18) 심사 동안은 끈다 (`adblockNotice: false`, '과도한 팝업' 의심). 승인 뒤 다시 켜고 방침 시행일을 고친다
- 심사 통과 뒤: AdSense에서 광고 단위를 만들어 `ads.slots`에 넣고 `ads.enabled`를 켠다.
  `AdSlot`이 광고 단위를 실제로 그리는 코드(`<ins class="adsbygoogle">`)는 그때 만든다
- 광고를 켠 뒤 확인: 커서가 광고 iframe 위로 바로 들어와 그 위에 파일을 놓으면 광고 iframe이
  파일을 받을 수 있다 (우리 페이지는 끌기를 감지하지 못함). 광고 칸 위치·크기에서 이 경우를 검토할 것.
- [x] 로고·favicon·og:image (2026-10-14)

### 정한 것

- MVP 범위 (2026-10-11): PDF 보기·합치기·나누기·회전·정리. 편집은 첫 배포 뒤에 만든다.
  나머지 개선(예: 정리에 여러 파일 넣기)은 직접 쓰면서 필요할 때 하나씩 더한다.
- 도구는 기능별로 따로 만든다 (2026-10-11). "파일 먼저 올리고 기능 고르기" 통합 화면도 검토했지만,
  쓰지 않는 기능까지 불러와 무거워진다. 한 가지 일에 집중하고 가볍게 쓰는 것이 목적이다.
  통합 버전이 필요하면 나중에 별도 도구로 만들고, 공통 모듈(조립 워커·썸네일 등)을 재사용한다.
- pdf-lib: 원본(`pdf-lib`)은 2022년 이후 릴리스가 없어 관리되는 포크 `@cantoo/pdf-lib`를 쓴다.
  API가 원본과 같고, 원본에 없는 암호 PDF 열기(복호화)를 지원한다.
