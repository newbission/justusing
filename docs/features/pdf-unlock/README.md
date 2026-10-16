# PDF 암호 해제 (`pdf/unlock`)

- 주소: `/pdf/unlock/` (영어 `/en/pdf/unlock/`)
- 상태: live (2026-10-15 배포, PR #31로 dev 병합)
- 관련 문서: [히스토리](./history.md), [PDF 공통](../../foundations/pdf-common/README.md),
  [격리 frame](../../foundations/frame-isolation/README.md), 짝 도구 [암호 걸기](../pdf-protect/README.md)

## 1. 어떤 기능인지

- 암호를 아는 PDF의 열기 암호와 인쇄·복사 제한을 풀어 **암호·제한 없는 PDF**로 저장한다
- 입력: PDF 하나. 열 때 암호를 묻는 PDF는 암호를 넣어 연다 (`SinglePdfTool`의 암호 입력)
- 출력: `<원래 이름>_암호해제.pdf` (영어 화면 `_unlocked.pdf`)
- 화면은 PDF 상태를 세 가지로 알려 준다 (`messages.ts`)
  - `locked`: 암호를 넣어 연 PDF → "암호를 풀었습니다. 암호 없는 PDF로 저장합니다."
  - `restricted`: 암호 없이 열리지만 암호화된(인쇄·복사 제한) PDF → "제한 없는 PDF로 저장합니다."
  - `plain`: 암호도 제한도 없음 → "이 PDF에는 암호나 제한이 없습니다." 실행 버튼이 꺼진다
- **하지 않는 것·한계** (FAQ와 같게)
  - 암호를 모르는 PDF는 풀 수 없다. 암호를 알아내는 기능은 없다
  - 내 파일이거나 다룰 권리가 있는 파일에만 쓰라고 화면(`note`)과 FAQ에 밝힌다
  - 풀지 못하면 "파일이 손상되었거나 지원하지 않는 암호 방식일 수 있습니다"라고 알린다

## 2. 어떻게 만드는지

### 파일

| 파일                                        | 역할                                                                         |
| ------------------------------------------- | ---------------------------------------------------------------------------- |
| `src/tools/pdf/unlock/meta.ts`              | 이름·설명·아이콘, 묶음 `security`, 관련 도구 `pdf/protect`·`pdf/merge`       |
| `src/tools/pdf/unlock/content.ts`           | 사용법·FAQ (한·영)                                                           |
| `src/tools/pdf/unlock/messages.ts`          | 화면 문구 (상태 세 가지, 결과 이름 뒤 말 `suffix`)                           |
| `src/tools/pdf/unlock/App.svelte`           | 화면: 상태 판단, 실행·다운로드 막대, 쪽 썸네일(`PageSelectGrid`)             |
| `src/tools/pdf/unlock/Frame.astro`          | 격리 frame 페이지                                                            |
| `src/lib/pdf/SinglePdfTool.svelte`          | 파일 고르기·암호 입력·파일 이름 막대 (`LoadedPdf.password`에 연 암호를 둔다) |
| `src/lib/pdf/modify.ts`, `modify.worker.ts` | `modifyPdf(source, { kind: 'unlock' })` — pdf-lib로 풀어 다시 저장           |

### 처리 흐름

1. `SinglePdfTool`이 pdf.js로 연다. 암호가 필요하면 암호를 받아 다시 연다
2. `onload`에서 상태를 정한다
   - `loaded.password`가 있으면 `locked`
   - 없으면 pdf.js `getMetadata()`의 `info.EncryptFilterName`이 있으면 `restricted`, 없으면 `plain`
3. "암호 해제" → `canUse('pdf/unlock')` → `modifyPdf`
4. 워커는 `PDFDocument.load(bytes, { password: password ?? '' })`로 열고 아무것도 고치지 않은 채 `save()`
   - 암호로 연 문서를 그대로 저장하면 암호 없는 PDF가 된다 (`apply()`의 `case 'unlock'`은 빈 처리)
   - 열기 암호 없이 제한만 걸린 PDF는 빈 암호(`''`)로 풀린다
5. 결과를 `run = { kind: 'done' }`에 두고 "다운로드"로 받는다 (`downloadFile`)

### 결정과 이유

- 따로 된 해제 코드를 두지 않고 고치기 워커의 공통 동작을 쓴다. 이 워커는 원래 **암호 걸기 말고는 결과에 암호를
  남기지 않는다** (`modify.worker.ts` 주석). 해제는 "아무것도 안 고치고 저장"과 같다
- 암호 PDF인지·제한만 걸렸는지는 pdf.js가 이미 연 결과로 판단한다 (따로 PDF를 다시 읽지 않는다)

### 주의할 점

- `PDFDocument.load`에 `password`를 넘기지 않으면 암호화된 PDF를 열지 않는다. 그래서 `?? ''`를 꼭 둔다
- `plain`일 때 버튼을 끄는 조건(`protection === 'plain'`)을 지우면 의미 없는 결과를 만들게 된다
- 다른 파일을 열면 이전 결과를 쓰지 않도록 `pdf !== source`로 늦게 온 결과를 버린다

## 3. 구현 체크리스트

- [x] 폴더(`meta.ts`·`content.ts`·`Frame.astro`·`App.svelte`·`messages.ts`)와 레지스트리 등록
- [x] 암호 PDF 해제, 제한만 걸린 PDF 해제, 암호 없는 PDF는 실행 막기
- [x] 한·영 문구, 사용법·FAQ
- [x] E2E (`pdf-light-tools.spec.ts`)
- [x] `status: 'live'`, 배포 (2026-10-15)
- [ ] 가이드 글 없음 (`src/content/guides/`에 이 도구를 안내하는 글이 없다)
- [ ] pdf-lib(`@cantoo/pdf-lib`)가 풀지 못하는 암호 방식은 "지원하지 않는 암호 방식"으로만 알린다 (어떤 방식이 안 되는지 따로 확인한 기록 없음)

## 4. 검증

### 자동 테스트

`tests/e2e/pdf-light-tools.spec.ts`

- `암호 해제: 암호를 넣어 연 PDF를 암호 없는 PDF로 받는다` — `encrypted.pdf`를 암호 `1234`로 열고, 결과 이름
  `encrypted_암호해제.pdf`, pdf.js로 암호화 아님, 글자 `Secret page` 그대로
- `암호 해제: 인쇄·복사 제한만 걸린 PDF는 암호 없이 풀고, 암호 없는 PDF는 풀 것이 없다` — 소유자 암호만 건 PDF를
  만들어 제한 안내 → 풀린 결과 확인, 이어서 평범한 PDF는 "암호나 제한이 없습니다" + 버튼 꺼짐
- 같은 파일의 `처리하는 동안의 요청에는 파일이 기기 밖으로 나가는 것이 없다`는 암호 걸기 화면으로 확인한다
  (같은 고치기 워커를 쓴다)

### 직접 확인

- 브라우저별로 직접 확인한 기록은 커밋·PR에 남아 있지 않다

### 히스토리

- [history.md](./history.md): PR #31 (암호 해제·암호 걸기·쪽 번호·글자 추출을 함께 만든 PR)
