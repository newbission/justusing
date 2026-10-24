# 도구 격리 frame (`src/frame/`, `ToolFrame`)

쓴 날 2026-10-16 · 고친 날 2026-10-23

- 쓰는 곳: 모든 도구 페이지 (`/<카테고리>/<이름>/` 안의 `/<카테고리>/<이름>/frame/`)
- 상태: 3단계(2026-10-10)부터 모든 도구의 바탕. Safari 수정은 PR #40 (2026-10-15)
- 관련 문서: [히스토리](./history.md), [글꼴·데이터 보관](../fonts-and-data/README.md),
  [광고·통계](../ads-and-analytics/README.md), [PDF 공통](../pdf-common/README.md), [이미지 공통](../image-common/README.md)

## 1. 무엇인지

광고·통계 스크립트는 바깥 페이지에서 돌아 화면의 PDF 글자·파일 이름을 읽을 수 있다.
그래서 **파일을 고르고, 보고, 처리하고, 받는 일은 모두 출처 없는(sandbox) iframe 안에서만** 한다.

- 바깥 페이지(`[category]/[tool].astro`)가 `ToolFrame`으로 frame 페이지(`[category]/[tool]/frame.astro`)를 띄운다
- iframe `sandbox="allow-scripts allow-downloads"` (allow-same-origin 없음) → frame 출처는 `null`
  - 바깥 스크립트는 frame 안을 못 보고, frame도 바깥·사이트 저장소(`localStorage` 등)에 못 닿는다
- frame CSP: `default-src 'none'`. 우리 사이트 파일 읽기만 허용, 외부 연결은 도구 코드 자신도 못 한다
- 바깥과 frame 사이에는 **내용 없는 신호만** 오간다 (테마, 끌기, 스크롤, 도구 사용)

하지 않는 것·한계

- 개발 서버(`npm run dev`)에서는 격리와 CSP가 꺼져 있다. 격리 상태는 빌드 결과(`npm run preview`, E2E)에서만 보인다
- frame 안에서는 `localStorage`·form 제출·`style=""` 속성·`scrollIntoView`·일반 `new Worker()`를 쓸 수 없다 (아래 "주의할 점")
- 광고를 켠 뒤, 커서가 광고 iframe 위로 바로 들어와 그 위에 파일을 놓으면 광고 iframe이 받을 수 있다 (우리 페이지는 끌기를 못 봄).
  광고 칸 위치·크기를 정할 때 검토할 일로 남아 있다 (CLAUDE.md)

## 2. 어떻게 만드는지

### 파일

