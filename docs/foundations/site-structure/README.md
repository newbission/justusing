# 사이트 구조 (site-structure)

쓴 날 2026-10-16 · 고친 날 2026-10-24

- 범위: 도구 레지스트리·카테고리·묶음, 페이지 라우트, 레이아웃(`BaseLayout`·`ToolLayout`·`DocLayout`·`RailShell`),
  테마(다크 모드), 로고, 사이트 설정, 이용 권한(`canUse`)
- 상태: live (2026-10-10 골격, 2026-10-14 로고·글꼴, 2026-10-15 묶음·아이콘·이미지 카테고리, 2026-10-23 텍스트·CSV 카테고리)
- 관련 문서: [히스토리](./history.md), [격리 frame](../frame-isolation/README.md), [다국어](../i18n/README.md),
  [광고](../ads-and-analytics/README.md), [검색·가이드](../seo-and-guides/README.md),
  [`CLAUDE.md`](../../../CLAUDE.md)의 "도구 레지스트리"·"주소 구조"·"로고"·"화면·접근성"

## 1. 어떤 기반인지

사이트의 뼈대다. 도구 하나를 더할 때 **폴더 하나 + 레지스트리 한 줄**이면 홈·카테고리 목록·도구 페이지·
격리 frame 페이지·사이트맵·메뉴·관련 도구가 저절로 생기게 한다.

- 주소: `/`(허브) → `/pdf/`(카테고리) → `/pdf/merge/`(도구) → `/pdf/merge/frame/`(격리 frame). 영어는 앞에 `/en`
- 주소는 서브도메인이 아니라 경로로 나누고, 늘 끝 슬래시로 끝난다 (`trailingSlash: 'always'`)
- 지금 카테고리 4개(PDF 6묶음, 이미지 4묶음, 텍스트·CSV 1묶음, 동영상 3묶음), 모든 도구 `live`

## 2. 어떻게 만드는지

### 파일

