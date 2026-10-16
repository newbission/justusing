# PDF 글자 워터마크 (`pdf/watermark`)

- 주소: `/pdf/watermark/` (영어 `/en/pdf/watermark/`)
- 상태: live (2026-10-15 배포, PR #47로 dev 병합 2026-10-16)
- 관련 문서: [히스토리](./history.md), [글꼴과 데이터 보관](../../foundations/fonts-and-data/README.md),
  [PDF 공통](../../foundations/pdf-common/README.md) (글자 넣기 워커), 같은 워커를 쓰는
  [머리말·꼬리말](../pdf-header-footer/README.md), 가이드 `src/content/guides/<언어>/watermark-pdf.md`

## 1. 어떤 기능인지

- PDF **모든 쪽**에 같은 글자(대외비, 사본, 회사 이름 등)를 워터마크로 넣는다
- 입력: PDF 하나 + 글자(최대 60자) + 글꼴(목록에서 받기 또는 내 글꼴 올리기)
- 출력: `<원래 이름>_워터마크.pdf` (영어 화면 `_watermark.pdf`)
- 고를 수 있는 것 (`App.svelte`의 값)

| 항목   | 선택지                         | 실제 값                |
| ------ | ------------------------------ | ---------------------- |
| 배치   | 가운데 하나 / 쪽 전체에 반복   | `center` / `tile`      |
| 기울기 | 비스듬히 / 가로                | 45° / 0°               |
| 크기   | 작게·보통·크게                 | 쪽 짧은 변의 5%·9%·15% |
| 진하기 | 연하게·보통·진하게             | 불투명도 0.15·0.3·0.5  |
| 색     | 회색·빨강·파랑                 | RGB 고정값             |
| 굵기   | 보통·굵게 (굵게가 있는 글꼴만) | 400 / 700              |

- 쪽 위 미리보기는 실제 글꼴로 그린다
- **하지 않는 것·한계** (FAQ와 같게)
  - 워터마크는 쪽 위의 글자라 편집 프로그램으로 지우려면 지울 수 있다 (쉽게 못 지우게 하려면 "PDF 암호 걸기"를 이어서)
  - 글꼴에 없는 글자(드문 한글, 한자, 이모지)는 넣지 못하고 미리 알린다. 목록 글꼴에는 한자가 없다
  - 이미지 워터마크는 없다 (이미지는 "PDF 이미지 넣기")
  - 결과 PDF에는 원본의 암호가 남지 않는다 (글자 넣기 워커가 연 문서를 그대로 저장)

## 2. 어떻게 만드는지

### 파일

| 파일                                            | 역할                                                                        |
| ----------------------------------------------- | --------------------------------------------------------------------------- |
| `src/tools/pdf/watermark/meta.ts`               | 이름·설명·아이콘, 묶음 `edit`, 관련 도구 `pdf/page-numbers`·`pdf/protect`   |
| `src/tools/pdf/watermark/content.ts`            | 사용법·FAQ (한·영)                                                          |
| `src/tools/pdf/watermark/messages.ts`           | 화면 문구와 선택지 타입(`Size`·`Strength`·`Tint`·`Angle`)                   |
| `src/tools/pdf/watermark/App.svelte`            | 설정, 미리보기, 실행·다운로드, `FontPicker`                                 |
| `src/lib/pdf/watermark.ts`                      | `addWatermark()`, `WatermarkOptions`                                        |
| `src/lib/pdf/watermark-layout.ts`               | `placements()` — 글자를 놓을 자리. **화면 미리보기와 워커가 같이 쓴다**     |
| `src/lib/pdf/text-pdf.ts`, `text-pdf.worker.ts` | 글자 넣기 워커 (fontkit, 빠진 글자 검사, subset 글꼴 넣기, `drawWatermark`) |
| `src/lib/pdf/page-geometry.ts`                  | `viewSize`·`toPdfPoint`·`normalizedRotation` (쪽 회전을 반영한 좌표)        |
| `src/lib/fonts/FontPicker.svelte`, `catalog.ts` | 글꼴 목록·받기·내 글꼴 올리기 (기반 문서 참고)                              |
| `src/lib/pdf/PageSheet.svelte`                  | 미리보기 쪽                                                                 |

### 처리 흐름

1. PDF를 연다. 글꼴이 없으면 "아래에서 글꼴을 받아 고르세요." (받아 둔 글꼴이 있으면 `FontPicker`가 저절로 고른다)
2. 설정을 바꿀 때마다 미리보기를 다시 그린다
   - 지금 쪽 크기(pt)를 pdf.js에서 읽는다 (`pagePt`)
   - 고른 글꼴 바이트로 `FontFace`를 등록하고, `OffscreenCanvas`의 `measureText`로 글자 폭을 잰다
   - `placements()`로 자리를 구해 `%` 위치·`rotate(-각도)`로 겹쳐 그린다
3. "워터마크 넣기" → `canUse('pdf/watermark')` → `addWatermark()` → `runTextJob({ kind: 'watermark' })`
4. 워커
   1. 원래 암호로 PDF를 연다
   2. `missingChars()`로 글꼴에 없는 글자를 찾으면 `missing`으로 돌려준다 → 화면이 "이 글꼴에 없는 글자가 있습니다: …"
   3. `registerFontkit` 후 `embedFont(font, { subset: true })` — 쓴 글자만 넣는다
   4. 쪽마다 `viewSize`로 화면 기준 크기를 구하고, 글자 크기 = 비율 × 짧은 변, `placements()`의 점마다
      글자 가운데가 오도록 기준점을 잡아 `drawText` (회전 = 쪽 회전 + 기울기, `opacity`)
5. 결과의 `signature`(글자·글꼴 id·굵기·설정)가 지금과 같을 때만 "다운로드"

### 결정과 이유

- **fontkit을 쓰는 워커를 고치기 워커와 따로 둔다**: fontkit이 커서, 쪽 번호처럼 글꼴이 필요 없는 도구가 무거워지지 않게
  (커밋 `eea1b30`). 뒤에 머리말·꼬리말·편집·양식 채우기도 이 워커에 붙었다
- **쓴 글자만 넣는다(subset)**: 글꼴 전체를 넣으면 PDF가 몇 MB 커진다. E2E에서 결과가 60KB 미만인지 본다
- **자리 계산을 한 곳(`watermark-layout.ts`)에 두고 화면과 워커가 같이 쓴다**: 미리보기와 결과가 어긋나지 않게.
  워커가 불러도 다른 모듈을 끌고 오지 않게 계산만 둔다
- **반복 배치는 한 쪽에 최대 300개**(`MAX_TILES`)
  - 처음엔 앞에서부터 채우다 300개에서 멈춰 쪽 위쪽만 덮였다 → 넘으면 간격을 고르게 넓혀 다시 놓는다
  - 아주 긴 쪽(1:1000)에서는 후보를 다 만들다 화면이 멈출 수 있었다 → 넓이로 개수를 먼저 어림해 간격을 넓혀 두고 만든다
- 미리보기 색은 디자인 토큰이 아니라 **PDF에 넣는 RGB 값에서 만든다** (`rgbCss`). 결과와 같은 색이어야 해서다

### 주의할 점

- 미리보기 `$effect`는 모두 `current` 플래그로 늦게 온 결과를 버린다
  - 글꼴을 바꾼 뒤 이전 글꼴이 늦게 읽히면 미리보기 글꼴이 결과와 달라졌다 (`e16d6fa`)
  - 쪽을 빠르게 넘기면 이전 쪽 크기로 그려졌다 (`40db1d8`)
- 고른 굵기가 그 글꼴에 없으면 400을 쓴다 (`font.files[weight] ?? font.files[400]`). 굵기 선택은 `hasBold`일 때만 보인다
- 글꼴 고르기·받기·올리기의 순서 문제(마지막 선택만 반영, 올린 글꼴 id 등)는 `FontPicker` 쪽에서 고쳤다.
  자세한 것은 [글꼴 기반 문서](../../foundations/fonts-and-data/README.md)
- 격리 frame에서 HTML `style` 속성은 CSP가 막으므로 미리보기 위치·색은 Svelte `style:` 지시자로 준다

## 3. 구현 체크리스트

- [x] 폴더와 레지스트리 등록
- [x] 글자 넣기 워커(fontkit, subset, 빠진 글자 알림), 자리 계산 공유
- [x] 가운데·반복, 기울기·크기·진하기·색·굵기, 실제 글꼴 미리보기
- [x] 돌린 쪽에서도 화면에서 정한 각도로 보이기 (`normalizedRotation` 더함)
- [x] 한·영 문구, 사용법·FAQ, 가이드 글(`watermark-pdf.md`)
- [x] E2E (`pdf-watermark.spec.ts`, 로컬 처리 약속 포함)
- [x] `status: 'live'`, 배포 (2026-10-15)
- [ ] 이미지 워터마크, 쪽 고르기(일부 쪽만)는 없다

## 4. 검증

### 자동 테스트

`tests/e2e/pdf-watermark.spec.ts`

- `글꼴을 받아 모든 쪽에 워터마크를 넣는다` — "기본 고딕 받기" 뒤 `사본 COPY`, 결과 이름 `three-pages_워터마크.pdf`,
  세 쪽 모두 원래 글자 + 워터마크 글자, 파일 60KB 미만(subset), `expectLocalOnly`
- `받은 글꼴은 다시 들어와도 받지 않고, 지워지면 다시 받으라고 알린다` — 두 번째 방문에 글꼴 요청 0개·저절로 고름,
  `caches.delete('justusing-data-v1')` 뒤 "지워졌습니다" 안내
- `목록과 다른 글꼴 파일은 쓰지 않는다` — 바꿔치기한 응답은 "받지 못했습니다", 원래대로 돌리면 다시 받아 쓸 수 있음
- `내 글꼴을 올려 쓰고, 글꼴에 없는 글자는 알려 준다` — `abc.otf`로 `가`를 넣으면 빠진 글자 안내, `CAB`는 들어감,
  같은 글꼴을 다시 올리면 이전 결과 대신 실행 버튼

### 직접 확인

- 리뷰 답글에 적힌 확인: 300×3000pt 쪽에 작은 글자로 반복하면 281개가 위(y≈0)부터 아래(y≈3000)까지 퍼짐,
  10×10000pt 쪽에서 295개를 6ms에 계산
- 브라우저별로 직접 확인한 기록은 커밋·PR에 남아 있지 않다

### 히스토리

- [history.md](./history.md): PR #47 (글꼴 기반과 함께 만든 PR)와 리뷰 지적 12개
