# PDF 암호 걸기 (`pdf/protect`)

쓴 날 2026-10-16 · 고친 날 2026-10-16

- 주소: `/pdf/protect/` (영어 `/en/pdf/protect/`)
- 상태: live (2026-10-15 배포, PR #31로 dev 병합)
- 관련 문서: [히스토리](./history.md), [PDF 공통](../../foundations/pdf-common/README.md),
  [격리 frame](../../foundations/frame-isolation/README.md), 짝 도구 [암호 해제](../pdf-unlock/README.md)

## 1. 어떤 기능인지

- PDF에 **열기 암호**를 걸어, 열 때 암호를 묻는 PDF로 저장한다
- 입력: PDF 하나. 이미 암호가 걸린 PDF는 지금 암호로 연 뒤 새 암호를 걸 수 있다 (암호 바꾸기)
- 출력: `<원래 이름>_암호.pdf` (영어 화면 `_protected.pdf`)
- 암호 방식: PDF 표준 AES-256 (FAQ). pdf-lib `encrypt()`의 기본값이 AES-256(`/V 5`, `/R 6`)이다
- **하지 않는 것·한계** (화면·FAQ와 같게)
  - 암호를 잊으면 열 수 없고 되찾아 줄 수 없다. 암호는 어디에도 저장하지 않는다 (화면 `note`)
  - 인쇄·복사 같은 권한을 따로 고르는 기능은 없다. 사용자 암호와 소유자 암호를 같은 값으로 건다

## 2. 어떻게 만드는지

### 파일

| 파일                                        | 역할                                                     |
| ------------------------------------------- | -------------------------------------------------------- |
| `src/tools/pdf/protect/meta.ts`             | 이름·설명·아이콘, 묶음 `security`                        |
| `src/tools/pdf/protect/content.ts`          | 사용법·FAQ (한·영)                                       |
| `src/tools/pdf/protect/messages.ts`         | 화면 문구 ("새 암호"·"암호 확인", 불일치 안내, `suffix`) |
| `src/tools/pdf/protect/App.svelte`          | 화면: 암호 두 칸, 실행·다운로드 막대                     |
| `src/tools/pdf/protect/Frame.astro`         | 격리 frame 페이지                                        |
| `src/lib/pdf/modify.ts`, `modify.worker.ts` | `modifyPdf(source, { kind: 'protect', password })`       |

### 처리 흐름

1. `SinglePdfTool`로 PDF를 연다 (암호 PDF면 지금 암호를 넣는다)
2. "새 암호"·"암호 확인"을 적는다. `problem`이 실행을 막는다: 비었으면 "걸 암호를 입력하세요.",
   다르면 "두 암호가 서로 다릅니다."
3. "암호 걸기" 버튼 또는 칸에서 Enter → `canUse('pdf/protect')` → `modifyPdf`
4. 워커는 원래 암호로 열고 `doc.encrypt({ userPassword, ownerPassword })`에 같은 암호를 넣어 저장
5. 결과는 `signature`(건 암호)와 함께 둔다. 암호를 바꾸면 이전 결과는 숨고 다시 실행해야 한다

### 결정과 이유

- 격리 frame은 `<form>` 제출이 막혀 있어(sandbox에 `allow-forms` 없음) Enter 키를 `onkeydown`에서 직접 처리한다
- 암호 칸은 `type="password"`, `autocomplete="new-password"` (브라우저가 저장된 암호를 채우지 않게)
- 결과가 지금 암호와 맞는지 `signature`로 확인해, 암호를 바꾼 뒤 이전 암호의 파일을 받는 일을 막는다

### 주의할 점

- 고치기 워커의 다른 작업은 모두 **결과에 암호를 남기지 않는다**. 암호가 남는 것은 이 도구뿐이다.
  다른 도구(워터마크 등) 결과에 암호를 걸려면 이 도구를 한 번 더 써야 한다 (워터마크 FAQ도 이렇게 안내한다)
- 암호 문자열은 워커로 메시지에 실려 갈 뿐 저장·전송하지 않는다. 로그나 통계에 넣지 않는다

## 3. 구현 체크리스트

- [x] 폴더와 레지스트리 등록
- [x] 두 칸 확인, Enter로 실행, AES-256 암호 걸기, 암호 PDF의 암호 바꾸기
- [x] 한·영 문구, 사용법·FAQ
- [x] E2E (`pdf-light-tools.spec.ts`, 로컬 처리 약속 포함)
- [x] `status: 'live'`, 배포 (2026-10-15)
- [ ] 가이드 글 없음
- [ ] 권한(인쇄·복사 막기)만 따로 거는 기능 없음 (만들지 않기로 한 기록도 없다)

## 4. 검증

### 자동 테스트

`tests/e2e/pdf-light-tools.spec.ts`

- `암호 걸기: 두 암호가 같아야 걸고, 받은 PDF는 그 암호로만 열린다` — 처음엔 버튼 꺼짐, 다른 암호면 불일치 안내와
  버튼 꺼짐, 같게 고치면 실행. 결과 이름 `three-pages_암호.pdf`, 암호 없이 열면 실패, `secret`으로 열면 세 쪽 글자 그대로
- `처리하는 동안의 요청에는 파일이 기기 밖으로 나가는 것이 없다` — 이 도구로 파일 고르기부터 다운로드 버튼까지의
  요청을 모아 `expectLocalOnly`로 확인

### 직접 확인

- 브라우저별로 직접 확인한 기록은 커밋·PR에 남아 있지 않다

### 히스토리

- [history.md](./history.md): PR #31 (암호 해제·암호 걸기·쪽 번호·글자 추출을 함께 만든 PR)
