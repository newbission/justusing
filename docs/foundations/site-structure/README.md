# 사이트 구조 (site-structure)

쓴 날 2026-10-16 · 고친 날 2026-10-18

- 범위: 도구 레지스트리·카테고리·묶음, 페이지 라우트, 레이아웃(`BaseLayout`·`ToolLayout`·`DocLayout`·`RailShell`),
  테마(다크 모드), 로고, 사이트 설정, 이용 권한(`canUse`)
- 상태: live (2026-10-10 골격, 2026-10-14 로고·글꼴, 2026-10-15 묶음·아이콘·이미지 카테고리)
- 관련 문서: [히스토리](./history.md), [격리 frame](../frame-isolation/README.md), [다국어](../i18n/README.md),
  [광고](../ads-and-analytics/README.md), [검색·가이드](../seo-and-guides/README.md),
  [`CLAUDE.md`](../../../CLAUDE.md)의 "도구 레지스트리"·"주소 구조"·"로고"·"화면·접근성"

## 1. 어떤 기반인지

사이트의 뼈대다. 도구 하나를 더할 때 **폴더 하나 + 레지스트리 한 줄**이면 홈·카테고리 목록·도구 페이지·
격리 frame 페이지·사이트맵·메뉴·관련 도구가 저절로 생기게 한다.

- 주소: `/`(허브) → `/pdf/`(카테고리) → `/pdf/merge/`(도구) → `/pdf/merge/frame/`(격리 frame). 영어는 앞에 `/en`
- 주소는 서브도메인이 아니라 경로로 나누고, 늘 끝 슬래시로 끝난다 (`trailingSlash: 'always'`)
- 지금 카테고리 2개(PDF 6묶음, 이미지 2묶음), 도구 24개 모두 `live`

## 2. 어떻게 만드는지

### 파일

| 파일                                                                                        | 역할                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/site.config.ts`                                                                        | 사이트명·도메인·언어별 설명/홈 제목·검색 소유 확인값·통계 토큰·광고 설정의 **유일한 출처**. `siteUrl`, `contactEmail`                                                |
| `src/tools/registry.ts`                                                                     | `TOOL_IDS`(노출 순서) → `tools`, `liveTools`, `getTool()`, `toolsInCategory()`, `sectionsInCategory()`, `visibleCategories`                                          |
| `src/tools/types.ts`                                                                        | `ToolMeta`(status·text·section·icon·related), `defineTool()`, `ToolContent`(uses·howTo·faq), `defineContent()`                                                       |
| `src/tools/categories.ts`                                                                   | `CATEGORIES`: 카테고리 이름·설명(언어별)과 묶음(`sections`, 순서 = 화면 순서)                                                                                        |
| `src/tools/common-faq.ts`                                                                   | 모든 도구 FAQ 맨 앞에 붙는 공통 질문 2개 (업로드 여부, 광고가 있어도 안전한지)                                                                                       |
| `src/tools/paths.ts`                                                                        | `categoryPaths()`, `toolPaths()`: 한국어·영어 라우트가 함께 쓰는 `getStaticPaths`                                                                                    |
| `src/tools/<카테고리>/<이름>/`                                                              | 도구 하나: `meta.ts`, `content.ts`, `Frame.astro`, `App.svelte`, (`messages.ts`)                                                                                     |
| `src/pages/index.astro`                                                                     | 허브: 대표 문구, 가로 배너, 약속 카드(`Promises`), 안전 그림(`SafetyDiagram`), 카테고리별 도구 목록, 본문 광고                                                       |
| `src/pages/[category]/index.astro`                                                          | 카테고리 목록 (`ToolSections`, 묶음별 소제목)                                                                                                                        |
| `src/pages/[category]/[tool].astro`                                                         | 도구 페이지: `ToolFrame` + 쓰임새(`ToolUses`) + 사용법 + FAQ(도구 + 공통) + 관련 가이드 + 관련 도구                                                                  |
| `src/pages/[category]/[tool]/frame.astro`                                                   | 격리 frame 페이지: 도구 폴더의 `Frame.astro`를 그대로 그린다                                                                                                         |
| `src/layouts/BaseLayout.astro`                                                              | 모든 바깥 페이지의 `<html>`·`<head>`(제목·설명·canonical·hreflang·OG·소유 확인), 머리글·바닥글, 통계·광고 스크립트, 하단 광고, 광고 차단 안내                        |
| `src/layouts/ToolLayout.astro`                                                              | 도구 페이지 틀: 브레드크럼 → 제목 → `top-banner` → 도구 칸 → 로컬 처리 안내 → `below-tool` → 쓰임새·사용법 → `in-content` → FAQ → 관련. WebApplication 구조화 데이터 |
| `src/layouts/DocLayout.astro`                                                               | 글 페이지 틀 (소개·방침·약관·문의·가이드): 위치 표시 → 제목 → 작은 글씨(시행일 등) → 배너 → 본문 → `after` 칸                                                        |
| `src/components/RailShell.astro`                                                            | 본문 폭·여백 + 넓은 화면(1400px 이상)에서 양옆 160px 세로 광고                                                                                                       |
| `src/components/Header.astro`, `Footer.astro`                                               | 로고·카테고리 메뉴·가이드·언어 바꾸기·테마 버튼 / 글 페이지 링크                                                                                                     |
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

### 테마

- 저장값(`localStorage`의 `theme`)이 있으면 `ThemeInit`이 `<head>`에서 `data-theme`을 붙이고, 없으면 OS 설정을 따른다
- 전환 버튼은 저장하고 `themechange` 이벤트를 낸다. 격리 frame은 `localStorage`를 못 읽으므로 바깥 `ToolFrame`이
  주소(`#theme=`)와 `postMessage`로 알려 준다 (→ [격리 frame](../frame-isolation/README.md))
