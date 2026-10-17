# 검색과 가이드 글 (seo-and-guides)

쓴 날 2026-10-16 · 고친 날 2026-10-17

- 범위: 사이트맵·robots, `<head>` 검색 정보(설명·canonical·hreflang·Open Graph·소유 확인), 구조화 데이터(JSON-LD),
  가이드 글(`/guide/`), 글 페이지(소개·이용약관·문의. 개인정보처리방침은 [광고와 통계](../ads-and-analytics/README.md))
- 상태: live. 네이버 소유 확인(PR #6), 글 페이지(PR #10), 구조화 데이터(PR #16), 가이드 첫 6편(PR #37, 2026-10-15)
- 관련 문서: [히스토리](./history.md), [사이트 구조](../site-structure/README.md), [다국어](../i18n/README.md),
  [`CLAUDE.md`](../../../CLAUDE.md)의 "가이드 글"·"글 페이지와 방문 통계"·"광고 심사 신청 전에 할 일"

## 1. 어떤 기반인지

검색으로 들어오는 길을 만들고, 광고(AdSense) 심사에서 볼 "가치 있는 콘텐츠"를 채운다.

- 모든 공개 페이지가 두 언어로 사이트맵에 저절로 실린다 (레지스트리·가이드 목록에서 만든다)
- 모든 바깥 페이지가 설명·canonical·다른 언어판(`hreflang`)·링크 미리보기(OG)를 가진다
- 검색 결과를 풍부하게 하는 구조화 데이터: 홈 `WebSite`, 위치 `BreadcrumbList`, 도구 `WebApplication`·`FAQPage`, 가이드 `Article`
- 가이드 글: 도구 사용법을 늘여 쓰지 않고 원리·고르는 법·문제 해결처럼 읽을 거리를 담는다.
  글 위아래에 도구 링크가 있고, 도구 페이지에는 "관련 가이드"가 저절로 붙는다
- 소개·방침·약관·문의 페이지는 광고 심사가 요구하는 페이지라 모든 페이지 바닥글에서 갈 수 있다

## 2. 어떻게 만드는지

### 파일

| 파일                                                                    | 역할                                                                                                                                                                            |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/pages/sitemap.xml.ts`                                              | 홈·카테고리·live 도구·가이드 목록·가이드 글·소개·방침·약관·문의를 모든 언어 주소로                                                                                              |
| `src/pages/robots.txt.ts`                                               | 모두 허용 + 사이트맵 주소 (도메인은 설정에서)                                                                                                                                   |
| `src/layouts/BaseLayout.astro`                                          | `<title>`(`제목 - 사이트명`), description, canonical, `hreflang`(모든 언어 + `x-default` 한국어), 네이버·AdSense 확인 태그, OG(`og:locale`, `/og.png` 1200×630), `twitter:card` |
| `src/pages/index.astro`                                                 | `WebSite`                                                                                                                                                                       |
| `src/components/Breadcrumb.astro`                                       | `BreadcrumbList`                                                                                                                                                                |
| `src/layouts/ToolLayout.astro`                                          | `WebApplication` (무료, `UtilitiesApplication`, 가격 0)                                                                                                                         |
| `src/components/ToolFaq.astro`                                          | `FAQPage` (화면의 공통 FAQ + 도구 FAQ와 같은 내용). `<details>`라 JavaScript 없이 열린다                                                                                        |
| `src/content.config.ts`                                                 | 가이드 모음 스키마: `title`, `description`, `tool`, `published`, `updated?`, `order`                                                                                            |
| `src/content/guides/<언어>/<주소>.md`                                   | 가이드 글. 지금 dev에 13편 × 2언어                                                                                                                                              |
| `src/guides.ts`                                                         | `guidesIn()`, `guideSlugs`, `guidePaths()`, `guidesForTool()`, 빌드 때 검사                                                                                                     |
| `src/pages/guide/index.astro`, `[slug].astro` (+ `src/pages/en/guide/`) | 목록(카드 + 도구 아이콘), 글(위 도구 링크, 본문, 아래 도구 버튼·다른 글, `Article` 구조화 데이터, 작성/수정 날짜)                                                               |
| `src/components/ToolGuides.astro`                                       | 도구 페이지의 "관련 가이드" (없으면 안 그림)                                                                                                                                    |
| `src/layouts/DocLayout.astro`                                           | 글 페이지 틀 (위치 표시 → 제목 → 작은 글씨 → 배너 → 본문 → `after`)                                                                                                             |
| `src/pages/about.astro`, `terms.astro`, `contact.astro` (+ `en/`)       | 소개(사이트명·만든 이유·처리 방식·live 도구 목록·무료), 약관(시행일), 문의(`contactEmail`)                                                                                      |
| `src/components/Header.astro`, `Footer.astro`                           | 머리글·바닥글의 가이드 링크, 바닥글의 글 페이지 링크                                                                                                                            |
| `public/og.png`                                                         | 링크 미리보기 그림 (`scripts/make-brand-images.mjs`가 만든다)                                                                                                                   |

### 가이드 글 목록 (`order` 순)

| order | 주소                 | 도구                 |
| ----- | -------------------- | -------------------- |
| 1     | `compress-pdf`       | `pdf/compress`       |
| 2     | `compress-image`     | `image/compress`     |
| 3     | `resize-image`       | `image/resize`       |
| 4     | `merge-pdf`          | `pdf/merge`          |
| 5     | `pdf-to-jpg`         | `pdf/to-image`       |
| 6     | `sign-pdf`           | `pdf/sign`           |
| 7     | `convert-image`      | `image/convert`      |
| 8     | `watermark-pdf`      | `pdf/watermark`      |
| 9     | `header-footer-pdf`  | `pdf/header-footer`  |
| 10    | `edit-pdf`           | `pdf/edit`           |
| 11    | `n-up-pdf`           | `pdf/n-up`           |
| 12    | `ocr-pdf`            | `pdf/ocr`            |
| 13    | `redact-pdf`         | `pdf/redact`         |
| 14    | `extract-images-pdf` | `pdf/extract-images` |
| 15    | `fill-pdf-form`      | `pdf/fill-form`      |
| 16    | `pdf-metadata`       | `pdf/metadata`       |

2026-10-17 배포로 `redact-pdf`(가리기), `extract-images-pdf`(사진 꺼내기), `pdf-metadata`(문서 정보)가 더해졌다.

### 빌드 때 검사 (`src/guides.ts`)

- 가이드 폴더 이름이 언어(`ko`·`en`)가 아니면 멈춘다
- `tool`이 레지스트리의 **live** 도구가 아니면 멈춘다
- 한 주소 이름에 모든 언어판이 없으면 멈춘다

### 결정과 이유

- **사이트맵·도구 목록을 레지스트리에서 만든다**: 도구를 더해도 사이트맵을 따로 고치지 않는다. 글 페이지만 직접 더한다
- **구조화 데이터는 화면과 같은 내용**: 어긋나면 검색엔진이 잘못된 정보로 본다. FAQ·`WebApplication` 이름·가이드 날짜를 E2E가 화면과 맞춰 본다
- **JSON-LD는 레이아웃 안(슬롯)에** (PR #16 리뷰, `3b037dd`): 틀 밖에 두면 `<html>`보다 먼저 출력된다.
  `<html>` 안에 있고 페이지가 표준 모드(`CSS1Compat`)로 그려지는지 E2E로 확인한다
- **소유 확인**: 네이버는 설정값을 메타 태그로 (PR #6). AdSense도 메타 태그와 `ads.txt`. Google Search Console 확인 값은 코드에 없다
- **가이드를 마크다운 모음으로** (2026-10-15): 검색 유입과 광고 심사용 글을 쉽게 쓰게. 코드 색칠(Shiki)은 inline style이라
  CSP에 막혀 껐다 (`astro.config.mjs`의 `markdown.syntaxHighlight: false`)
- **영어 가이드 라우트는 주소를 props로도 넘긴다** (`e56e0c3`): params로만 넘겨 영어 라우트가 한국어 페이지를 그릴 때 타입이 맞지 않았다(`npm run check` 실패)
- **글 끝 도구 버튼과 광고 칸을 띄운다**: 버튼 근처 광고 금지 규칙 (→ [광고](../ads-and-analytics/README.md))
- **글 페이지 문구는 지금 하는 일만**: 광고 스크립트가 이미 붙어 있는데 소개만 "광고로 운영비를 마련할 계획"이라고 해 현재형으로
  맞췄다(`d0e0fec`). "외부에서 불러오는 것은 없다"는 도구가 쓰는 프로그램에만 맞는 말이라(통계 스크립트는 외부에서 받음)
  소개의 설명을 고쳤다(`dbd1896`)

### 주의할 점

- 가이드는 **모든 언어판을 같은 주소 이름으로** 쓴다. 글 안 링크는 그 언어의 주소로 (영어 글은 `/en/...`)
- 버튼 이름은 도구 화면과 똑같이 쓴다. 도구의 버튼·동작·한계를 바꾸면 그 도구의 가이드도 고친다
- 실제 동작과 어긋나는 내용(줄어드는 정도, 지원 형식 등)을 쓰지 않는다
- 새 도구를 만들면 가이드를 함께 쓴다 (`CLAUDE.md` 9단계 방침)
- 새 글 페이지는 바닥글과 사이트맵(`sitemap.xml.ts`의 목록)에 직접 더하고 영어판도 만든다
- 방침·약관은 두 언어를 함께 고치고 시행일을 맞춘다 (약관 시행일 2026-10-14)
- 문의 메일 주소는 `contactEmail`만 쓴다 (`contact@<도메인>`, Cloudflare Email Routing으로 전달)

## 3. 구현 체크리스트

- [x] 사이트맵(모든 언어)·robots, 끝 슬래시 주소
- [x] OG 태그, 링크 미리보기 그림, `hreflang`·`og:locale`
- [x] 네이버 소유 확인 태그, AdSense 확인 태그·`ads.txt`
- [x] 구조화 데이터 5종, `<html>` 안에 두기
- [x] 소개·방침·약관·문의 (한·영), 바닥글 링크, 사이트맵
- [x] 가이드 모음·목록·글 페이지, 빌드 때 검사, 도구 페이지 관련 가이드, 머리글·바닥글 링크
- [x] 가이드 16편 (2026-10-17 배포)
- [x] 검색 등록: Google Search Console, 네이버 서치어드바이저 + 사이트맵 제출 (2026-10-13, 사용자가 직접)
- [ ] 가이드가 없는 live 도구: 보기, 글자 추출, 나누기, 회전, 정리, 자르기, 이미지를 PDF로, 쪽 번호, 이미지 넣기,
      암호 해제, 암호 걸기

## 4. 검증과 히스토리

### 자동 테스트

- `tests/e2e/seo.spec.ts`
  - 홈에 `WebSite`가 있고 이름이 사이트명이다
  - 도구 페이지의 `FAQPage` 질문이 화면의 질문과 같다 (공통 FAQ 포함, 3개 이상)
  - 도구 페이지에 `WebApplication`이 있고 이름이 h1과 같다, 무료, 주소가 맞다
  - 구조화 데이터가 `<html>` 안에 있고 페이지가 표준 모드(`CSS1Compat`)다 (`/`, `/pdf/merge/`)
- `tests/e2e/guide.spec.ts`
  - 머리글의 가이드 → 목록 → 글(`compress-pdf`) → 도구(`/pdf/compress/`)
  - 도구 페이지에 그 도구의 가이드가 이어진다 (`resize-image`)
  - 영어 가이드는 영어로 쓰여 있고 글 안 링크가 모두 `/en/`이며 영어 도구로 이어진다
  - 가이드 글의 `Article` 제목이 h1과 같고 날짜가 화면("2026년 10월 15일 작성")과 같다
  - 모든 가이드가 두 언어로 사이트맵에 있다
- `tests/e2e/pages.spec.ts`
  - 도구 페이지 바닥글에서 소개·방침·약관·문의로 간다
  - 글 페이지가 모두 사이트맵에 있다
  - 문의 페이지와 방침의 메일 주소가 같다
  - `ads.txt`와 소유 확인 태그가 같은 AdSense 게시자를 가리킨다
- `tests/e2e/i18n.spec.ts`: `hreflang`, 사이트맵의 영어 페이지 (→ [다국어](../i18n/README.md))
- `tests/e2e/brand.spec.ts`: 머리말이 아이콘과 `og:image`를 가리킨다

### 히스토리

- [history.md](./history.md): PR #6·#10·#16·#37과 리뷰 지적
