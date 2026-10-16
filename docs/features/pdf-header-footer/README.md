# PDF 머리말·꼬리말 (`pdf/header-footer`)

쓴 날 2026-10-16 · 고친 날 2026-10-16

- 주소: `/pdf/header-footer/` (영어 `/en/pdf/header-footer/`)
- 상태: live (2026-10-15 배포, PR #50으로 dev 병합 2026-10-16)
- 관련 문서: [히스토리](./history.md), [글꼴과 데이터 보관](../../foundations/fonts-and-data/README.md),
  [PDF 공통](../../foundations/pdf-common/README.md) (글자 넣기 워커), 같은 워커를 쓰는
  [워터마크](../pdf-watermark/README.md), 가이드 `src/content/guides/<언어>/header-footer-pdf.md`

## 1. 어떤 기능인지

- PDF 쪽마다 위(머리말)·아래(꼬리말)에 한글 글꼴로 글자를 넣는다. 회사 이름·문서 제목을 쪽 번호·날짜와 함께
- 입력: PDF 하나 + 머리말·꼬리말 글자(각각 한 줄, 최대 120자, 하나만 적어도 됨) + 글꼴
- 출력: `<원래 이름>_머리말.pdf` (영어 화면 `_header.pdf`)
- 고를 수 있는 것
  - 줄마다 정렬: 왼쪽·가운데·오른쪽 (기본: 머리말 왼쪽, 꼬리말 가운데)
  - 크기: 작게·보통·크게 = 9·11·14pt, 색: 회색·검정
  - "첫 쪽(표지)에는 넣지 않기"
  - 자리표시: `{쪽}`/`{page}` 쪽 번호, `{전체}`/`{total}` 전체 쪽 수, `{날짜}`/`{date}` 오늘 날짜
    (두 언어 이름 모두 알아듣고, 화면에는 그 언어 이름을 보여 준다). 꼬리말 기본값은 `{쪽} / {전체}`
- **하지 않는 것·한계** (FAQ와 같게)
  - 표지를 빼도 쪽 번호는 첫 쪽부터 센다 (둘째 쪽에 "2")
  - 날짜는 이 기기의 오늘 날짜를 화면 언어 모양(`Intl.DateTimeFormat`)으로 넣는다. 다른 날짜는 직접 적는다
  - 가장자리에서 약 10mm 안쪽에 넣는다. 원래 여백이 아주 좁으면 본문과 겹칠 수 있다 (미리보기로 확인)
  - 숫자만 빠르게 넣는 것은 따로 있는 "쪽 번호" 도구 (글꼴을 받지 않음)

## 2. 어떻게 만드는지

### 파일

| 파일                                            | 역할                                                                                       |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `src/tools/pdf/header-footer/meta.ts`           | 이름·설명·아이콘, 묶음 `edit`, 관련 도구 `pdf/page-numbers`·`pdf/watermark`                |
| `src/tools/pdf/header-footer/content.ts`        | 사용법·FAQ (한·영)                                                                         |
| `src/tools/pdf/header-footer/messages.ts`       | 화면 문구                                                                                  |
| `src/tools/pdf/header-footer/App.svelte`        | 설정, 날짜, 미리보기, 실행·다운로드, `FontPicker`                                          |
| `src/lib/pdf/header-footer.ts`                  | `addHeaderFooter()`, `HeaderFooterOptions`                                                 |
| `src/lib/pdf/header-footer-layout.ts`           | `fillTemplate`·`linePosition`·`fitSize`·`edgeMargin`. **화면 미리보기와 워커가 같이 쓴다** |
| `src/lib/pdf/text-pdf.ts`, `text-pdf.worker.ts` | 글자 넣기 워커 (`usedText`, `userUnit`, `drawHeaderFooter`)                                |
| `src/lib/pdf/page-geometry.ts`                  | 쪽 회전을 반영한 좌표                                                                      |

### 처리 흐름

1. PDF를 연다. 글자를 적고 글꼴을 고르면 미리보기에 지금 쪽의 실제 글자(자리표시를 채운 것)를 그린다
2. "머리말·꼬리말 넣기" → 날짜를 다시 계산 → `canUse('pdf/header-footer')` → `addHeaderFooter()`
3. 워커
   1. `usedText()`: 쪽마다 자리표시를 채운 **실제로 넣을 글자**만 모아(표지 빼기 반영) 글꼴에 있는지 본다
   2. 쪽마다 `/UserUnit`을 읽어 자리 계산은 pt로 하고(미리보기와 같은 단위) 그릴 때 쪽 단위로 나눈다
   3. 줄마다 `fitSize()`로 크기를 줄이고 `linePosition()`으로 자리를 구해 쪽 회전만큼 돌려 `drawText`
   4. 넣을 글자가 하나도 없으면(한 쪽 문서에서 표지를 뺀 경우) 글꼴 없이 원본을 그대로 저장한다
4. 결과의 `signature`(글자·정렬·크기·색·표지·글꼴 id·**날짜**)가 지금과 같을 때만 "다운로드"

### 자리 계산 (`header-footer-layout.ts`)

- `EDGE_MARGIN = 28`pt(약 10mm, 쪽 번호 도구와 같음). `edgeMargin()`은 그 변 길이의 10%까지만 쓴다
  → 아주 좁게 잘린 쪽에서도 쓸 폭이 늘 쪽 폭의 80% 이상 남는다
- `fitSize()`: 글자 폭이 쓸 수 있는 폭보다 넓으면 줄이고, 쪽 높이의 30%를 넘지 않게 한다 (머리말·꼬리말이 겹치지 않게)
- 머리말 바닥선 = 위 여백 + 글자 크기 × 0.8, 꼬리말 바닥선 = 쪽 높이 − 아래 여백

### 결정과 이유

- 워터마크 워커를 "글자 넣기 워커"로 넓혀 같이 쓴다 (fontkit을 한 번만 싣게, `7b3ee51`)
- 빠진 글자 검사는 **자리표시를 채운 결과**로 한다. 처음엔 0~9를 늘 검사해 숫자가 없는 글꼴을 못 썼다
- 날짜는 `$state`로 두고 실행할 때와 탭이 다시 보일 때(`visibilitychange`) 다시 계산한다. 자정을 넘겨 열어 둔 탭에서
  전날 날짜가 들어가던 문제를 고쳤고, 날짜를 결과 `signature`에 넣어 전날 결과를 다시 받지 않게 했다
- 미리보기 색도 워터마크처럼 PDF에 넣는 RGB 값에서 만든다 (디자인 토큰이 아님. 리뷰에 이유를 답함)

### 주의할 점

- 미리보기 글꼴 `$effect`는 `fontBytes`(derived)만 읽게 해야 한다. `options`를 읽으면 글자를 칠 때마다
  `FontFace`를 다시 만들어 입력이 버벅인다 (`98736e6`)
- `/UserUnit`을 무시하면 pt로 정한 크기·여백이 그 배수로 커진다. pdf.js 미리보기는 이미 UserUnit을 반영한다
- 미리보기와 워커가 같은 함수를 쓰므로, 자리 계산을 고칠 때는 `header-footer-layout.ts`만 고친다

## 3. 구현 체크리스트

- [x] 폴더와 레지스트리 등록
- [x] 위·아래 글자와 정렬, 크기·색, 표지 빼기, 자리표시 세 가지(한·영 이름)
- [x] 긴 글자 줄이기, 좁은·낮은 쪽, `/UserUnit` 쪽, 돌린 쪽
- [x] 실제로 넣는 글자만 글꼴 검사, 넣을 글자가 없으면 그대로 저장
- [x] 한·영 문구, 사용법·FAQ, 가이드 글(`header-footer-pdf.md`)
- [x] E2E (`pdf-header-footer.spec.ts`, 로컬 처리 약속 포함)
- [x] `status: 'live'`, 배포 (2026-10-15)
- [ ] 쪽 번호 시작값 바꾸기, 홀짝 쪽 다르게, 줄 여러 개는 없다

## 4. 검증

### 자동 테스트

`tests/e2e/pdf-header-footer.spec.ts`

- `쪽마다 머리말과 채워진 쪽 번호 꼬리말을 넣는다` — 결과 이름 `three-pages_머리말.pdf`, 쪽마다 머리말과 `n / 3`,
  `expectLocalOnly`
- `표지를 빼면 둘째 쪽부터 넣고, 쪽 번호는 첫 쪽부터 센다` — 첫 쪽은 원래 글자뿐, 둘째 쪽 `- 2 -`
- `한 쪽짜리 문서에서 표지를 빼면 아무것도 넣지 않고 그대로 저장한다`
- `머리말·꼬리말이 모두 비면 넣을 수 없다` — 안내 문구와 버튼 꺼짐
- `숫자가 없는 내 글꼴도 숫자를 넣지 않으면 쓰고, 긴 글자는 쪽 안으로 줄인다` — `abc.otf`, 120자 머리말이 쪽 폭 안
- `좌표 단위가 pt가 아닌 쪽(/UserUnit)에도 미리보기와 같은 크기로 넣는다` — `user-unit.pdf`(단위 = 2pt)에서
  글자 크기 5.5단위(11pt), 바닥선 14단위(28pt)

### 직접 확인

- 리뷰 답글에 적힌 확인: 40pt 폭 쪽에서 글자 크기 1.17pt·x 4pt로 쪽 안에 들어감
- 브라우저별로 직접 확인한 기록은 커밋·PR에 남아 있지 않다

### 히스토리

- [history.md](./history.md): PR #50과 리뷰 지적 8개
