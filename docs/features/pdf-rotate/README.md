# PDF 회전 (`pdf/rotate`)

- 주소: `/pdf/rotate/` (영어 `/en/pdf/rotate/`)
- 상태: live (2026-10-11 `9eeb06e`에서 공개로 바꿈)
- 관련 문서: [히스토리](./history.md), [PDF 공통](../../foundations/pdf-common/README.md),
  [격리 frame](../../foundations/frame-isolation/README.md)
- 5-2단계

## 1. 어떤 기능인지

- 옆으로 누운 스캔 문서처럼 방향이 틀린 쪽을 90°씩 돌려 새 PDF로 받는다
- 입력: PDF 하나 (암호 PDF는 열 때 암호 입력)
- 출력: PDF 하나, `<이름>_회전.pdf` (영어 `_rotated.pdf`)
- 할 수 있는 것
  - 썸네일마다 ↺(왼쪽)·↻(오른쪽) 90°
  - "전체 ↺"·"전체 ↻"로 모든 쪽을 한꺼번에
  - 돌린 쪽은 초록 테두리와 각도로 표시, "되돌리기"로 처음 상태
- 한계: 결과 파일에는 암호가 걸리지 않는다 (FAQ). 90° 단위만 돌린다

## 2. 어떻게 만드는지

### 파일

| 파일                                     | 역할                                                                |
| ---------------------------------------- | ------------------------------------------------------------------- |
| `src/tools/pdf/rotate/meta.ts`           | 이름·설명·아이콘, 묶음 `pages`, 관련 도구(정리·보기)                |
| `src/tools/pdf/rotate/content.ts`        | 사용법 4단계·FAQ 3개                                                |
| `src/tools/pdf/rotate/messages.ts`       | 막대 안내("2쪽을 돌렸습니다", "돌린 쪽이 없습니다"), 전체 버튼 이름 |
| `src/tools/pdf/rotate/App.svelte`        | 전체 돌리기·되돌리기 막대, 실행 막대                                |
| `src/tools/pdf/rotate/RotateGrid.svelte` | 쪽마다 돌리는 썸네일 격자, `normalize(angle)`                       |
| `src/lib/pdf/SinglePdfTool.svelte`       | 파일 고르기·암호·파일 이름 막대                                     |
| `src/lib/pdf/assemble.ts`                | `assemblePdf()`의 `rotate` (원래 방향에 더할 시계 방향 각도)        |

### 처리 흐름

1. `SinglePdfTool`이 파일을 열면 `rotations`를 쪽 수만큼 0으로 채운다
2. 쪽 버튼·전체 버튼은 `rotations[i]`에 ±90을 **누적**한다. 썸네일은 CSS `rotate`로 돌린다
3. 실제로 돌린 쪽 수(`normalize(angle) !== 0`)가 0이면 실행 버튼을 끈다
4. "PDF 회전" → `canUse('pdf/rotate')` → `assemblePdf`에 모든 쪽을 `{ index, rotate: normalize(angle) }`로 넘긴다
5. 워커는 `page.setRotation(원래 각도 + rotate)`만 바꾼다
6. 결과는 쪽마다의 실제 각도(`signature`)와 묶여 있어, 다시 돌리면 결과를 버린다

### 결정과 이유

- **방향 정보(/Rotate)만 바꾼다**: 쪽을 다시 그리지 않아 화질이 그대로다 (FAQ)
- **썸네일은 다시 그리지 않고 CSS로 돌린다**: 가볍고, 누른 방향으로 도는 모션이 보인다
- **각도는 누적으로 두고 결과에는 나머지만**: 270 → 0 처럼 되돌아 도는 모션이 생기지 않게 (`RotateGrid.svelte` 머리 주석)
- **되돌리기는 가까운 쪽으로**: 쪽마다 0 또는 360 중 가까운 쪽으로 보내 한 바퀴 도는 모션을 막는다 (`resetAll`)

### 주의할 점

- 결과 계산에는 반드시 `normalize()`를 거친 값을 쓴다 (누적 값 그대로 넘기지 않는다)
- 원래 `/Rotate`가 있는 쪽은 그 위에 더한다. 워커가 `(원래 + rotate) % 360`으로 맞춘다
- 좁은 화면에서 전체 돌리기 버튼이 두 줄로 흩어졌던 적이 있다 (`1009aaf`). 막대 버튼을 바꾸면 390px에서 본다

## 3. 구현 체크리스트

- [x] 폴더와 레지스트리 등록, `status: 'live'`
- [x] 쪽마다 90° 돌리기 격자(모션 포함), 전체 돌리기, 되돌리기
- [x] 조립 워커로 결과 만들기, 실행 전 `canUse()`, 바꾸면 결과 무효화
- [x] 암호 PDF (결과에는 암호 없음)
- [x] `SinglePdfTool`·`ActionBar` 공통 틀로 옮김 (`18f8dd3`)
- [x] 한·영 문구, 사용법·FAQ
- [x] E2E (로컬 처리 약속 포함)
- [ ] 가이드 글 없음
- [ ] 홀수·짝수 쪽만 돌리기, 여러 쪽을 골라 한꺼번에 돌리기는 없다

## 4. 검증

### 자동 테스트

`tests/e2e/pdf-rotate.spec.ts` (받은 PDF를 열어 쪽마다 `/Rotate` 각도를 확인)

- 쪽마다·전체로 돌린 각도가 결과에 들어간다 (파일 이름 `three-pages_회전.pdf`, 각도 `[0, 270, 270]`)
- 되돌리기로 처음 상태가 되면 실행할 수 없다 ("돌린 쪽이 없습니다.")
- 암호 PDF도 풀어서 돌린다
- 돌리는 동안의 요청에는 파일이 기기 밖으로 나가는 것이 없다 (`expectLocalOnly`)

### 직접 확인

- 2026-10-11: 좁은 화면에서 전체 돌리기 버튼이 두 줄로 흩어지던 것을 고침 (`1009aaf`)

### 히스토리

- [history.md](./history.md): 커밋 기록 (PR 절차 전에 만들어 PR 기록이 없다)