| 파일                                                                                        | 역할                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/site.config.ts`                                                                        | 사이트명·도메인·언어별 설명/홈 제목·검색 소유 확인값·통계 토큰·광고 설정의 **유일한 출처**. `siteUrl`, `contactEmail`                                                |
| `src/tools/registry.ts`                                                                     | `TOOL_IDS`(노출 순서) → `tools`, `liveTools`, `getTool()`, `toolsInCategory()`, `sectionsInCategory()`, `visibleCategories`                                          |
| `src/tools/types.ts`                                                                        | `ToolMeta`(status·text(name·summary·title·description)·section·icon·related), `defineTool()`, `ToolContent`(uses·howTo·faq), `defineContent()`                       |
| `src/tools/categories.ts`                                                                   | `CATEGORIES`: 카테고리 이름·설명(언어별)과 묶음(`sections`, 순서 = 화면 순서)                                                                                        |
| `src/tools/common-faq.ts`                                                                   | 모든 도구 FAQ 맨 뒤에 붙는 공통 질문 2개 (업로드 여부, 광고가 있어도 안전한지)                                                                                       |
| `src/tools/paths.ts`                                                                        | `categoryPaths()`, `toolPaths()`: 한국어·영어 라우트가 함께 쓰는 `getStaticPaths`                                                                                    |
| `src/tools/<카테고리>/<이름>/`                                                              | 도구 하나: `meta.ts`, `content.ts`, `Frame.astro`, `App.svelte`, (`messages.ts`)                                                                                     |
| `src/pages/index.astro`                                                                     | 허브: 대표 문구, 가로 배너, 약속 카드(`Promises`), 움직이는 설명 그림(`LocalProcessing`), 안전 그림(`SafetyDiagram`), 카테고리별 도구 목록, 본문 광고                |
| `src/pages/[category]/index.astro`                                                          | 카테고리 목록 (`ToolSections`, 묶음별 소제목)                                                                                                                        |
| `src/pages/[category]/[tool].astro`                                                         | 도구 페이지: 넣는 것 → 나오는 것 그림(`ToolFlow`) + 가이드 보기·따라 하기 + `ToolFrame` + 쓰임새(`ToolUses`) + 사용법 + FAQ(도구 + 공통) + 관련 가이드 + 관련 도구   |
| `src/components/ToolFlow.astro`                                                             | 제목 아래 작은 그림. `meta.ts`의 `flow`(종이 종류·장수·표시)로 그린다. 없으면 안 그림 (PDF 보기)                                                                     |
| `src/pages/[category]/[tool]/frame.astro`                                                   | 격리 frame 페이지: 도구 폴더의 `Frame.astro`를 그대로 그린다                                                                                                         |
| `src/layouts/BaseLayout.astro`                                                              | 모든 바깥 페이지의 `<html>`·`<head>`(제목·설명·canonical·hreflang·OG·소유 확인), 머리글·바닥글, 통계·광고 스크립트, 하단 광고, 광고 차단 안내                        |
| `src/layouts/ToolLayout.astro`                                                              | 도구 페이지 틀: 브레드크럼 → 제목 → `top-banner` → 도구 칸 → 로컬 처리 안내 → `below-tool` → 쓰임새·사용법 → `in-content` → FAQ → 관련. WebApplication 구조화 데이터 |
| `src/layouts/DocLayout.astro`                                                               | 글 페이지 틀 (소개·방침·약관·문의·가이드): 위치 표시 → 제목 → 작은 글씨(시행일 등) → 배너 → 본문 → `after` 칸                                                        |
| `src/components/RailShell.astro`                                                            | 본문 폭·여백 + 넓은 화면(1400px 이상)에서 양옆 160px 세로 광고                                                                                                       |
| `src/components/Header.astro`, `Footer.astro`                                               | 로고·펼침 메뉴·언어 바꾸기·테마 버튼·☰ 버튼 / 글 페이지 링크                                                                                                        |
| `src/components/site-menu.ts`                                                               | `siteMenus(주소)`: 머리글 메뉴 목록. 카테고리마다 묶음별 live 도구(이름·`summary`·아이콘), 가이드는 카테고리별 글. 전체 보기 링크                                    |
| `src/components/MegaMenu.astro`                                                             | 768px 이상 펼침 메뉴: 버튼(`aria-expanded`) + 머리글 폭 판. 누르기·마우스 머무름(150ms)으로 열고 Esc·바깥 누르기·포커스 이탈로 닫음                                  |
| `src/components/MobileMenu.astro`                                                           | 768px 미만 ☰ 버튼 → 전체 화면 `<dialog>`(showModal) + 카테고리별 `<details name>` 아코디언                                                                          |
| `src/components/Breadcrumb.astro`                                                           | 위치 표시 + BreadcrumbList 구조화 데이터, 도구 페이지에서는 같은 카테고리 도구로 넘어가는 메뉴                                                                       |
| `src/components/ToolSections.astro`, `ToolGrid.astro`, `ToolCard.astro`, `ToolIcon.astro`   | 묶음별 목록·카드·아이콘. `soon` 도구는 '준비 중'으로 누를 수 없게                                                                                                    |
| `src/components/ToolHowTo.astro`, `ToolFaq.astro`, `RelatedTools.astro`, `ToolGuides.astro` | 도구 페이지 아래쪽 글                                                                                                                                                |
| `src/styles/tokens.css`, `global.css`                                                       | 색·글꼴·크기 토큰(라이트·다크), 전역 스타일, 본문 글꼴 Pretendard(글자 범위별 조각)                                                                                  |
| `src/lib/theme.ts`, `components/ThemeInit.astro`, `ThemeToggle.astro`                       | 테마 저장 키(`theme`), 그리기 전 적용(깜빡임 방지), 전환 버튼 + `themechange` 이벤트                                                                                 |
| `src/brand/logo.ts`                                                                         | 로고 모양·색의 유일한 출처 (`MARK`, `WORDMARK`, `markSvg()`, `lockupSvg()`)                                                                                          |
| `src/components/Logo.astro`, `src/pages/favicon.svg.ts`, `src/pages/brand/[name].svg.ts`    | 머리글 로고, favicon, 내려받기 SVG (`/brand/mark.svg` 등)                                                                                                            |
| `scripts/make-brand-images.mjs`                                                             | 로고 PNG·ICO(favicon, 홈 화면 아이콘, `og.png`, `/brand/*.png`)를 브라우저로 찍어 다시 만든다 (직접 돌리고 커밋)                                                     |
| `src/lib/entitlement.ts`                                                                    | `canUse(toolId, feature?)`. 지금은 늘 허용                                                                                                                           |
| `src/integrations/dev-preview.ts`, `src/dev/LayoutPreview.astro`                            | 개발 서버에서만 `/_dev/layout/` (도구 페이지 틀과 광고 자리 보기)                                                                                                    |
| `astro.config.mjs`                                                                          | `site`, `trailingSlash: 'always'`, `security.csp`, 워커 IIFE, 마크다운 코드 색칠 끔                                                                                  |

### 도구 하나가 페이지가 되는 흐름

1. `registry.ts`가 `import.meta.glob`으로 모든 `meta.ts`·`content.ts`를 읽고, `TOOL_IDS` 순서대로 `loadTool()`
2. `loadTool()`이 빌드를 멈추는 경우: `meta.ts` 없음, 없는 카테고리, `live`인데 `content.ts` 없음,
   `section`이 카테고리의 묶음에 없음. 그리고 `related`에 레지스트리에 없는 ID가 있으면 멈춘다
3. `paths.ts`가 `liveTools`·`visibleCategories`로 주소 목록을 만들고, 한국어(`src/pages/`)와 영어(`src/pages/en/`)
   라우트가 같은 목록을 쓴다
4. 도구 페이지는 `ToolFrame`으로 `<주소>frame/`을 sandbox iframe으로 띄운다. frame 페이지는
   `src/tools/<id>/Frame.astro`를 찾아 그린다 (없으면 빌드 오류)
5. 허브·카테고리 목록은 `sectionsInCategory()`로 묶음별로 나눠 그린다 (도구 없는 묶음은 뺀다)

새 도구를 더하는 순서는 [`CLAUDE.md`](../../../CLAUDE.md)의 "도구 레지스트리"를 따른다.

### 머리글 메뉴 (2026-10-23)

- 데스크톱(768px 이상): PDF·이미지·가이드 버튼. 누르거나 마우스를 150ms 머물면 머리글 아래로 판이 열린다. 마우스가 메뉴를 떠나면
  250ms 뒤 닫는다(판으로 내려가는 사이 닫히지 않게). 눌러서 연 판은 마우스가 떠나도 남는다. 다른 버튼에 올리면 바로 바뀐다
- 판은 `categories.ts` 묶음 순서로 칸을 나누고(`column-width: 260px`, 칸이 들어가는 만큼 늘어남), 도구마다 아이콘·이름·`summary`.
  가이드 판은 PDF 가이드·이미지 가이드(제목이 카테고리 가이드 페이지 링크)이고 묶음이 칸을 넘어 이어진다.
  판이 화면보다 길면 판 안에서 스크롤한다. 판 아래 '<카테고리> 도구 전체 보기 →' / '가이드 전체 보기 →'
- 키보드: 판은 버튼 바로 뒤에 있어 Tab이 판 안 링크를 차례로 지나고, 판 밖으로 나가면 닫힌다. Esc는 닫고 버튼으로 돌아간다
- 휴대폰(768px 미만, 하단 광고와 같은 기준): ☰ → 전체 화면 창. `showModal()`이라 맨 위 층에 떠서 하단 고정 광고보다 위에 있고
  뒤 화면을 누를 수 없다. 카테고리마다 `<details name="mobile-menu">`(한 번에 하나), 지금 페이지의 카테고리를 열어 둔다
- 메뉴·창 안에는 광고를 두지 않는다. 열고 닫아도 페이지 레이아웃은 움직이지 않는다(판은 겹쳐 뜬다)
- 한글은 `word-break: keep-all`로 낱말 단위로 줄을 바꾼다

### 테마

- 저장값(`localStorage`의 `theme`)이 있으면 `ThemeInit`이 `<head>`에서 `data-theme`을 붙이고, 없으면 OS 설정을 따른다
- 전환 버튼은 저장하고 `themechange` 이벤트를 낸다. 격리 frame은 `localStorage`를 못 읽으므로 바깥 `ToolFrame`이
  주소(`#theme=`)와 `postMessage`로 알려 준다 (→ [격리 frame](../frame-isolation/README.md))
- 색은 `tokens.css`의 토큰만 쓴다. 모노톤 + 포인트 1색(초록). 종이 바탕(`bb16c0b`), 자르기 막, 가리기 상자,
  종이 위 글자 같은 도구용 색도 토큰으로 더했다

### 성능 예산 (2026-10-24, 사용자 철칙: "사이트가 무거워지거나 느려지면 안 된다")

도구가 계속 늘어도 첫 화면이 무거워지지 않게, 페이지 종류별로 처음 받는 크기에 상한을 두고 E2E가 지킨다
(`tests/e2e/perf-budget.spec.ts`). 넘으면 CI가 실패한다.

**재는 법**: `npm run build` → `npx wrangler dev --port 8852` → `node scripts/perf/measure.mjs [--files] [경로...]`
(`PLAYWRIGHT_CHANNEL=chrome`). 크롬으로 열어 페이지가 가만해질 때까지 받은 우리 사이트 응답을 종류별로 모은다
(`tests/e2e/perf-measure.ts`). 바깥 페이지와 도구 frame(iframe)은 따로 센다. 크기는 응답을 직접 gzip한 값이고 글꼴(woff2)은 원본 크기다.
광고·통계 같은 외부 스크립트는 우리가 정할 수 없어 세지 않는다.

**잰 값 (2026-10-24, KB, gzip / 글꼴은 원본, 괄호는 고치기 전)**

| 페이지                        | HTML        | JS       | CSS  | 글꼴 | 요청수 |
| ----------------------------- | ----------- | -------- | ---- | ---- | ------ |
| `/` 홈 (바깥)                 | 22.8 (24.9) | 0        | 19.8 | 417  | 22     |
| `/pdf/` (바깥)                | 21.1 (23.2) | 0        | 17.2 | 401  | 20     |
| `/image/` (바깥)              | 19.5 (21.3) | 0        | 17.2 | 399  | 20     |
| `/text/` (바깥)               | 17.5 (19.3) | 0        | 17.2 | 352  | 17     |
| `/pdf/merge/` (바깥)          | 21.1 (22.9) | 2.2      | 19.2 | 411  | 24     |
| `/pdf/merge/` frame 첫 화면   | 13.4        | 39 (164) | 18.0 | 178  | 24     |
| `/image/ocr/` (바깥)          | 21.9 (23.6) | 2.2      | 19.2 | 331  | 21     |
| `/image/ocr/` frame 첫 화면   | 13.4        | 40       | 18.0 | 230  | 25     |
| `/guide/` (바깥)              | 20.7 (22.7) | 0        | 17.2 | 432  | 20     |
| `/guide/compress-pdf/` (바깥) | 20.4 (22.2) | 0        | 17.2 | 460  | 23     |
| `/safety/` (바깥)             | 23.8 (25.7) | 0        | 20.5 | 445  | 22     |

- 홈 HTML 원본은 159KB에서 121KB로 줄었다 (Astro 범위 속성 `data-astro-cid-*`가 아이콘·메뉴에 2,000번 넘게 붙어 있었다)
- 모든 PDF 도구(24개)의 frame 첫 화면 JS가 160KB대에서 40KB 안팎으로 줄었다 (pdf.js 126KB를 파일을 열 때 받는다)
- 큰 라이브러리(pdf.js·pdf-lib·Tesseract·libheif·MediaPipe)와 워커는 바깥 페이지에 없고, 도구 frame도 쓸 때만 받는다 (테스트가 확인)

**상한 정하는 법**: 상한 = 잰 값 + 여유 (HTML·CSS·JS 약 15%, 글자 수에 따라 달라지는 글꼴 약 25%). 값과 이유는 spec 주석에 적었다.
상한을 올려야 하면 먼저 줄일 방법을 찾고, 그래도 올리면 spec 주석과 PR 본문에 이유를 적는다.

**남은 무거운 곳**

- **글꼴이 가장 크다**: 한글 글꼴 조각(`PretendardVariable.subset.*`, 조각마다 20~37KB)을 한글 글자가 쓰인 만큼 받는다 (바깥 페이지 350~460KB,
  frame 180~230KB). frame은 출처 없는 sandbox라 브라우저 캐시를 못 써서 방문마다 다시 받는다. 사이트 글에 쓰인 글자만 모은 조각을
  따로 만드는 방법은 글이 늘면 커지고 효과가 불확실해 하지 않았다
- **frame HTML에 다른 도구의 CSS가 섞인다**: frame 페이지가 한 라우트(`[category]/[tool]/frame.astro`)에서 모든 도구의 `Frame.astro`를
  불러서 Astro가 모든 도구의 Svelte CSS(약 60KB 원본, gzip 약 9KB)를 모든 frame 페이지에 넣는다. 고치려면 도구마다 frame 라우트를
  따로 만들어야 해서 구조가 크게 바뀐다. 도구가 늘수록 커지니 frame HTML 상한(16KB)이 먼저 알려 줄 것이다
- 홈·안전 페이지의 HTML 약 50KB는 인라인 SVG(그림)다

### 결정과 이유

- **메뉴·아이콘 스타일은 전역 + 루트 클래스** (2026-10-24): `MegaMenu`·`MobileMenu`·`ToolIcon`은 모든 페이지에 수십~수백 개 요소가 있어
  Astro 범위 속성이 HTML을 크게 늘렸다. `<style is:global>`로 바꾸고 선택자를 `.mega`·`.mobile-menu-sheet` 아래로만 적용해 다른 곳과 겹치지 않게 했다.
  이런 반복 부품의 스타일을 새로 쓸 때도 같은 방식으로 한다 (일반 부품은 범위 스타일 그대로)
- **펼침 메뉴와 `summary`** (2026-10-23, 사용자 요청): 도구가 31개로 늘어 카테고리 링크만으로는 도구까지 두 번 이동해야 했다.
  검색용 `description`은 메뉴 칸에 길어 메뉴용 한 줄(`summary`, 한국어 25자·영어 40자 안팎, 하는 일만)을 필수로 더했다.
  모바일 판은 공간이 없어 이름만 보인다. 링크는 데스크톱 판과 모바일 창에 두 번 있지만 판은 `hidden`, 창은 닫혀 있어 화면 읽기에는 한 번만 보인다

- **도구마다 '넣는 것 → 나오는 것' 그림** (2026-10-19): 글을 읽기 전에 하는 일을 한눈에. 27개를 손으로 그리지 않고 `meta.ts`의 `flow`
  한 줄로 같은 부품이 그린다. 종이는 두 테마 모두 흰색, 나오는 쪽만 초록 테두리. 뜻은 제목·설명 글이 맡아 화면 읽기에서는 뺀다
- **레지스트리를 유일한 목록으로**: 홈·카테고리·사이트맵·메뉴·관련 도구가 한 목록에서 나와 어긋나지 않는다.
  잘못된 ID·묶음은 빌드에서 멈춰 배포 전에 잡는다
- **`TOOL_IDS`는 한 줄에 하나** (`prettier-ignore`): 도구를 더하는 커밋이 한 줄로 보이게 (`35709a2`)
- **묶음(`section`)과 아이콘** (PR #30, 2026-10-14): 도구가 늘어 목록이 길어져 소제목으로 나눴다. 아이콘은 24×24
  선 그림 `d` 값으로 도구끼리 한눈에 구분되게 한다
- **공통 FAQ를 한 곳에** (`1ad659f`): 업로드 여부·광고 안전성은 모든 도구의 핵심 질문이라 복사하지 않는다
- **모든 페이지 CSP** (`e95c228`): Astro `security.csp`로 페이지마다 CSP `<meta>`. 우리 스크립트·스타일은 해시로 허용된다.
  그래서 가이드 마크다운의 코드 색칠(inline style)을 껐다
- **본문 글꼴 Pretendard** (`d7e62dc`, 2026-10-14): 시스템 글꼴은 기기마다 달라 화면이 고르지 않았다. 글자 범위별 조각
  파일을 `/_astro/`로 함께 내보내 CDN 없이, 바깥 페이지와 격리 frame이 같은 파일을 쓴다
- **로고는 한 파일에서** (2026-10-14): 머리글·favicon·내려받기 SVG·PNG가 모두 `logo.ts`에서 그린다.
  **점핏(Jumpit)과 겹치지 않게**: 검정 네모 + 기울인 흰 j + 머리 위 초록 점이 점핏과 거의 같아서 점을 u 그릇 안으로
  옮기고, 줄기를 길게 하고, 기울기를 30°에서 15°로 줄였다(`5bfd919`). 글자 로고는 `justus.ing`, 마침표만 초록(`f5f0c84`)
- **허브의 약속 카드·안전 그림** (2026-10-11·13): 작은 글자 한 줄로는 장점이 전해지지 않고, 글로만 쓴 약속은 믿기
  어려워 카드 3개와 "파일이 기기를 떠나지 않음 / 광고가 파일을 볼 수 없음" 그림을 넣었다
- **이용 권한 한 곳** (`canUse`): 나중에 "광고 보고 고급 기능 해제" 같은 정책을 붙일 때 이 파일만 바꾼다.
  도구는 실행 전에 늘 거친다
- **배포처 변경 흔적**: 처음에는 GitHub Pages를 가정해 CNAME 생성·`preview.cors`를 넣었다가 CNAME 생성은 뺐다.
  지금 배포는 Cloudflare Workers 정적 배포이고, 미리보기는 `wrangler dev`로 한다 (`CLAUDE.md`). `astro.config.mjs`의
  GitHub Pages 주석은 그때 남은 것이다

- **쓰임새 칸과 FAQ 순서** (2026-10-18, 애드센스 첫 심사 거절 뒤): 도구 페이지 27개가 같은 틀(사용법 + 같은 공통 질문으로
  시작하는 FAQ)이라 '자체 콘텐츠가 거의 없는 페이지'로 보일 수 있었다. 도구마다 실제 상황 3개(`uses`)를 필수로 두고,
  FAQ는 도구 질문을 먼저 보인다. 그림은 넣지 않는다 (사이트를 가볍게, 그림은 가이드에서만 — 사용자 결정)

### 주의할 점

- 카테고리 ID는 주소 첫 경로다. `public/`의 폴더(`data`·`samples`·`vendor`)나 다른 페이지(`guide`·`en`·`brand` 등)와 겹치면 안 된다.
  텍스트 도구 카테고리를 처음에 `data`로 만들었다가 글꼴·OCR 데이터 자리(`/data/`)와 겹쳐 `text`로 바꿨다 (2026-10-23)
- 사이트명·도메인·메일 주소를 코드나 글에 직접 쓰지 않는다. `siteConfig`·`siteUrl`·`contactEmail`을 쓴다
  (안전 그림에 사이트명을 직접 써서 PR #17 리뷰에서 지적받고 고쳤다, `444ea03`)
- 새 바깥 페이지는 `BaseLayout`(+`RailShell`)을 쓰고 영어판도 만든다. `BaseLayout`이 hreflang을 모든 언어로 단다
- 새 글 페이지는 바닥글과 사이트맵에 직접 더한다
- 구조화 데이터 `<script type="application/ld+json">`은 레이아웃 **안**(슬롯)에 둔다. 밖에 두면 `<html>`보다 먼저 출력된다
- 로고를 바꾸면 `make-brand-images.mjs`로 PNG·ICO를 다시 만들어 커밋한다
- `soon` 상태는 목록에 '준비 중' 카드만 보이고 페이지는 만들지 않는다 (지금은 모든 도구가 `live`)
- 홈의 움직이는 설명 그림(`LocalProcessing`, 2026-10-23): 파일이 브라우저 안에서 처리되고 서버로 가는 길은 끊긴 모습. CSS 애니메이션으로
  보일 때 한 번(약 4초)만 움직이고 완성 그림에서 멈춘다('다시 보기'). 움직임 줄이기·스크립트 없음이면 완성 그림만 보인다.
  opacity·transform만 움직여 CLS 0, 광고 칸에서 떨어진 약속 카드 아래에 둔다
  - 2026-10-23: 그림 아래에 `/safety/#how-it-works` 링크를 단다. 격리까지 담은 네 장면짜리 그림(`SafetyMotion`)은 `/safety/`에만 두어 홈은 짧게 유지한다
    (→ [도구 격리 frame](../frame-isolation/README.md))

## 3. 구현 체크리스트

- [x] 사이트 설정 한 곳, 색·글꼴·크기 토큰, 전역 스타일
- [x] 레지스트리·카테고리·타입, 빌드 때 검증(파일·카테고리·content·section·관련 도구)
- [x] 허브·카테고리·도구·frame 라우트, 브레드크럼(+같은 분류 도구 메뉴)
- [x] 도구 페이지 틀(쓰임새·사용법·FAQ·공통 FAQ·관련 가이드·관련 도구), 글 페이지 틀
- [x] 묶음별 소제목, 도구 아이콘 (홈·카테고리)
- [x] 머리글 펼침 메뉴(데스크톱)·전체 화면 메뉴(휴대폰), 도구 `summary` (2026-10-23)
- [x] 다크 모드: OS 설정 + 전환 버튼 + 깜빡임 방지 + frame에 알리기
- [x] 본문 글꼴 Pretendard 직접 호스팅
- [x] 로고(심볼·글자), favicon·홈 화면 아이콘·og:image·내려받기 파일, 점핏과 겹치지 않게 수정
- [x] 모든 페이지 CSP
- [x] 성능 예산 E2E와 재는 도구, 큰 라이브러리를 쓸 때만 받기 (2026-10-24)
- [x] `canUse()` (늘 허용)
- [x] 개발용 `/_dev/layout/`
- [ ] `canUse()`에 실제 정책 붙이기 (계획만 있음)
- [ ] `astro.config.mjs`의 GitHub Pages 주석 정리 (동작과 상관없음)

## 4. 검증과 히스토리

### 자동 테스트

- `tests/e2e/category.spec.ts`
  - PDF 목록이 묶음별 소제목 아래 도구를 보여준다
  - 홈에서도 묶음별로 나누고, 영어판은 영어 소제목을 쓴다
- `tests/e2e/brand.spec.ts`
  - 로고·아이콘 파일(`/favicon.svg`, PNG, `/brand/...`)을 이미지로 내려준다
  - 페이지 머리말이 아이콘과 링크 미리보기 이미지를 가리킨다
  - 머리글 로고가 홈으로 가는 이름 있는 링크다
- `tests/e2e/menu.spec.ts`
  - PDF 버튼 → 묶음 순서 칸, 도구 이름·`summary`·아이콘, 전체 보기 링크, 지금 페이지 표시
  - 판에 카테고리의 모든 도구가 `summary`와 함께 있다 (카테고리 목록과 같은 주소들)
  - 키보드: Enter로 열기 → Tab으로 판 안 → Esc로 닫고 버튼으로, Tab으로 판 밖에 나가면 닫힘
  - 마우스 머무름으로 열기·다른 버튼으로 바꾸기·판 위에서 유지·떠나면 닫기, 눌러 연 판은 남고 바깥 누르기로 닫기
  - 가이드 판의 카테고리 묶음과 링크, 영어 메뉴
  - 휴대폰(390×844): ☰ → 화면 전체를 덮는 모달(`:modal`), 지금 카테고리 펼침, 아코디언 하나만, Esc·닫기 버튼 뒤 ☰로 포커스
- `tests/e2e/tool-pages.spec.ts`: 사이트맵의 모든 도구 페이지(한·영)에 쓰임새 3개가 사용법 앞에 있고, FAQ가 공통 질문이 아닌 도구 질문으로 시작한다
- `tests/e2e/home-motion.spec.ts`: 홈 설명 그림이 움직임 줄이기에서는 멈춘 완성 그림, 아니면 보일 때 움직여 완성 그림에서 멈춘다, 링크로 /safety/ 그림에 간다 (한·영)
- `tests/e2e/perf-budget.spec.ts`: 페이지 종류별(홈·카테고리 3·도구 2·가이드 2·안전) 바깥 페이지 크기 상한, 도구 frame 첫 화면 크기 상한,
  큰 라이브러리·워커·데이터가 바깥 페이지·도구 frame 첫 화면에 없음
- `tests/e2e/pages.spec.ts`: 바닥글에서 글 페이지로 간다 (→ [검색·가이드](../seo-and-guides/README.md))
- 각 도구 E2E가 도구 페이지·frame 라우트를 함께 거친다

### 직접 확인

- 2026-10-10: 빌드 결과에서 테마 전환·저장이 CSP 오류 없이 동작 (`e95c228` 본문)
- 화면을 바꾸면 390×844에서 버튼과 하단 광고 사이를 재 본다 (`CLAUDE.md` 광고 규칙)

### 히스토리

- [history.md](./history.md): PR #23(글꼴·로고), #26(점핏), #30(묶음·아이콘)과 커밋 109개