- 색은 `tokens.css`의 토큰만 쓴다. 모노톤 + 포인트 1색(초록). 종이 바탕(`bb16c0b`), 자르기 막, 가리기 상자,
  종이 위 글자 같은 도구용 색도 토큰으로 더했다

### 결정과 이유

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

- 사이트명·도메인·메일 주소를 코드나 글에 직접 쓰지 않는다. `siteConfig`·`siteUrl`·`contactEmail`을 쓴다
  (안전 그림에 사이트명을 직접 써서 PR #17 리뷰에서 지적받고 고쳤다, `444ea03`)
- 새 바깥 페이지는 `BaseLayout`(+`RailShell`)을 쓰고 영어판도 만든다. `BaseLayout`이 hreflang을 모든 언어로 단다
- 새 글 페이지는 바닥글과 사이트맵에 직접 더한다
- 구조화 데이터 `<script type="application/ld+json">`은 레이아웃 **안**(슬롯)에 둔다. 밖에 두면 `<html>`보다 먼저 출력된다
- 로고를 바꾸면 `make-brand-images.mjs`로 PNG·ICO를 다시 만들어 커밋한다
- `soon` 상태는 목록에 '준비 중' 카드만 보이고 페이지는 만들지 않는다 (지금은 모든 도구가 `live`)

## 3. 구현 체크리스트

- [x] 사이트 설정 한 곳, 색·글꼴·크기 토큰, 전역 스타일
- [x] 레지스트리·카테고리·타입, 빌드 때 검증(파일·카테고리·content·section·관련 도구)
- [x] 허브·카테고리·도구·frame 라우트, 브레드크럼(+같은 분류 도구 메뉴)
- [x] 도구 페이지 틀(쓰임새·사용법·FAQ·공통 FAQ·관련 가이드·관련 도구), 글 페이지 틀
- [x] 묶음별 소제목, 도구 아이콘 (홈·카테고리)
- [x] 다크 모드: OS 설정 + 전환 버튼 + 깜빡임 방지 + frame에 알리기
- [x] 본문 글꼴 Pretendard 직접 호스팅
- [x] 로고(심볼·글자), favicon·홈 화면 아이콘·og:image·내려받기 파일, 점핏과 겹치지 않게 수정
- [x] 모든 페이지 CSP
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
- `tests/e2e/pages.spec.ts`: 바닥글에서 글 페이지로 간다 (→ [검색·가이드](../seo-and-guides/README.md))
- 각 도구 E2E가 도구 페이지·frame 라우트를 함께 거친다

### 직접 확인

- 2026-10-10: 빌드 결과에서 테마 전환·저장이 CSP 오류 없이 동작 (`e95c228` 본문)
- 화면을 바꾸면 390×844에서 버튼과 하단 광고 사이를 재 본다 (`CLAUDE.md` 광고 규칙)

### 히스토리

- [history.md](./history.md): PR #23(글꼴·로고), #26(점핏), #30(묶음·아이콘)과 커밋 109개
