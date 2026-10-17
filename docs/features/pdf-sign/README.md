# PDF 서명 넣기 (`pdf/sign`)

쓴 날 2026-10-16 · 고친 날 2026-10-16

- 주소: `/pdf/sign/` (영어 `/en/pdf/sign/`)
- 상태: live (2026-10-15 배포, PR #32로 dev 병합)
- 관련 문서: [히스토리](./history.md), [PDF 공통](../../foundations/pdf-common/README.md),
  같은 화면을 쓰는 [이미지 넣기](../pdf-add-image/README.md) (배치·처리 흐름은 거기에 자세히),
  가이드 `src/content/guides/<언어>/sign-pdf.md`

## 1. 어떤 기능인지

- 서명을 그리거나 서명 이미지를 올려 PDF 쪽 위 원하는 자리에 넣는다
- 입력: PDF 하나 + 그린 서명(또는 서명 이미지 한 장)
- 출력: `<원래 이름>_서명.pdf` (영어 화면 `_signed.pdf`)
- 할 수 있는 것
  - 흰 칸에 마우스·손가락·펜으로 그리기 → "서명 완료". 잘못 그리면 "지우기"
  - 종이 서명을 찍은 사진이나 PNG는 "서명 이미지 올리기"
  - 끌어서 옮기기·손잡이로 크기, 키보드(화살표·`+`·`-`), "이 쪽만"·"모든 쪽", "다시 그리기"
- **하지 않는 것·한계** (FAQ와 같게)
  - 서명 그림을 넣는 것일 뿐, 공동인증서 같은 전자서명(디지털 서명)이 아니다. 법적 효력은 상대가 받아들이는지 확인
  - 그린 서명은 어디에도 저장·전송하지 않는다. 페이지를 닫으면 사라진다
  - 사진으로 올린 서명은 사진 배경이 함께 들어간다 (투명 PNG를 쓰면 깔끔)
  - 쪽마다 다른 자리에 넣으려면 한 쪽씩 넣은 결과로 다시 해야 한다
  - 인증서가 필요한 서명, 여러 사람 서명은 서버가 필요해 만들지 않는다 (`CLAUDE.md` 8단계)

## 2. 어떻게 만드는지

### 파일

| 파일                                                                         | 역할                                                    |
| ---------------------------------------------------------------------------- | ------------------------------------------------------- |
| `src/tools/pdf/sign/meta.ts`                                                 | 이름·설명·아이콘·관련 도구                              |
| `src/tools/pdf/sign/content.ts`                                              | 사용법·FAQ (한·영)                                      |
| `src/tools/pdf/sign/messages.ts`                                             | 화면 문구 (`StampMessages` + 다시 그리기·올리기 문구)   |
| `src/tools/pdf/sign/App.svelte`                                              | 그리기 칸과 올리기를 `StampTool`의 `picker`로 넘긴다    |
| `src/lib/pdf/SignaturePad.svelte`                                            | 서명 그리기 칸. 그린 범위만 잘라 투명 배경 PNG로 넘긴다 |
| `src/lib/pdf/StampTool.svelte`, `PlacementEditor.svelte`, `PageSheet.svelte` | 이미지 넣기와 같은 공통 화면                            |
| `src/lib/image/embed.ts`, `embed.worker.ts`                                  | 올린 서명 이미지 준비 (워커)                            |
| `src/lib/pdf/modify.ts`, `modify.worker.ts`                                  | `stamp-image` 처리 (이미지 넣기와 같다)                 |

### 처리 흐름

1. PDF를 연다 → 서명이 없으므로 `SignaturePad`와 "서명 이미지 올리기"가 보인다
2. 그리기: `pointerdown`에서 점 하나, `pointermove`에서 선을 잇고 그린 범위(`bounds`)를 넓힌다.
   "서명 완료"에서 범위만 `OffscreenCanvas`로 잘라 PNG(`convertToBlob`)로 만든다
3. 올리기: `embedImage(file)`(워커)로 준비한다
4. 처음 자리 `{ x: 0.6, y: 0.8, width: 0.25 }` (쪽 오른쪽 아래쪽)
5. "서명 넣기" → `canUse('pdf/sign')` → `modifyPdf(..., { kind: 'stamp-image' })` → "다운로드"

### 결정과 이유

- 그린 서명은 잉크 부분만 잘라 PNG로 넣는다. 알파가 `SMask`로 들어가 아래 글자를 가리지 않는다
- 잉크 색(`INK = '#1a1a2e'`)은 화면 테마와 상관없이 PDF에 들어갈 색이라 토큰이 아니다.
  그리기 칸 바탕은 종이처럼 늘 밝게(`--color-paper` 토큰)
- 화면 배율(`devicePixelRatio`)만큼 큰 canvas로 그려 선이 흐리지 않게 한다. 칸 폭은 최대 560px, 높이 200px
- 그리기·지우기·올리기마다 요청 번호(`latest`)를 올려, 늦게 끝난 올리기가 새 서명을 덮지 않게 한다

### 주의할 점

- `SignaturePad`는 칸 폭이 바뀌면 canvas를 다시 만들며 지운다 (그리기 전에만 폭이 바뀐다는 가정)
- 배치·쪽 밖으로 나가지 않기·회전 처리는 이미지 넣기와 같은 코드다. 고치면 두 도구를 함께 확인한다

## 3. 구현 체크리스트

- [x] 폴더와 레지스트리 등록
- [x] 서명 그리기 칸(마우스·터치·펜), 서명 이미지 올리기, 다시 그리기
- [x] 투명 배경 PNG로 넣기, 이 쪽만·모든 쪽
- [x] 한·영 문구, 사용법·FAQ, 가이드 글(`sign-pdf.md`)
- [x] E2E (`pdf-stamp.spec.ts`)
- [x] `status: 'live'`, 배포 (2026-10-15)
- [ ] 그리기 칸은 포인터로만 그린다 (키보드만으로는 서명을 그릴 수 없다. 대신 이미지 올리기는 키보드로 된다)
- [ ] 인증서 전자서명은 하지 않음 (서버 필요)

## 4. 검증

### 자동 테스트

`tests/e2e/pdf-stamp.spec.ts`

- `서명 넣기: 그린 서명을 투명 배경 PNG로 넣는다` — 그리기 전 "서명 완료" 꺼짐, 마우스로 그은 뒤 넣기, 결과 이름
  `three-pages_서명.pdf`, 첫 쪽에만, x 0.6·폭 0.25, PDF 안에 `/SMask`가 있음
- 로컬 처리 약속(`expectLocalOnly`)은 같은 파일에서 이미지 넣기 화면으로 확인한다 (같은 `StampTool`·워커)

### 직접 확인

- 브라우저별로 직접 확인한 기록은 커밋·PR에 남아 있지 않다

### 히스토리

- [history.md](./history.md): PR #32 (이미지 넣기·서명 넣기·자르기를 함께 만든 PR)와 리뷰 지적 5개
