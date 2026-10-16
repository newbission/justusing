# PDF를 이미지로 (`pdf/to-image`)

쓴 날 2026-10-16 · 고친 날 2026-10-16

- 주소: `/pdf/to-image/` (영어 `/en/pdf/to-image/`)
- 상태: live (2026-10-15 배포, PR #29)
- 관련 문서: [히스토리](./history.md), [PDF 공통](../../foundations/pdf-common/README.md),
  [격리 frame](../../foundations/frame-isolation/README.md), 짝 도구 [이미지를 PDF로](../pdf-from-image/README.md)
- 가이드: `src/content/guides/{ko,en}/pdf-to-jpg.md`

## 1. 어떤 기능인지

- PDF의 쪽을 JPG·PNG 이미지로 뽑는다. 메신저로 보내거나 문서에 붙일 때 쓴다.
- 입력: PDF 한 개 (암호 PDF는 암호를 넣어 연다)
- 고르는 것
  - 추출할 쪽: "전체 추출" / "선택 추출"(쪽 격자에서 누른 쪽만). 휴대폰에서는 "전체"·"선택"
  - 형식: JPG / PNG
  - 화질: "보통 (150 DPI)" / "고화질 (300 DPI)". 휴대폰에서는 "보통"·"고화질"
- 출력
  - 한 장: `원래이름_<쪽>.jpg` 바로 받기
  - 여러 장: `원래이름_이미지.zip` (영어 화면은 `_images.zip`) 하나로
  - 쪽 번호는 전체 쪽 수의 자릿수만큼 앞을 0으로 채운다 (3쪽 문서는 `_1`, 10쪽 이상은 `_01`)
- 하지 않는 것·한계 (FAQ와 같음)
  - 쪽 전체를 화면에 보이는 그대로 그린다. PDF 안 사진만 원본 화질로 뽑지 않는다
    (FAQ에 "아직 없다"고 적혀 있다. 사진 꺼내기 도구 `pdf/extract-images`는 PR #59 리뷰 중)
  - 아주 큰 쪽은 기기가 감당할 크기로 조금 줄여서 만든다
  - 만든 이미지에는 암호가 없다

## 2. 어떻게 만드는지

### 파일

| 파일                                      | 역할                                                                                |
| ----------------------------------------- | ----------------------------------------------------------------------------------- |
| `src/tools/pdf/to-image/meta.ts`          | 이름·설명·아이콘, 묶음 `convert`, 관련 도구(from-image, split)                      |
| `src/tools/pdf/to-image/content.ts`       | 사용법·FAQ (한·영)                                                                  |
| `src/tools/pdf/to-image/messages.ts`      | 화면 문구, ZIP 이름 뒤에 붙는 말(`zipSuffix`)                                       |
| `src/tools/pdf/to-image/Frame.astro`      | 격리 frame 페이지                                                                   |
| `src/tools/pdf/to-image/App.svelte`       | 화면. `SinglePdfTool` 안에 `ActionBar`·`PageSelectGrid`                             |
| `src/lib/pdf/render-image.ts`             | `renderPageBitmap()`(쪽 → `ImageBitmap`), `renderPageImage()`(그림 → 이미지 바이트) |
| `src/lib/pdf/encode-image.worker.ts`      | `OffscreenCanvas.convertToBlob`으로 JPG·PNG 저장                                    |
| `src/lib/zip.ts`, `src/lib/zip.worker.ts` | `makeZip()`. 여러 장을 워커에서 ZIP으로 (나누기와 같이 씀)                          |

### 처리 흐름

1. `SinglePdfTool`이 PDF를 연다 (pdf.js, 암호 입력 포함) → `onload`
2. "이미지로 변환" → `canUse('pdf/to-image')`
3. 시작할 때 쪽 목록·DPI·형식을 지역 변수로 잡는다 (중간에 바꿔도 처음 값으로 끝까지)
4. 쪽마다 차례로
   - `renderPageBitmap(page, dpi)`: 화면 스레드에서 화면에 없는 canvas에 흰 바탕으로 그림 → `ImageBitmap`
   - `encode()`: bitmap을 워커로 넘겨(transfer) JPG(화질 0.92)·PNG로 저장
5. 한 장이면 그대로, 여러 장이면 `makeZip()` → `run.kind = 'done'`
6. "다운로드" → `downloadFile()` (Blob URL)

### 결정과 이유

- **저장(인코딩)만 워커에서, 그리기는 화면에서**: 300 DPI 스캔 PDF에서 멈춤은 그리기가 아니라 저장에서 났다
  (쪽마다 JPG 약 80ms, PNG 약 200ms). 워커로 옮기자 long task가 0이 되고 5쪽 기준 12.8초 → 3.9초.
  pdf.js 화면 그리기는 짧게 끊어서 하고, 워커에서 그리려면 PDF를 한 번 더 열어야 해서(메모리 두 배) 두었다.
- **canvas 한계 안으로 줄이기**: 면적 `MAX_PIXELS = 16,000,000`(iOS Safari 약 1,670만), 한 변 `MAX_SIDE = 16,384`
  (가장 작은 Safari 기준). 넘으면 빈 이미지가 나온다. A4 300 DPI(약 870만 화소)는 그대로 그려진다.
- **흰 바탕**: 배경이 투명한 PDF도 종이처럼 보이게 `background: '#ffffff'`로 그린다.
- **결과 서명(`signature`)**: 형식·화질·쪽 목록이 바뀌면 이전 결과의 다운로드 버튼을 숨기고 다시 만들게 한다.
- **다른 파일을 열면 결과를 버린다**: `pdf !== source`로 확인 (ZIP을 묶는 중에도).

### 주의할 점

- `renderPageBitmap`은 OCR(`pdf/ocr`)도 쓴다. 줄이는 규칙이나 반환값(`dpi`)을 바꾸면 OCR 글자 자리도 확인한다.
- 그린 뒤 `canvas.width = 0`과 `page.cleanup()`으로 메모리를 바로 돌려준다. 빼면 쪽이 많을 때 탭이 죽을 수 있다.
- `makeZip()`은 받은 바이트를 워커로 넘겨(transfer) 부른 뒤에는 쓸 수 없다.
- 격리 frame 규칙(워커는 `createWorker`, `style=` 금지 등)은 [격리 frame](../../foundations/frame-isolation/README.md).

## 3. 구현 체크리스트

- [x] 폴더(`meta.ts`·`content.ts`·`Frame.astro`·`App.svelte`·`messages.ts`)와 레지스트리 등록
- [x] 전체 추출 / 선택 추출(전체 선택·선택 해제), JPG·PNG, 150·300 DPI
- [x] 저장은 워커, ZIP 묶기도 워커
- [x] canvas 면적·한 변 한계 안으로 줄이기
- [x] 시작할 때 고른 값 고정, 값이 바뀌면 결과 숨기기
- [x] 한·영 문구, 사용법·FAQ, 가이드(`pdf-to-jpg`)
- [x] E2E (로컬 처리 약속 `expectLocalOnly` 포함)
- [x] 데스크톱(1280)·휴대폰(390) 화면 캡처 확인 (PR #29)
- [x] `status: 'live'`
- [ ] PDF 안 사진만 원본 그대로 뽑기: `pdf/extract-images`(PR #59)가 병합되면 FAQ의 "아직 없습니다"를 그 도구 안내로 바꾼다
- [x] FAQ·가이드의 파일 이름 예시를 실제(9쪽 이하 `_1`, 10쪽 이상 `_01`)와 맞춤 (2026-10-16)

## 4. 검증

### 자동 테스트

`tests/e2e/pdf-to-image.spec.ts`

- 전체 추출: `three-pages.pdf` → `three-pages_이미지.zip`, 안에 `three-pages_1.jpg`~`_3.jpg`, 모두 JPG
- 선택 추출: 2쪽만 PNG → `three-pages_2.png` 바로 받기, 150 DPI 1239×1754. 화질을 바꾸면 다운로드가 사라지고
  300 DPI로 다시 만들면 2479×3508
- 암호 PDF(`encrypted.pdf`, 암호 1234) → `encrypted_1.jpg`
- 파일을 고른 뒤 변환까지 요청이 기기 밖으로 나가지 않음 (`expectLocalOnly`)

### 직접 확인

- 2026-10-14 (PR #29): 데스크톱(1280)·휴대폰(390) 화면 캡처로 배치 확인
- 저장 워커 효과 측정: 300 DPI 스캔 PDF 5쪽 12.8초 → 3.9초, long task 0 (커밋 `61e292e` 본문)

### 히스토리

- [history.md](./history.md): PR·커밋·리뷰 지적과 처리
