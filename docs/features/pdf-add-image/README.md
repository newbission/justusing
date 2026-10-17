# PDF 이미지 넣기 (`pdf/add-image`)

쓴 날 2026-10-16 · 고친 날 2026-10-16

- 주소: `/pdf/add-image/` (영어 `/en/pdf/add-image/`)
- 상태: live (2026-10-15 배포, PR #32로 dev 병합)
- 관련 문서: [히스토리](./history.md), [PDF 공통](../../foundations/pdf-common/README.md),
  [이미지 공통](../../foundations/image-common/README.md), 같은 화면을 쓰는 [서명 넣기](../pdf-sign/README.md)

## 1. 어떤 기능인지

- PDF 쪽 위 원하는 자리에 로고·도장·사진 같은 이미지를 넣는다
- 입력: PDF 하나 + 이미지 한 장 (`accept="image/*"`)
- 출력: `<원래 이름>_이미지.pdf` (영어 화면 `_with-image.pdf`)
- 할 수 있는 것
  - 끌어서 옮기기, 오른쪽 아래 손잡이로 비율을 지킨 채 크기 바꾸기, 키보드(화살표 이동, `+`·`-` 크기, Shift는 크게)
  - 넣을 쪽: "이 쪽만" 또는 "모든 쪽" (쪽 크기가 달라도 같은 비율 자리에, 이미지 비율 그대로)
  - 배경이 투명한 PNG는 투명한 채로 들어간다
- **하지 않는 것·한계** (FAQ와 같게)
  - JPG는 투명한 부분이 없어 사각형 그대로 들어간다
  - 받은 PDF에서는 이미지가 쪽 내용이 되어 이 도구로 다시 옮기거나 지울 수 없다
  - 쪽마다 다른 자리에 넣는 기능은 없다 (한 쪽씩 넣은 결과로 다시 한다)

## 2. 어떻게 만드는지

### 파일

| 파일                                        | 역할                                                                                               |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/tools/pdf/add-image/meta.ts`           | 이름·설명·아이콘, 묶음 `edit`, 관련 도구 `pdf/sign`·`pdf/from-image`                               |
| `src/tools/pdf/add-image/content.ts`        | 사용법·FAQ (한·영)                                                                                 |
| `src/tools/pdf/add-image/messages.ts`       | 화면 문구 (`StampMessages` + 이미지 고르기 문구)                                                   |
| `src/tools/pdf/add-image/App.svelte`        | 이미지 고르기와 준비만 하고 나머지는 `StampTool`에 맡긴다                                          |
| `src/lib/pdf/StampTool.svelte`              | 이미지 찍기 공통 화면: 넣을 쪽 고르기, 배치 화면, 실행·다운로드                                    |
| `src/lib/pdf/PlacementEditor.svelte`        | 쪽 위에 이미지를 놓는 화면 (끌기·손잡이·키보드, 쪽 안으로 맞추기 `fit`)                            |
| `src/lib/pdf/PageSheet.svelte`              | 쪽 하나를 크게 그리고 위에 겹칠 화면을 받는 틀 (‹ › 쪽 넘기기)                                     |
| `src/lib/image/embed.ts`, `embed.worker.ts` | `embedImage(file)` — 워커에서 `toEmbeddable`로 넣을 수 있는 이미지 준비                            |
| `src/lib/image/prepare.ts`                  | `toEmbeddable`: JPG·PNG는 그대로, EXIF 방향이 붙은 JPG는 바로 세워 다시 저장, 그 밖의 형식은 PNG로 |
| `src/lib/pdf/modify.ts`, `modify.worker.ts` | `{ kind: 'stamp-image', image, place, pages }` 처리                                                |

### 처리 흐름

1. `SinglePdfTool`로 PDF를 연다 → `StampTool`이 이미지가 없으므로 고르기 화면(`picker`)을 보여 준다
2. "이미지 선택" → `embedImage(file)`(워커) → `{ url: blob 주소, embed: { kind, bytes, width, height } }`
3. `PlacementEditor`에 처음 자리 `{ x: 0.35, y: 0.35, width: 0.3 }` (화면에 보이는 쪽 기준 비율)
4. "이미지 넣기" → `canUse('pdf/add-image')` → `modifyPdf(source, { kind: 'stamp-image', ... })`
5. 워커는 `embedJpg`·`embedPng`로 한 번 넣고, 고른 쪽마다
   - 쪽 비율이 달라도 쪽 밖으로 나가지 않게 줄이고(`fit`) 안으로 민다
   - 이미지 왼쪽 아래(화면 기준)를 `toPdfPoint`로 PDF 좌표로 바꾸고, 쪽 회전만큼 돌려 `drawImage`
6. 결과의 `signature`(이미지 번호·쪽·자리)가 지금 설정과 같을 때만 "다운로드"를 보여 준다

### 결정과 이유

- 자리를 **화면에 보이는 쪽 기준 비율**로 넘기고 회전·CropBox 계산은 워커가 한다. 돌린 쪽에서도 화면과 결과가 같다
- 자리는 너비만 받고 높이는 이미지 비율로 정한다 (크기가 다른 쪽에 넣어도 이미지가 늘어나지 않게)
- 이미지 준비(방향 바로잡기, 형식 바꾸기)는 워커에서 한다 (리뷰 P1: 화면이 멈추지 않게)
- 이미지를 연달아 고르면 요청 번호(`latest`)로 마지막 것만 쓴다
- 아주 긴 이미지는 최소 폭(`MIN_WIDTH` 0.03)보다 **쪽 안에 들어가는 것을 먼저** 지킨다
- 서명 넣기와 화면이 같아 `StampTool`을 같이 쓰고, 이미지를 고르는 부분(`picker`·`actions` snippet)만 다르다

### 주의할 점

- `PlacementEditor`의 `fit`과 워커의 쪽마다 줄이기는 둘 다 있어야 한다. 화면은 지금 쪽만 보므로
  "모든 쪽"에서 비율이 다른 쪽(가로 쪽 등)은 워커가 다시 맞춘다
- 쪽 바탕색은 `--color-paper` 토큰을 쓴다 (리뷰 지적으로 토큰을 새로 만들었다)
- 새 이미지를 고르면 이전 blob 주소를 `URL.revokeObjectURL`로 돌려준다

## 3. 구현 체크리스트

- [x] 폴더와 레지스트리 등록
- [x] 공통 화면(`StampTool`·`PlacementEditor`·`PageSheet`), 이미지 준비 워커, 고치기 워커의 `stamp-image`
- [x] 이 쪽만·모든 쪽, 돌린 쪽, 비율이 다른 쪽에서 쪽 밖으로 나가지 않기
- [x] 키보드로 옮기기·크기 바꾸기
- [x] 한·영 문구, 사용법·FAQ
- [x] E2E (`pdf-stamp.spec.ts`, 로컬 처리 약속 포함)
- [x] `status: 'live'`, 배포 (2026-10-15)
- [ ] 가이드 글 없음
- [ ] 한 번에 이미지 하나만 넣는다 (여러 이미지·쪽마다 다른 자리는 없다)

## 4. 검증

### 자동 테스트

`tests/e2e/pdf-stamp.spec.ts` (받은 PDF를 pdf.js로 열어 이미지가 놓인 자리를 화면 기준 비율로 잰다)

- `이미지 넣기: 키보드로 옮기고 키운 자리에, 이 쪽에만 넣는다` — 이미지 고르기 전 버튼 꺼짐, Shift+→·`+` 뒤
  x 0.4·y 0.35·폭 0.31, 높이는 이미지 비율, 첫 쪽에만, 결과 이름 `three-pages_이미지.pdf`
- `이미지 넣기: 모든 쪽을 고르면 돌린 쪽에도 화면 기준 같은 자리에 넣는다` — 0·90·180·270° 돌린 네 쪽 모두 같은 자리
- `이미지 넣기: 크게 키워도 이미지가 어느 쪽에서도 쪽 밖으로 나가지 않는다` — 가로 쪽에서 세로 이미지를 한껏 키워도
  모든 쪽에서 0~1 안, 가로 쪽은 높이가 꽉 참
- `처리하는 동안의 요청에는 파일이 기기 밖으로 나가는 것이 없다` — EXIF 방향이 있는 `rotated.jpg`를 넣으며 `expectLocalOnly`

### 직접 확인

- 브라우저별로 직접 확인한 기록은 커밋·PR에 남아 있지 않다

### 히스토리

- [history.md](./history.md): PR #32 (이미지 넣기·서명 넣기·자르기를 함께 만든 PR)와 리뷰 지적 5개
