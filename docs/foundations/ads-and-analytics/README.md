# 광고와 방문 통계 (ads-and-analytics)

쓴 날 2026-10-16 · 고친 날 2026-10-16

- 범위: 광고 슬롯(위치·크기·배치 규칙), AdSense 스크립트·소유 확인·`ads.txt`, 광고 차단 감지와 안내 창,
  Cloudflare 방문 통계, 개인정보처리방침, E2E의 로컬 처리 검사
- 상태: 통계 live (PR #8), AdSense 소유 확인(PR #12)·스크립트와 광고 차단 안내(PR #14) live, 2026-10-14 병합.
  **AdSense 심사 중이라 광고 칸(`ads.slots`)은 비어 있다**
- 관련 문서: [히스토리](./history.md), [격리 frame](../frame-isolation/README.md) (광고가 파일을 못 보는 이유),
  [사이트 구조](../site-structure/README.md) (레이아웃), [`CLAUDE.md`](../../../CLAUDE.md)의 "광고 슬롯 규칙"·
  "글 페이지와 방문 통계"·"광고 심사 신청 전에 할 일"

## 1. 어떤 기반인지

광고는 이 사이트의 운영비다. 모든 방문자에게 내되, **파일을 다루는 도구 영역에는 절대 닿지 않게** 하고,
버튼 근처·모달 안·처리 대기 화면처럼 사용자를 방해하거나 잘못 누르게 하는 자리에는 두지 않는다.

- 광고·통계 스크립트는 **바깥 페이지에만** 있다. 도구는 sandbox iframe 안에서 돌아 바깥 스크립트가 파일 이름·내용을 읽을 수 없다
- 광고 자리는 6개뿐이고 크기를 미리 잡아 둔다 (CLS 0)
- `site.config.ts`의 `ads.enabled` 하나로 광고 스크립트·광고 칸·광고 차단 안내를 함께 켜고 끈다
- 방문 통계는 쿠키 없는 Cloudflare Web Analytics 하나다. GA4·Clarity는 미뤘다
- E2E가 "파일이 기기를 떠나지 않는다"를 모든 도구에서 같은 기준으로 확인한다 (`expectLocalOnly`)

## 2. 어떻게 만드는지

### 파일

| 파일                                                                               | 역할                                                                                                                       |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `src/site.config.ts`의 `ads`, `analytics`                                          | `enabled`, `adsenseClient`(게시자 ID), `adblockNotice`, `slots`(슬롯마다 업체 `adsense`/`adfit`와 광고 단위), 통계 토큰    |
| `src/ads/slots.ts`                                                                 | 슬롯 ID 6개 `AD_SLOT_IDS`                                                                                                  |
| `src/ads/slots.css`                                                                | 슬롯 크기의 **유일한 출처** (`data-ad-slot` 값마다 데스크톱·모바일 크기), `--ad-mobile-anchor-h`                           |
| `src/components/AdSlot.astro`                                                      | 광고 칸. 켜짐 + 슬롯 설정 있음 → 크기 잡힌 빈 칸 / 개발 모드·`SHOW_AD_PLACEHOLDERS=1` → 점선 칸 / 그 밖 → 아무것도 안 그림 |
| `src/components/RailShell.astro`                                                   | 1400px 이상에서 양옆 `rail-left`·`rail-right`(sticky)                                                                      |
| `src/components/MobileAnchor.astro`                                                | 768px 미만 하단 고정 `mobile-anchor` + 접기 탭, 칸이 있을 때만 본문 아래 같은 높이 여백                                    |
| `src/layouts/ToolLayout.astro`                                                     | 도구 페이지의 `top-banner`(도구 칸과 32px), 로컬 처리 안내 + 48px 뒤 `below-tool`, 사용법 뒤 `in-content`                  |
| `src/components/AdsScript.astro`                                                   | AdSense 스크립트를 `<head>`에 넣고 CSP에 Google 주소와 `style-src-attr 'unsafe-inline'`을 허용. 광고 차단 감지             |
| `src/components/AdblockNotice.astro`                                               | 광고 차단 안내 `<dialog>` (×·닫기·Esc·바깥 누르기, "껐어요, 새로 고침")                                                    |
| `src/frame/activity.ts` → `src/frame/parent.ts` → `src/components/ToolFrame.astro` | frame이 내용 없는 `activity` 신호를 보내면 바깥이 `toolactivity` 이벤트를 낸다                                             |
| `src/components/Analytics.astro`                                                   | Cloudflare Web Analytics 스크립트 + CSP 허용 (배포 빌드만)                                                                 |
| `src/layouts/BaseLayout.astro`                                                     | AdSense 소유 확인 `<meta name="google-adsense-account">`, `Analytics`·`AdsScript`·`MobileAnchor`·`AdblockNotice`           |
| `src/pages/ads.txt.ts`                                                             | `google.com, pub-…, DIRECT, f08c47fec0942fa0` (게시자 ID는 설정에서)                                                       |
| `src/pages/privacy.astro`, `src/pages/en/privacy.astro`                            | 개인정보처리방침 (한눈에 보기·파일·모으는 정보·광고와 쿠키·브라우저에 저장하는 것·다른 회사·요청·변경·문의)                |
| `tests/e2e/local-only.ts`                                                          | `expectLocalOnly(page, requests, baseURL)`와 바깥 페이지가 연결해도 되는 주소 `OUTER_ORIGINS`                              |
| `tests/e2e/test.ts`                                                                | 모든 E2E의 `test`. 광고 주소(`AD_HOSTS`)를 빈 응답으로 바꿔 실제 광고 서버에 연결하지 않는다                               |

### 광고 자리

| 슬롯                      | 어디                                                      | 크기 (데스크톱 / 모바일) |
| ------------------------- | --------------------------------------------------------- | ------------------------ |
| `rail-left`, `rail-right` | 모든 페이지 양옆, 1400px 이상                             | 160×600                  |
| `top-banner`              | 모든 페이지 제목 아래 (도구 페이지는 도구 칸과 32px)      | 728×90 / 320×100         |
| `below-tool`              | 도구 페이지, 로컬 처리 안내 + 48px 뒤                     | 728×90 / 320×100         |
| `in-content`              | 도구 페이지 사용법과 FAQ 사이, 홈·카테고리 도구 목록 아래 | 336×280 / 300×250        |
| `mobile-anchor`           | 모든 페이지 모바일 하단 고정 (접기 가능)                  | 320×50                   |

### 광고 차단 감지와 안내

1. `AdsScript`가 `adsbygoogle.js`를 붙인다. 받지 못하면(`error`) 차단으로 본다
2. 미끼 칸(`adsbox ad-banner …`)을 화면 밖에 두고 500ms 뒤 높이가 0이면(숨겨짐) 차단으로 본다
3. 차단이면 `<html data-adblock>`을 달고 `adblock` 이벤트를 낸다
4. `AdblockNotice`가 `adblock`과 `toolactivity`(파일 고르기·놓기, 실행·다운로드 막대 버튼)마다 창을 띄운다.
   창은 언제든 닫히고, 닫아도 하던 일은 그대로 된다. 창 안에는 광고가 없다

### 결정과 이유

- **광고는 모든 방문자에게** (2026-10-13 다시 정함): 처음(2026-10-11)에는 전 세계 공통 동의 배너를 두려 했지만, 거절하면 광고가
  아예 없어진다. 우리 배너를 만들지 않고 쿠키 사용은 방침에 밝힌다. 유럽은 AdSense의 Google 인증 동의 메시지가 맡는다(사용자가 켬)
- **소유 확인은 메타 태그와 `ads.txt`로** (`04c8d3d`): 광고 스크립트로 확인하면 동의 없이 쿠키를 쓰게 된다
- **자동 광고는 쓰지 않는다**: 버튼 옆·전면 광고가 끼어든다
- **스위치 하나** (PR #14 리뷰 P1, `1eec006`): `enabled`가 꺼져 있는데도 스크립트와 안내 창이 돌았다. 지금은 셋을 함께 끈다.
  심사 중에는 스위치를 켜 두고 `slots`만 비운다
- **슬롯 크기는 CSS 파일** (`8c4d409`): CSP가 `style="..."` 속성을 막는다
- **가로 배너 자리**: 머리글 바로 아래(`83951d9`)는 어색하다는 피드백으로 각 페이지 제목 아래로 옮겼다(`1bb24a2`).
  도구 페이지는 도구 칸 맨 위에 실행 버튼이 있어 32px을 띄운다
- **하단 광고는 숨기지 않고 접기 탭만** (`cf81b72`): 접기 탭은 광고 칸 위의 다른 영역이라 광고 클릭으로 오인되지 않는다.
  모바일에서 실행·다운로드 막대를 하단에 고정하지 않는다
- **광고 차단 안내** (2026-10-13 사용자 결정): 차단한 방문자에게서는 운영비가 나오지 않아, "일부러 기다리게 하지 않는다"는
  규칙의 예외로 어느 페이지에서나·도구를 쓸 때마다 띄운다. 방문자가 줄면 빈도를 낮춘다. frame이 보내는 신호에는 아무 내용도 없다
- **CSP는 주소 허용 목록** (PR #14 리뷰 P1, 미반영): Google은 AdSense에 허용 목록 CSP를 지원하지 않는다고 밝힌다(nonce +
  `strict-dynamic` 권장). 정적 사이트라 nonce를 쓸 수 없고, 해시 + `strict-dynamic`은 우리 스크립트 전체를 브라우저별 지원에
  묶어 이번에는 바꾸지 않았다. 스크립트만 불러오는 지금은 CSP 오류가 없다
- **통계는 Cloudflare Web Analytics** (PR #8, 2026-10-13): 쿠키가 없고 방문자를 식별하지 않아 동의 없이 넣는다.
  대시보드의 자동 삽입은 Workers 배포에 들어오지 않아 코드에서 넣는다. 개발 서버에서는 넣지 않는다

### 주의할 점

- **통계·광고·쿠키·브라우저 저장을 더하거나 바꾸면 같은 PR에서 개인정보처리방침 두 언어판과 시행일을 고친다.**
  방침에는 지금 실제로 하는 일만 쓴다 (리뷰 지적으로 광고 적용에 맞춰 시행일을 고친 적 있음)
- 새 통계·광고 업체를 더하면: 그 부품에서 CSP 허용 → `tests/e2e/local-only.ts`의 `OUTER_ORIGINS` → `tests/e2e/test.ts`의
  `AD_HOSTS`(광고라면) → 방침
- 광고 스크립트는 `<head>` 안에 둔다. CSP `<meta>`가 `<head>`에서 만들어져 그 뒤에 허용한 주소는 들어가지 않는다
- 다운로드·파일 선택·실행 버튼 근처, 모달·오버레이 안에는 슬롯을 두지 않는다. 처리 전후 버튼 영역 높이를 같게 한다
- 새 페이지 틀은 `RailShell`을 쓴다. `mobile-anchor`는 `BaseLayout`에 있어 저절로 붙는다
- 화면을 바꾸면 390×844에서 버튼과 하단 광고 사이를 재 본다

## 3. 구현 체크리스트

- [x] 슬롯 6개, 크기 CSS, 점선 미리보기(`npm run build:ad-preview`), 모바일 하단 고정 + 접기
- [x] 홈·카테고리·도구·글 페이지에 슬롯 배치
- [x] Cloudflare 방문 통계 (쿠키 없음)
- [x] AdSense 소유 확인(메타 태그·`ads.txt`), 스크립트, CSP 허용
- [x] 광고 차단 감지(스크립트 실패·미끼 칸)와 안내 창, frame의 내용 없는 활동 신호
- [x] `ads.enabled` 하나로 전체 켜고 끄기
- [x] 개인정보처리방침·소개 문구를 실제와 맞춤 (두 언어, 시행일)
- [x] E2E 로컬 처리 검사(통계 요청의 주소·본문까지), 광고 주소 빈 응답
- [ ] 심사 통과 뒤: 광고 단위를 `ads.slots`에 넣고 `AdSlot`이 `<ins class="adsbygoogle">`을 실제로 그리는 코드 만들기
- [ ] 광고 칸·유럽 동의 창을 켤 때 실제 브라우저 콘솔로 CSP 확인 (`?fc=alwaysshow`), 막히면 해시 + `strict-dynamic`
- [ ] 광고를 켠 뒤: 커서가 광고 iframe 위로 바로 들어와 파일을 놓으면 광고 iframe이 받을 수 있다 → 광고 칸 위치·크기 검토
- [ ] GA4·Microsoft Clarity (미룸. 넣으면 도구 영역 마스킹, 이벤트는 파일 개수·크기 구간만, 동의 방식 다시 정하기)

## 4. 검증과 히스토리

### 자동 테스트

- `tests/e2e/adblock.spec.ts`
  - 광고 스크립트는 바깥 페이지에만 있고 도구 frame에는 없다 (안내 창도 frame에 없음)
  - 광고 차단이 없으면 안내 창이 뜨지 않는다
  - 광고 차단이 켜져 있으면 `/`, `/pdf/`, `/pdf/merge/`, `/about/` 에서 안내 창이 뜬다
  - 안내 창은 ×, 닫기 버튼, Esc, 바깥 누르기로 닫는다
  - 도구를 쓸 때마다 다시 뜨고, 닫아도 하던 일은 그대로 된다
  - "껐어요, 새로 고침"은 페이지를 다시 열고, 광고가 받아지면 더는 뜨지 않는다
  - 도구 frame이 보내는 신호에는 내용이 없다
- `tests/e2e/pages.spec.ts`: `ads.txt`와 소유 확인 태그가 같은 AdSense 게시자를 가리킨다, 문의 페이지와 방침의 메일 주소가 같다
- 모든 도구 E2E: `expectLocalOnly` — frame의 요청은 우리 사이트로 가는 본문 없는 GET뿐, 바깥 페이지는 `OUTER_ORIGINS`로만 더 갈 수
  있고 그 주소(디코딩한 경로·쿼리)와 본문에 테스트 파일 이름·PDF 표식(`%PDF`, `JVBERi`)이 없다 (PR #8 리뷰 지적으로 주소도 검사)

### 직접 확인

- 2026-10-13: 스크립트만 불러오는 상태에서 CSP 오류 없음 (`CLAUDE.md`)

### 히스토리

- [history.md](./history.md): PR #8·#12·#14와 리뷰 지적 4개