| 파일                                      | 역할                                                                                                                    |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `src/components/ToolFrame.astro`          | 바깥: iframe(sandbox, `allow="fullscreen"`), 높이 고정, 테마 전달, 끌기 때 화면 전체로 넓히기, 신호 받기, `serveData()` |
| `src/frame/FrameLayout.astro`             | frame 문서 틀: CSP, `<html lang>`, 테마 적용 스크립트, `setupFrameDrop()`·`setupFrameActivity()`                        |
| `src/pages/[category]/[tool]/frame.astro` | 레지스트리에서 frame 페이지를 만들고 도구의 `Frame.astro`를 그린다                                                      |
| `src/tools/<카테고리>/<이름>/Frame.astro` | `FrameLayout` 안에 `App.svelte`를 `mount`                                                                               |
| `src/lib/worker.ts`                       | `createWorker(url)`: 워커 스크립트를 받아 blob URL 클래식 워커로 띄운다                                                 |
| `src/frame/drop.ts`                       | frame 전체를 놓는 곳으로: 덮개, 크기 고정, `onFrameFiles()`                                                             |
| `src/components/DropGuard.astro`          | 바깥 페이지 `<head>` 맨 앞: 바깥에 놓인 파일을 다른 스크립트가 받지 못하게 막는다 (`BaseLayout`)                        |
| `src/frame/activity.ts`                   | 파일 고르기·놓기, 실행 막대 버튼 → 내용 없는 `activity` 신호                                                            |
| `src/frame/parent.ts`                     | `requestShowTool()`(`show-tool`), `notifyActivity()`(`activity`)                                                        |
| `src/frame/locale.ts`                     | `frameLocale`, `pick()`: `<html lang>`으로 언어를 고른다                                                                |
| `src/frame/messages.ts`                   | frame 공통 부품 문구 (한·영)                                                                                            |
| `src/frame/FileDrop.svelte`               | 첫 화면 파일 고르기 버튼 (놓기는 하지 않는다), 견본이 있으면 '예시 파일로 해 보기'                                      |
| `src/frame/samples.ts`                    | 도구별 견본 목록, `hasSamples`, `loadSamples()`: frame이 `/samples/<언어>/`에서 바로 받는다                             |
| `src/frame/tour.ts`                       | 따라 하기 (주소 `#tour=1`인 화면에서만): 견본을 넣고 사용법을 한 단계씩, 누를 곳만 밝게 비추고 번호를 단다              |
| `src/components/TourButton.astro`         | 도구 제목 아래 '예시로 따라 하기' (바깥): 어두운 배경 위 창에 도구 화면을 하나 더 연다. ×·Esc·마치기로 닫으면 비운다    |
| `scripts/samples/make_samples.py`         | 견본 파일 만들기 (PyMuPDF·Pillow, Pretendard). 결과 `public/samples/`는 커밋한다                                        |
| `src/frame/ActionBar.svelte`              | 실행·다운로드 막대. 높이 64px 고정, `data-action-bar`(activity가 본다)                                                  |
| `src/frame/download.ts`                   | `downloadFile()`: Blob URL + `<a download>`, 60초 뒤 해제                                                               |
| `src/frame/controls.css`, `format.ts`     | 공통 조작 모양, `formatSize()`·`baseName()`                                                                             |
| `src/frame/data.ts`                       | 도구 데이터(글꼴·OCR)를 바깥 보관소에서 받기 → [글꼴·데이터 보관](../fonts-and-data/README.md)                          |
| `src/lib/zip.ts` + `zip.worker.ts`        | 여러 결과를 ZIP 하나로 (워커)                                                                                           |
| `public/_headers`                         | `/_astro/*`, `/vendor/*`에 `Access-Control-Allow-Origin: *`                                                             |
| `wrangler.jsonc`                          | Cloudflare 정적 배포 설정 (`npm run preview`·E2E도 `wrangler dev`)                                                      |
| `astro.config.mjs`                        | `security: { csp: true }`, `worker: { format: 'iife' }`                                                                 |

### frame CSP (`FrameLayout.astro`)

| 지시어                    | 값                                                | 이유                                             |
| ------------------------- | ------------------------------------------------- | ------------------------------------------------ |
| `default-src`             | `'none'`                                          | 그 밖은 모두 막는다                              |
| `connect-src`             | `'self'` + 사이트 주소 + `www.` 주소              | 우리 사이트 파일(워커 스크립트·CMap 등)만 받는다 |
| `worker-src`              | `blob:`                                           | `createWorker()`가 blob URL로 띄운다             |
| `img-src`                 | 사이트 + `blob:` `data:`                          | 썸네일·미리보기                                  |
| `font-src`                | 사이트 + `data:`                                  |                                                  |
| `media-src`               | `blob:` (동영상 카테고리 frame만)                 | 고른 동영상을 `<video>`로 연다. 다른 도구는 막힘 |
| `script-src`              | `'self'` + 사이트 + `'wasm-unsafe-eval'`          | pdf.js 등이 WebAssembly를 쓴다 (eval은 금지)     |
| `style-src`               | `'self'` + 사이트 (+ Astro가 넣는 `<style>` 해시) |                                                  |
| `form-action`, `base-uri` | `'none'`                                          |                                                  |

