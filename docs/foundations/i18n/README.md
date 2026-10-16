# 다국어 (i18n)

- 지원 언어: 한국어(기본, 주소 앞에 아무것도 없음), 영어(`/en/...`)
- 상태: live (PR #17 영어판, PR #20 영어 문구 검수, 2026-10-14 병합)
- 관련 문서: [히스토리](./history.md), [사이트 구조](../site-structure/README.md),
  [검색·가이드](../seo-and-guides/README.md) (hreflang·사이트맵·가이드 두 언어판),
  [`CLAUDE.md`](../../../CLAUDE.md)의 "다국어" 절

## 1. 어떤 기반인지

모든 바깥 페이지·도구 화면·사용법·FAQ·글 페이지·가이드를 한국어와 영어로 낸다.

- 같은 페이지의 언어판은 주소만 다르다: `/pdf/merge/` ↔ `/en/pdf/merge/`
- **페이지 언어는 주소에서 정한다.** 부품이 언어를 넘겨받지 않고 스스로 `localeOf(Astro.url.pathname)`로 읽는다
- 격리 frame은 바깥 주소를 볼 수 없어 자기 문서의 `<html lang>`으로 언어를 고른다
- 처음 온 방문자는 브라우저 언어에 맞는 판으로 보낸다. 검색 로봇과 자동화 브라우저는 보내지 않는다
- 문구가 한 언어라도 빠지면 타입 오류가 난다 (`Record<Locale, …>`)

## 2. 어떻게 만드는지

### 파일

| 파일                                  | 역할                                                                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/i18n/locales.ts`                 | `LOCALES`(`ko`, `en`), `DEFAULT_LOCALE`, `LOCALE_STORAGE_KEY`(`lang`), `LOCALE_INFO`(이름·og:locale), `localeOf()`, `withoutLocale()`, `localizePath()` |
| `src/i18n/ui.ts`                      | 바깥 페이지 부품 문구 `ui(locale)` (머리글·바닥글·테마·도구 페이지 틀·광고 칸·광고 차단 안내·가이드 등)                                                 |
| `src/site.config.ts`의 `text`         | 사이트 설명·홈 큰 제목 (언어별)                                                                                                                         |
| `src/tools/categories.ts`             | 카테고리 이름·설명, 묶음 이름 (언어별)                                                                                                                  |
| `src/tools/<…>/meta.ts`의 `text`      | 도구 이름·`<title>`·설명 (언어별)                                                                                                                       |
| `src/tools/<…>/content.ts`            | 사용법·FAQ (언어별)                                                                                                                                     |
| `src/tools/common-faq.ts`             | 공통 FAQ (언어별)                                                                                                                                       |
| `src/frame/locale.ts`                 | frame 언어 `frameLocale` (`<html lang>`에서 읽음), `pick(messages)`                                                                                     |
| `src/frame/messages.ts`               | 도구 화면 공통 부품 문구 (파일 놓기, PDF 열기·암호, 실행 막대, 글꼴 목록 등)                                                                            |
| `src/tools/<…>/messages.ts`           | 도구별 화면 문구 (도구 24개 모두 있다)                                                                                                                  |
| `src/frame/FrameLayout.astro`         | frame 문서의 `<html lang={localeOf(...)}>`                                                                                                              |
| `src/pages/en/**`                     | 영어 라우트. 홈·카테고리·도구·frame·가이드는 한국어 페이지를 그대로 그리는 얇은 파일, 소개·방침·약관·문의는 영어 글을 따로 쓴다                         |
| `src/tools/paths.ts`                  | 한국어·영어 라우트가 같이 쓰는 주소 목록                                                                                                                |
| `src/components/LocaleRedirect.astro` | 처음 방문 언어 보내기 (`<head>` 앞쪽, inline 스크립트)                                                                                                  |
| `src/components/LocaleSwitch.astro`   | 머리글 언어 바꾸기. 누르면 `localStorage`의 `lang`에 저장                                                                                               |
| `src/layouts/BaseLayout.astro`        | `<html lang>`, 모든 언어판 `hreflang` + `x-default`(한국어), `og:locale`                                                                                |
| `src/content/guides/<언어>/`          | 가이드 글. 모든 언어판을 같은 주소 이름으로 쓴다 (→ [검색·가이드](../seo-and-guides/README.md))                                                         |

### 처음 방문 언어 (`LocaleRedirect`)

1. `navigator.webdriver`이거나 사용자 에이전트가 로봇(`bot|crawl|spider|slurp|yeti|daum|bingpreview`)이면 아무것도 안 한다
2. 직접 고른 언어(`localStorage`의 `lang`)가 있으면 그 언어
3. 없으면 브라우저 첫 언어(`navigator.languages[0]`)가 `ko`·`en`(또는 `ko-…`·`en-…`)인지 보고, 아니면 영어
4. 지금 페이지 언어와 다르면 같은 페이지의 그 언어판으로 `location.replace` (쿼리·해시 유지)

### 결정과 이유

- **한국어는 주소 그대로, 영어는 `/en/`** (2026-10-13): 기본 언어인 한국어는 그때까지 쓰던 주소를 그대로 둔다
- **언어를 주소에서 정한다**: 부품마다 언어를 넘기지 않아도 되고, 같은 페이지 코드로 두 언어판을 그린다.
  영어 라우트는 한국어 페이지를 import해서 그리기만 한다
- **frame은 `<html lang>`에서 읽는다**: 출처 없는 frame은 바깥 주소·저장값을 볼 수 없다. frame 주소도
  `/en/.../frame/`이라 `FrameLayout`이 같은 규칙으로 `lang`을 넣는다. frame 문서 제목도 언어별이다(스크린리더)
- **검색 로봇은 보내지 않는다**: 구글 로봇은 영어 브라우저로 와서, 보내면 한국어 페이지를 읽지 못해 한국어 검색에서
  빠진다. 각 언어판은 `hreflang`으로 알린다
- **지원하지 않는 언어는 영어로** (`FALLBACK_LOCALE = 'en'`)
- **글 페이지는 영어 글을 따로 쓴다**: 방침·약관의 영어 법률 표현은 PR #20에서 따로 다듬었다. 영어판에는
  "다르면 한국어판이 기준"이라고 적고, 두 언어를 함께 고치고 시행일도 맞춘다
- **문구 위치를 나눈다**: 바깥 페이지는 `ui.ts`, frame 공통은 `frame/messages.ts`, 도구별은 도구 폴더

### 주의할 점

- 새 바깥 페이지를 만들면 영어판도 만든다 (`BaseLayout`이 모든 페이지에 다른 언어판 `hreflang`을 단다)
- 버튼 이름을 바꾸면 그 도구의 `content.ts` 사용법과 가이드 글의 버튼 이름도 같은 언어로 맞춘다
- 결과 파일 이름의 붙는 말(예: `_워터마크`)도 언어별이다. 영어 화면에서는 영어로 붙는다 (E2E가 확인)
- 영어 문구는 PR #20에서 한 번 검수했다. 구현과 다른 표현을 쓰지 않는다 (예: pdf.js CMap은 "font data"가 아니라 "character mapping")
- E2E는 자동화 브라우저라 언어 이동이 꺼진다. 이동을 보려면 `navigator.webdriver`를 `false`로 덮는다 (`i18n.spec.ts`의 `asPerson`)
- 언어를 더하려면 `LOCALES`·`LOCALE_INFO`에서 시작하고, 타입 오류가 나는 곳을 모두 채운다

## 3. 구현 체크리스트

- [x] 언어 목록·주소 규칙, 주소에서 언어 읽기
- [x] 바깥 페이지 문구(`ui.ts`), 사이트 설명·홈 제목, 카테고리·묶음·도구 이름/설명, 사용법·FAQ·공통 FAQ 영어판
- [x] 영어 라우트(홈·카테고리·도구·frame·가이드), 영어 글 페이지(소개·방침·약관·문의)
- [x] 도구 화면 언어(`frameLocale`, `pick`), 공통·도구별 문구, frame 문서 제목
- [x] `hreflang`·`x-default`·`og:locale`, 사이트맵에 영어 페이지
- [x] 머리글 언어 바꾸기(저장), 처음 방문 언어 보내기(로봇 제외)
- [x] 영어 문구 검수 (PR #20)
- [x] 가이드 글 두 언어판 (빠지면 빌드 멈춤)
- [ ] 세 번째 언어는 없다 (구조는 `LOCALES`에 더하면 되게 되어 있음)

## 4. 검증과 히스토리

### 자동 테스트 — `tests/e2e/i18n.spec.ts`

- 영어 페이지는 `lang="en"`이고 홈 제목·도구 링크(`/en/pdf/merge/`)가 영어다
- 영어 글 페이지 4개(`/en/about/` 등)가 열리고 바닥글이 영어 페이지로 이어진다
- 영어 도구 화면도 영어로 나오고, 합친 파일 이름도 영어다
- 영어 나누기 도구의 범위 오류도 영어다
- 다른 언어판을 검색엔진에 알린다 (`hreflang`)
- 사이트맵에 영어 페이지가 있다
- 처음 방문 언어: 영어 브라우저로 한국어 페이지 → 영어판(쿼리 유지) / 직접 한국어를 고르면 다음부터 한국어 /
  검색 로봇(Googlebot)은 보내지 않는다 / 한국어 브라우저로 영어 페이지 → 한국어판
- 홈의 안전 그림이 언어에 맞게 나온다 (PR #17 리뷰 지적으로 더함)

다른 E2E에서도: `category.spec.ts`(영어 소제목), `guide.spec.ts`(영어 가이드가 영어 도구로 이어짐)

### 히스토리

- [history.md](./history.md): PR #17·#20과 리뷰 지적 4개
