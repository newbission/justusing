# PDF 쪽 번호 넣기 (`pdf/page-numbers`)

- 주소: `/pdf/page-numbers/` (영어 `/en/pdf/page-numbers/`)
- 상태: live (2026-10-15 배포, PR #31)
- 관련 문서: [히스토리](./history.md), [PDF 공통](../../foundations/pdf-common/README.md),
  [격리 frame](../../foundations/frame-isolation/README.md), 글자를 더 넣으려면 [머리말·꼬리말](../pdf-header-footer/README.md)
- 가이드: 없음 (머리말·꼬리말, 워터마크 가이드가 이 도구를 가리킨다)

## 1. 어떤 기능인지

- PDF의 모든 쪽에 쪽 번호를 넣는다. 글꼴을 받지 않고 몇 가지 모양 중에 바로 고른다.
- 입력: PDF 한 개 (암호 PDF는 암호를 넣어 연다)
- 고르는 것
  - 위치: "아래 가운데" / "아래 오른쪽" / "위 오른쪽"
  - 모양: `1` / `1 / 10` / `- 1 -` (고르기 버튼에 그 PDF의 쪽 수로 보여 준다)
  - "시작 번호": 첫 쪽에 붙일 번호 (1 이상, 6자리까지). 잘못 넣으면 막대에 "시작 번호는 1 이상의 숫자로 입력하세요."
- 미리보기: 쪽 격자 아래에 각 쪽에 들어갈 번호가 보인다
- 출력: `원래이름_쪽번호.pdf` (영어 `_numbered.pdf`)
- 할 수 있는 것 / 한계 (FAQ와 같음)
  - 돌린 쪽에서도 화면에 보이는 방향 기준으로 똑바로 넣는다
  - 원본 쪽 위에 번호 글자만 더한다. 글자·이미지는 그대로
  - 일부 쪽만 번호를 넣거나 표지를 빼는 기능은 없다. FAQ는 나누기 → 번호 → 합치기를 안내한다
    (머리말·꼬리말 도구에는 "표지 빼기"가 있다)
  - `1 / 10` 모양의 전체 수는 `시작 번호 + 쪽 수 − 1`이다 (시작 5, 3쪽이면 `5 / 7` … `7 / 7`)

## 2. 어떻게 만드는지

### 파일

| 파일                                     | 역할                                                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `src/tools/pdf/page-numbers/meta.ts`     | 이름·설명·아이콘, 묶음 `edit`, 관련 도구(merge, organize)                                                     |
| `src/tools/pdf/page-numbers/content.ts`  | 사용법·FAQ (한·영)                                                                                            |
| `src/tools/pdf/page-numbers/messages.ts` | 화면 문구                                                                                                     |
| `src/tools/pdf/page-numbers/Frame.astro` | 격리 frame 페이지                                                                                             |
| `src/tools/pdf/page-numbers/App.svelte`  | 화면: 위치·모양·시작 번호, 미리보기 격자(`PageSelectGrid`의 `note`)                                           |
| `src/lib/pdf/modify.ts`                  | `modifyPdf()`, 작업 `{ kind: 'page-numbers', position, format, start }`, 타입 `NumberPosition`·`NumberFormat` |
| `src/lib/pdf/modify.worker.ts`           | `apply()`의 `page-numbers`: 글자 그리기, `numberLabel()`                                                      |
| `src/lib/pdf/page-geometry.ts`           | `viewSize()`·`toPdfPoint()`·`normalizedRotation()`: 화면 기준 자리 → PDF 좌표                                 |

### 처리 흐름

1. `SinglePdfTool`이 PDF를 연다 → 위치·모양·시작 번호를 고른다
2. "쪽 번호 넣기" → `canUse('pdf/page-numbers')` → 고른 값으로 작업을 만든다
3. `modifyPdf(source, job)`: 원본 바이트를 복사해 워커로 → `PDFDocument.load(bytes, { password })`
4. 워커에서 Helvetica를 넣고, 쪽마다
   - 글자: `numberLabel(format, start + i, start + 쪽 수 − 1)`
   - 화면에 보이는 쪽(`viewSize`) 기준으로 자리 계산: 크기 11pt, 가장자리에서 28pt(약 10mm)
   - `toPdfPoint()`로 PDF 좌표로 바꾸고, 쪽 회전만큼 글자도 돌려(`rotate`) 회색(0.2)으로 그린다
5. `save()` → "다운로드"

### 결정과 이유

- **표준 글꼴 Helvetica**: 숫자·`/`·`-`만 쓰므로 한글 글꼴을 받지 않는다. 그래서 가볍다 (7단계 '가벼운 PDF 도구').
- **화면 기준 자리**: 자리는 화면에 보이는 쪽 기준으로 정하고 워커가 쪽 회전·CropBox를 계산한다
  ([PDF 공통](../../foundations/pdf-common/README.md)의 `modify.ts` 규칙). 0·90·180·270도 쪽을 E2E로 확인한다.
- **화면 미리보기와 워커가 같은 모양 규칙**: 화면의 `label()`과 워커의 `numberLabel()`은 같아야 한다 (주석에 적혀 있다).
- **결과 서명**: 위치·모양·시작 번호가 바뀌면 이전 결과의 다운로드를 숨긴다.

### 주의할 점

- 모양 규칙을 바꾸면 `App.svelte`의 `label()`과 `modify.worker.ts`의 `numberLabel()`을 함께 고친다.
- 시작 번호 칸은 `type="text"` + `inputmode="numeric"`이다. 빈 칸·잘못된 값도 그대로 두고 막대에서 알린다 (`start = 0`이면 버튼 꺼짐).
- 이 도구의 결과에는 암호가 없다 (`modify.worker.ts`는 암호 걸기 말고는 풀어서 저장한다).

## 3. 구현 체크리스트

- [x] 폴더와 레지스트리 등록
- [x] 위치 3가지, 모양 3가지, 시작 번호
- [x] 쪽 격자 아래 번호 미리보기
- [x] 돌린 쪽에서도 화면 기준으로 똑바로
- [x] 한·영 문구, 사용법·FAQ
- [x] E2E
- [x] 휴대폰(390) 화면 캡처 확인 (PR #31)
- [x] `status: 'live'`
- [ ] 일부 쪽만 / 표지 빼기, 글자 크기·색 고르기는 없다 (필요하면 머리말·꼬리말 도구)
- [ ] 가이드 글 없음

## 4. 검증

### 자동 테스트

`tests/e2e/pdf-light-tools.spec.ts` (암호 해제·암호 걸기·글자 추출과 같은 파일)

- 모양 `1 / 3`과 시작 번호 5: 격자 아래 `5 / 7`·`6 / 7`·`7 / 7`, `three-pages_쪽번호.pdf`의 쪽 글자가
  `Page 15 / 7`·`Page 26 / 7`·`Page 37 / 7` (원래 글자 + 번호)
- 0·90·180·270도 돌린 4쪽 PDF: 각 쪽의 번호가 정확히 하나, 화면 좌표로 가로 가운데에서 20 이내, 아래에서 40 이내
- 같은 파일의 로컬 처리 테스트는 암호 걸기 도구로 확인한다. 이 도구만의 `expectLocalOnly` 테스트는 없다

### 직접 확인

- 2026-10-14 (PR #31): 휴대폰(390) 화면 캡처로 배치 확인

### 히스토리

- [history.md](./history.md): PR·커밋·리뷰 지적과 처리