- CSP를 걸 수 없으면(`Astro.csp` 없음) 배포 빌드를 멈춘다

### 바깥 ↔ frame 신호 (`postMessage`, 대상 `'*'`, 내용 없음)

| 방향         | 신호                                                  | 뜻                                                                      |
| ------------ | ----------------------------------------------------- | ----------------------------------------------------------------------- |
| 바깥 → frame | 주소 `#theme=light\|dark`, `{ type: 'theme', theme }` | 테마. frame은 `localStorage`를 못 읽는다                                |
| 바깥 → frame | `{ type: 'drag-start', width, height }`               | 파일 끌기 시작, 지금 크기                                               |
| frame → 바깥 | `drag-ready`, `drag-request`, `drag-end`              | 넓혀도 됨 / 칸 안에서 시작된 끌기 / 끝                                  |
| frame → 바깥 | `tour-end`                                            | 따라 하기를 마쳤으니 창을 닫아 달라 (TourButton)                        |
| frame → 바깥 | `show-tool`                                           | 파일을 열었으니 도구 칸이 화면을 채우게 스크롤해 달라                   |
| frame → 바깥 | `activity`                                            | 도구를 쓰는 순간 (광고 차단 안내가 `toolactivity`로 듣는다)             |
| frame ↔ 바깥 | 데이터 요청·응답                                      | 우리 공개 파일 경로만 ([글꼴·데이터 보관](../fonts-and-data/README.md)) |

- 받는 쪽은 `event.source`가 그 frame(또는 `parent`)인지 먼저 본다

### 파일 끌어다 놓기 흐름

1. 바깥에서 `dragenter`(Files) → `ToolFrame`이 frame에 `drag-start`(지금 크기)를 보낸다
2. frame(`drop.ts`)이 덮개("여기에 놓으세요")를 덮고 `#frame-root`를 그 크기로 고정한 뒤 `drag-ready`
3. 바깥이 iframe에 `data-drag-active`를 붙여 `position: fixed; inset: 0`으로 화면 전체를 덮는다 (자리는 바깥 상자가 지킨다)
   - 500ms 안에 응답이 없으면 넓히지 않는다 (바깥에 놓여도 `DropGuard`가 막는다)
4. 커서가 바깥을 거치지 않고 칸 안으로 바로 오면 frame의 `dragover`가 덮개를 덮고 `drag-request`를 보낸다
5. 놓으면 `framefiles` 이벤트 → 도구는 `onFrameFiles(files => …)`로 받는다
6. 끝: 덮개의 `dragleave`(창 밖으로 나감·취소) 또는 `dragover`가 1.5초 끊김(안전장치) → `drag-end`
   → 바깥이 먼저 줄이고, frame은 `resize`(또는 150ms) 뒤에 덮개를 걷고 고정을 푼다

### 워커 띄우기 (`createWorker`)

- 출처 없는 frame에서 `new Worker('/x.js')`는 막힌다. 스크립트를 `fetch`해 blob URL로 클래식 워커를 띄운다
- 워커는 Vite가 IIFE 한 파일로 번들한다 (`worker.format: 'iife'`). 사용: `import url from './x.worker.ts?worker&url'`
- 개발 서버는 워커를 ES 모듈로 내려줘 클래식 워커로는 `import` 오류가 난다. 개발 중(격리 꺼짐)에는 `type: 'module'`로 바로 띄운다
- blob URL은 해제하지 않는다 (워커가 비동기로 읽어 바로 해제하면 실패할 수 있다, 도구마다 워커는 몇 개뿐)
- 워커 안의 상대 주소는 blob 기준이라 쓸 수 없다. 보조 파일은 절대 주소로 넘긴다 (예: pdf.js CMap, `pdfjs.ts`의 `assetUrl`)

### 도구 칸 높이·스크롤

- 높이는 바깥 상자 `.tool-frame-box`가 잡는다: `clamp(520px, 100svh - 32px, 1400px)`. 처리 전후로 바깥 레이아웃(광고)이 밀리지 않는다
- 767px 이하에서 하단 고정 광고가 있으면 광고 높이·테두리·접기 탭(28px)·safe-area만큼 더 줄인다 (최소 440px)
- `show-tool`을 받으면 칸 위쪽을 화면 위 16px에 맞춰 **바로**(instant) 옮긴다
- frame 안의 스크롤은 도구가 스크롤 영역의 `scrollTop`을 직접 바꾼다 (`scrollIntoView`는 바깥까지 스크롤한다)

### 방문자에게 보여 주는 설명 그림 (`SafetyMotion`, 2026-10-23)

`/safety/`(영어 `/en/safety/`)의 첫 문단 다음에 이 문서의 격리를 네 장면으로 보여 주는 움직이는 그림이 있다
(`src/components/SafetyMotion.astro` 틀·재생, `SafetyMotionArt.astro` 장면 그림, 문구는 `src/i18n/ui.ts`의 `safetyMotion`).
홈의 `LocalProcessing` 아래 링크(`/safety/#how-it-works`)로 들어온다.

| 장면    | 그림                                                                                                                                          | 맞춰 둔 코드                                          |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 두 칸   | 바깥 페이지(광고·방문 통계)와 도구 칸, 바깥 스크립트가 파일 쪽으로 손을 뻗다 칸 벽에 막힌다                                                   | `ToolFrame`(sandbox, 출처 null)                       |
| 막는 법 | `sandbox="allow-scripts allow-downloads"`, `default-src 'none'; connect-src 'self'`, 다른 사이트 연결 ✕, 이 사이트 파일만 들어옴              | `ToolFrame`, `FrameLayout`의 CSP                      |
| 처리    | 파일을 끌고 들어오면 도구 칸이 창 전체로 넓어져 받고, 작업자(Web Worker)가 처리. 이 사이트에서는 처리 프로그램만 받고 파일을 보내는 길은 없다 | `ToolFrame` 끌기, `DropGuard`, `createWorker`         |
| 받기    | 결과가 도구 칸에서 곧장 다운로드 폴더로, 바깥 페이지·인터넷을 거치지 않음. 그 뒤는 기기 보안에 달림                                           | `download.ts`(blob), `/safety/`의 '약속할 수 없는 것' |

- 격리나 끌기·다운로드 동작을 바꾸면 이 그림과 장면 글도 같이 고친다. 과장하지 않는다 (기기 보안·사용자가 다른 곳에 올리는 것은 약속하지 않음)
- 장면 3의 '어디에 놓든 도구 칸이 받는다'는 광고 칸이 비어 있는 지금 기준이다. 광고 칸을 켜면 광고 iframe 위에 바로 놓인 파일(위 "하지 않는 것·한계")을 검토하면서 이 글도 다시 본다
- 한 칸에 장면을 겹쳐 두어 장면을 바꿔도 높이가 같다 (CLS 0). 장면 고르기는 라디오 버튼이라 스크립트 없이도 된다
- 본문의 `<script is:inline>`은 쓰지 않는다: Astro CSP는 `<head>`의 meta로 걸리고 인라인 스크립트 해시를 넣지 않아 막힌다
  (`DropGuard`·테마 스크립트는 meta보다 앞에 있어 괜찮다). 그래서 레이아웃은 CSS만으로 정한다
- 화면에 보일 때만 움직이고 마지막 장면에서 멈춘다. 일시정지 버튼(WCAG 2.2.2), 움직임 줄이기면 네 장면을 멈춘 그림 + 글로 차례로 보인다
- 장면 길이는 장면 버튼의 진행 막대 애니메이션이 정한다 (막대가 다 차면 다음 장면, 일시정지하면 막대도 멈춤)

### 결정과 이유

- 격리 iframe (2026-10-10): 광고·통계 스크립트가 같은 페이지에서 파일 내용을 읽을 수 있어서. 광고는 바깥에서 처리 중에도 그대로 보인다
- 끌기 때 frame을 화면 전체로 넓힘 (`4fe26ca`): 어디에 놓든 파일이 격리 frame으로 들어가게. 바깥이 아는 것은 "끌고 있다"뿐이다
- 넓히는 순서를 "frame이 크기 고정 → 응답 → 넓힘"으로 (`9ca6113`): 넓어질 때 안의 PDF 화면이 늘어나 다시 그려지던 것을 막았다
- 끌기 끝 판단을 덮개의 `dragleave`로 (`d83b2c5`): 0.4초 끊김 기준은 늦고, 브라우저가 최대 0.55초 간격으로 `dragover`를 보내 끌던 중에 끝날 위험도 있었다
- 스크롤을 부드럽게 하지 않음 (`a94cd94`): 움직이는 동안 버튼이 손 아래에서 움직여 엉뚱한 것이 눌렸다
- 칸 높이를 화면 높이에 맞춤 (`fb593bd`): 80svh로는 PDF가 반 쪽만 보였다
- 휴대폰 첫 화면 파일 선택 버튼은 칸 위쪽에 (`2ad0972`): 가운데 두면 하단 고정 광고와 약 70px까지 가까워졌다 (390×844)
- CORS 헤더 (`a5bc972`): 출처가 null이라 우리 스크립트·워커·CMap도 CORS 허용이 필요하다. GitHub Pages는 모든 응답에 붙였지만 Cloudflare는 붙이지 않는다. `/_astro/*`, `/vendor/*`에만 붙인다 (공개 파일)
- 미리보기·E2E는 `wrangler dev`: `astro preview`는 CORS 헤더를 저절로 붙여 배포에서만 깨지는 문제를 가린다
- Safari 주소 허용 (PR #40): 아래 "주의할 점"
- 예시 파일 (2026-10-19): 내 파일이 없어도 써 보게 견본을 넣는다. 다섯 첫 화면이 모두 `FileDrop`을 쓰므로 버튼을 거기 하나만 두고, 도구는 frame 주소에서 읽는다(도구마다 고칠 곳 없음).
  견본은 공개 파일이라 바깥 보관소를 거치지 않고 frame이 바로 받는다 (`/samples/*` CORS). 내용은 모두 지어낸 것이고, 암호 견본은 파일 이름에 암호(0000)를 적어 암호 입력 화면에 파일 이름을 보인다.
  견본을 받는 사이 사용자가 파일을 넣으면(놓기·고르기·도구 안 파일 추가) 늦게 온 견본은 버린다: 모든 길이 `announceFiles()`(내용 없는 이벤트)를 알리고,
  `FileDrop`·따라 하기가 `onFilesArrived()`로 듣는다 (따라 하기는 파일 input의 `change`도 듣는다)
- 따라 하기 (2026-10-19, 다시 만듦): 처음에는 원래 도구 화면 안에서 돌렸는데, 끌 수 없어 원래 기능으로 돌아가기 어렵고 강조도 약했다(사용자 피드백).
  그래서 도구 페이지 위에 창을 띄우고 그 안에 도구 화면을 하나 더 연다(`#tour=1`). 창을 닫으면 그 화면과 견본이 사라지고 원래 화면은 그대로다.
  누를 곳 밖은 어둡게 덮고(구멍 둘레 그림자, 누르는 것은 막지 않음) 단계 번호를 단다. 누를 곳: 단계 글의 따옴표 버튼 이름 → 단계 글에 이름이 나오는
  고르기 묶음 → 버튼 이름이 없는 단계는 작업 영역(가장 넓은 스크롤 영역). 이름이 있는데 못 찾으면 나중에 나타날 버튼이라 기다린다.
  단계 글은 frame 페이지에 빌드 때 넣은 그 도구의 사용법만 쓴다 (바깥의 광고 스크립트가 글을 꾸미지 못하게). 바깥에서 받는 신호는 없다.
  창 안 도구 화면도 같은 격리 frame이다. 저절로 열지 않는다 ('과도한 팝업' 위험)
- activity 신호 (`7d3a9e9`): 바깥은 frame 안 클릭을 볼 수 없다. 광고 차단 안내를 도구를 쓸 때마다 띄우려면 frame이 알려야 한다. 내용은 담지 않는다

### 주의할 점

- **Safari(WebKit)는 출처 없는 sandbox 문서에서 CSP `'self'`를 우리 사이트로 보지 않는다.** `'self'`만 적으면 워커·스타일·글꼴·CMap이 모두 막힌다.
  그래서 사이트 주소(`siteUrl`)와 `www.` 주소를 함께 적는다. 크롬 E2E로는 보이지 않는다
- Astro `insertScriptResource`·`insertStyleResource`는 하나라도 넣으면 기본값(`'self'`, `<style>` 해시)을 대신한다. **`'self'`를 먼저 직접 넣는다** (빠지면 PDF 보기 화면이 깨졌다, `0de1999`)
- frame 안에서:
  - 워커는 `createWorker()`로만 띄운다
  - `<form>` 제출을 쓰지 않는다 (sandbox에 allow-forms 없음). 버튼 클릭·Enter 키로 처리한다 (예: `SinglePdfTool`의 암호 입력)
  - HTML `style="…"` 속성 금지 (CSP). CSS 클래스나 Svelte `style:`을 쓴다. 스크립트에서 `element.style`을 바꾸는 것은 된다 (`drop.ts`의 크기 고정)
  - 파일 놓기를 도구가 직접 받지 않는다. `onFrameFiles()`로만 받는다
  - 외부 리소스가 필요하면 우리 사이트에 복사해 둔다 (예: `scripts/copy-pdfjs-assets.mjs` → `public/vendor/pdfjs/`)
- frame에서 쓰는 새 공개 경로를 만들면 `public/_headers`에 CORS가 필요한지 본다 (`/_astro/`·`/vendor/`·`/samples/`가 있다. 도구 데이터 `/data/`는 바깥 페이지가 받아 넘긴다)
- 신호에 파일 이름·내용을 절대 담지 않는다. 광고 차단 안내도 신호의 종류만 본다
- 도구를 만들면 반드시 `npm run build` 후 `npm run preview` 또는 `npm run test:e2e`로 확인한다 (form 제출이 막히는 문제는 개발 서버에서 보이지 않았다)

## 3. 구현 체크리스트

- [x] sandbox iframe(`ToolFrame`), frame 페이지 틀(`FrameLayout`), 레지스트리로 frame 페이지 만들기
- [x] frame CSP, 배포 빌드에서 CSP가 없으면 빌드 멈춤
- [x] `createWorker()` (배포: blob 클래식 워커, 개발: 모듈 워커)
- [x] 테마 전달 (주소 해시 + `postMessage`)
- [x] 파일 끌기 때 화면 전체로 넓히기, 칸 안에서 시작한 끌기, 덮개 `dragleave`·1.5초 안전장치
- [x] `DropGuard` (바깥에 놓인 파일 막기)
- [x] 칸 높이 고정(화면 높이 기준, 모바일 하단 광고 반영), 파일을 열면 칸으로 스크롤
- [x] 전체 화면 허용 (`allow="fullscreen"`)
- [x] 다운로드 도우미, ZIP 워커, 실행 막대, 공통 조작 모양
- [x] activity 신호 (광고 차단 안내)
- [x] 예시 파일로 해 보기 (`samples.ts`, `public/samples/`)
- [x] 예시로 따라 하기 (`tour.ts`, `TourButton`)
- [x] `_headers` CORS, `wrangler dev`로 미리보기·E2E
- [x] Safari: CSP에 사이트 주소 함께 적기 (스크립트·연결·이미지·글꼴·스타일)
- [x] 도구 데이터를 바깥 보관소에서 받기 (`data.ts`, [글꼴·데이터 보관](../fonts-and-data/README.md))
- [ ] Safari·WebKit을 E2E에 넣기 — 지금 `playwright.config.ts`는 chromium만 돈다
- [ ] 광고를 켠 뒤 광고 iframe 위에 바로 놓인 파일 검토 (CLAUDE.md "광고를 켠 뒤 확인")

## 4. 검증과 히스토리

### 자동 테스트

- `tests/e2e/tour.spec.ts`: 창 안에서 견본으로 따라 하기(누를 곳 비추기·나중에 나타나는 버튼·작업 영역), 마치기·×·Esc로 닫으면 원래 화면 그대로, 다시 열면 처음부터, 견본 실패·늦은 견본, 모든 도구, 영어
- `tests/e2e/samples.spec.ts`: 모든 도구에서 예시 파일을 넣어 첫 화면을 지나는지, 영어 화면은 영어 견본인지
- `tests/e2e/pdf-view.spec.ts`
  - 도구 화면은 출처 없는 격리 frame이다 (`self.origin === 'null'`, 서로의 DOM 접근이 막힘)
  - 도구 화면 안에서 외부 연결(`fetch('https://example.com/')`)은 CSP가 막는다
  - 한글 PDF가 그려진다 (CMap을 우리 사이트에서 받음)
  - PDF를 열면 도구 칸 위쪽이 화면 위 16px에 오고 칸 아래가 화면 안에 들어온다
  - 격리 frame 안에서 전체 화면으로 볼 수 있다
  - 방문 통계 스크립트는 바깥 페이지에만 있고 도구 frame에는 없다
- `tests/e2e/drop.spec.ts`
  - 바깥 페이지에 놓은 파일은 나중에 붙은 스크립트(window·document 리스너)가 받지 못한다
  - 파일을 끌어오면 도구 화면이 화면 전체로 넓어지고, 놓으면 열린 뒤 원래대로 돌아온다
  - 도구 칸 안으로 바로 끌어와도 넓어진다
  - 끌다가 창 밖으로 나가면 바로 원래 크기로 돌아온다
  - 끌기 신호가 끊기면 안전장치로 원래 크기로 돌아온다
- `tests/e2e/safety-motion.spec.ts`: /safety/ 설명 그림이 한 장면씩 보이고 장면 버튼·일시정지·재생, 진행 막대가 차면 다음 장면,
  마지막 장면에서 '처음부터 다시 보기', 움직임 줄이기면 네 장면을 차례로 (한·영)
- `tests/e2e/adblock.spec.ts`: 광고 스크립트는 바깥에만 있다, 도구 frame이 보내는 `activity` 신호에는 내용이 없다
- 모든 도구 E2E: `tests/e2e/local-only.ts`의 `expectLocalOnly()` — frame 요청은 우리 사이트로 가는 본문 없는 GET뿐,
  모든 요청(우리 사이트로 가는 GET 포함)의 주소·본문에 테스트 파일 이름·형식 첫머리·내용 일부가 없다
  (2026-10-18 PR #87 리뷰: 같은 출처 GET 주소에 실어 보내는 회귀를 놓쳤다)
- E2E는 빌드 결과를 `wrangler dev`(포트 8788)로 띄워 돈다 (`playwright.config.ts`)

### 직접 확인

- 2026-10-15: 아이폰·맥 Safari에서 PDF·이미지 도구가 모두 처리에 실패한 것을 발견 (`3234493`).
  WebKit에서 `/_astro/*.css`가 `style-src`로 막히는 것을 확인했고, 사이트 주소를 더하자 적용됐다 (PR #40 리뷰 답글)
- 2026-10-11: Cloudflare로 옮기면 CORS 헤더가 없어 도구가 뜨지 않는 것을 `wrangler dev`로 재현 (`a5bc972`)

### 히스토리

- [history.md](./history.md): PR·커밋·리뷰 지적과 처리
