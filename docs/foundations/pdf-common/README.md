# PDF 도구 공통 (`src/lib/pdf/`)

쓴 날 2026-10-16 · 고친 날 2026-10-18

- 쓰는 곳: 모든 PDF 도구 (보기·합치기·나누기·회전·정리·변환·가벼운 도구·무거운 도구)
- 상태: 4단계(2026-10-11)에 시작해 도구마다 넓혔다. 주요 PR #29, #31, #32 (2026-10-15)
- 관련 문서: [히스토리](./history.md), [격리 frame](../frame-isolation/README.md), [이미지 공통](../image-common/README.md),
  [글꼴·데이터 보관](../fonts-and-data/README.md)

## 1. 무엇인지

PDF 도구가 같이 쓰는 세 층이다.

1. **보기 (pdf.js)**: `openPdf()`로 열고, 썸네일·쪽 그리기·이미지로 그리기
2. **만들기·고치기 (pdf-lib, 워커)**: 조립(`assemble`), 하나 고치기(`modify`), 글자 넣기(`text-pdf`), 압축(`compress`), 이미지로 PDF(`images-to-pdf`)
3. **화면 부품**: PDF 하나 틀(`SinglePdfTool`), 쪽 격자, 쪽 크게 그리기(`PageSheet`)와 그 위 편집 화면, 실행 막대(`ActionBar`)

- pdf-lib는 관리되는 포크 `@cantoo/pdf-lib`를 쓴다 (원본은 2022년 뒤 릴리스 없음, 포크는 암호 PDF 열기 지원)
- 글자를 넣는 처리는 `@cantoo/fontkit`을 쓴다
- 모든 처리는 frame 안 워커에서 한다. 이 모듈들은 import한 도구 frame에서만 로드된다

하지 않는 것·한계

- 결과 PDF에는 원래 암호가 남지 않는다 (암호 PDF는 받은 암호로 풀어 연다)
- 모아찍기의 `embedPages`는 내용이 없는 빈 쪽을 넣지 못해 칸만 비운다
- 쪽 그림 canvas는 브라우저 한계 안으로 줄인다 (1,600만 화소·한 변 16384px)
- 흰색 가리기·자르기는 아래 내용이 파일에 남는다 (각 도구 화면·FAQ에 밝힌다)

## 2. 어떻게 만드는지

### 파일 — 보기 (pdf.js, 화면 스레드)

| 파일                                         | 역할                                                                                                                                                              |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pdfjs.ts`                                   | `openPdf(bytes, password?)` → `{ doc, close }`, `isPasswordError()`. pdf.js 워커는 `createWorker()`로, CMap·표준 글꼴·wasm·ICC는 `/vendor/pdfjs/`에서 절대 주소로 |
| `Thumbnail.svelte`                           | 정사각형 칸 안 쪽 썸네일. 화면 근처에 왔을 때만 그린다. `rotate`로 돌려 보이기                                                                                    |
| `PdfPage.svelte`                             | 쪽 하나 (보기·합치기 미리보기). 자리는 바로 잡고 화면 근처에서만 그린다                                                                                           |
| `render-image.ts` + `encode-image.worker.ts` | `renderPageBitmap(page, dpi)`(그린 그림 + 실제 DPI, 글자 인식도 쓴다), `renderPageImage(page, dpi, format)`(JPG·PNG 바이트, 저장은 워커)                          |

### 파일 — 만들기·고치기 (pdf-lib 워커)

| 파일                                                                | 함수                                                                                                      | 쓰는 도구                                                        |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `assemble.ts` + `.worker.ts`                                        | `assemblePdfs(job, onProgress)` 여러 결과, `assemblePdf(job)` 하나                                        | 합치기·나누기·회전·정리                                          |
| `modify.ts` + `.worker.ts`                                          | `modifyPdf(source, job)`. job: `unlock`·`protect`·`page-numbers`·`stamp-image`·`crop`·`n-up`·`text-layer` | 암호 해제·걸기, 쪽 번호, 이미지·서명 넣기, 자르기, 모아찍기, OCR |
| `text-pdf.ts` + `.worker.ts`                                        | `runTextJob(source, job)`. job: `watermark`·`header-footer`·`edit`·`fill-form`. `MissingGlyphsError`      | 워터마크, 머리말·꼬리말, 편집, 양식 채우기                       |
| `watermark.ts`·`watermark-layout.ts`                                | `addWatermark()`, `placements()` (화면 미리보기와 워커가 같이 씀)                                         | 워터마크                                                         |
| `header-footer.ts`·`header-footer-layout.ts`                        | `addHeaderFooter()`, `fillTemplate()`·`linePosition()`·`fitSize()`                                        | 머리말·꼬리말                                                    |
| `edit.ts`·`edit-constants.ts`                                       | `editPdf()`, 줄 간격·형광펜 값                                                                            | 편집                                                             |
| `fill-form.ts`                                                      | 칸 값 타입(`FieldValue`)·옵션                                                                             | 양식 채우기                                                      |
| `compress.ts` + `compress.worker.ts` + `recompress-image.worker.ts` | `compressPdf(source, level, onProgress, signal)`. PDF 워커 하나 + 사진 워커 여러 개                       | 압축                                                             |
| `images-to-pdf.ts` + `.worker.ts`                                   | `imagesToPdf()`. 이미지 준비는 `src/lib/image/prepare.ts`의 `toEmbeddable`                                | 이미지를 PDF로                                                   |
| `page-geometry.ts`                                                  | `toPdfPoint()`, `normalizedRotation()`, `viewSize()`, `scaleRect()`                                       | 워커들                                                           |
| `page-content.ts`                                                   | `isolateContent(page)`: 원래 내용을 `q…Q`로 감싼다                                                        | 평면화·글자층                                                    |
| `flatten-annotations.ts`                                            | `flattenAnnotations(page)`, `renderMissingFormAppearances(doc)`                                           | 모아찍기                                                         |
| `text-layer.ts`                                                     | `addTextLayers(doc, layers)`: OCR 투명 글자층을 쪽 위에 겹친다                                            | OCR                                                              |
| `modify-errors.ts`                                                  | `UNRENDERED_ANNOTATION` (그릴 수 없는 주석)                                                               | 모아찍기                                                         |
| `ranges.ts`                                                         | 쪽 범위 입력 해석 ("1-3, 4-6, 7")                                                                         | 나누기                                                           |

### 파일 — 화면 부품

| 파일                         | 역할                                                                                                        | 쓰는 도구                              |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `SinglePdfTool.svelte`       | PDF 하나 틀: 고르기 → 여는 중 → 암호 → 파일 이름 막대 + 도구 화면. `onload(LoadedPdf)`·`onclose`·`children` | PDF 하나를 다루는 도구 대부분          |
| `PageGrid.svelte`            | 번호 붙은 쪽 격자, 순서 바꾸기(끌기, ◀·▶ 버튼)·빼기                                                         | 합치기·정리                            |
| `PageSelectGrid.svelte`      | 눌러서 쪽 고르기 (없으면 보기 전용)                                                                         | 나누기·압축·쪽 번호·이미지로·암호 해제 |
| `PageSheet.svelte`           | 쪽 하나를 크게 그리고 위에 겹칠 화면(children)을 받는 틀. `hideForms`로 입력 칸 모양 빼고 그리기            | 자르기·배치·워터마크·머리말·편집·양식  |
| `PlacementEditor.svelte`     | 쪽 위에 이미지 놓기 (끌기·손잡이·키보드)                                                                    | 이미지·서명 넣기                       |
| `StampTool.svelte`           | 이미지 찍는 도구 공통 화면 (이 쪽만·모든 쪽, 배치, 실행)                                                    | 이미지·서명 넣기                       |
| `SignaturePad.svelte`        | 서명 그리기 → 그린 부분만 잘라 투명 PNG                                                                     | 서명 넣기                              |
| `CropEditor.svelte`          | 남길 영역 사각형 (끌기·모서리·키보드)                                                                       | 자르기                                 |
| `src/frame/ActionBar.svelte` | 실행·다운로드 막대 (높이 고정)                                                                              | 모든 도구                              |
| `src/frame/download.ts`      | `downloadFile(bytes, name, type)`                                                                           | 모든 도구                              |

### 처리 흐름 (PDF 하나를 고치는 도구의 보통 모양)

1. `SinglePdfTool`이 파일을 받아 `openPdf(bytes.slice(), password)`로 연다
   (pdf.js는 받은 버퍼를 워커로 넘겨 비우므로 복사본을 준다. 원본 `bytes`는 결과를 만들 때 쓴다)
2. 암호가 필요하면 암호 칸을 보인다 (form 없이 버튼·Enter). 열리면 `onload({ name, bytes, password, doc })`, `requestShowTool()`
3. 도구 화면이 `doc`으로 썸네일·쪽 그림을 그리고, 사용자가 설정한다
4. 실행: `canUse()` → `modifyPdf`/`runTextJob`/`assemblePdf` 등에 `{ bytes, password }`와 job을 넘긴다
5. 워커가 `PDFDocument.load(bytes, { password: password ?? '' })`로 열어 고치고 바이트를 돌려준다
6. `ActionBar`에 결과를 보이고 `downloadFile()`로 받는다
7. 다른 파일을 열거나 "다른 파일"을 누르면 `onclose` → 도구가 진행 중인 처리를 그만두거나 결과를 버린다

### 쪽 위 자리 맞추기

- 화면은 **보이는 쪽**(쪽 회전·CropBox 적용) 기준 비율(0~1, 왼쪽 위 0,0)로 자리를 넘긴다 (`PageRect`, `StampPlace`)
- 워커가 `page-geometry.ts`로 회전·CropBox를 계산해 PDF 좌표로 바꾼다. 그래서 돌린 쪽에서도 화면과 결과가 같은 자리다
- 글자 넣기 워커는 쪽의 `/UserUnit`(좌표 단위)도 본다. pt로 정한 글자 크기를 쪽 단위로 바꾼다 (`text-pdf.worker.ts`. 가리기 브랜치에서 `page-geometry.ts`로 옮긴다)
- 이미지 자리는 너비만 비율로 받고 높이는 이미지 비율로 정한다. 크기가 다른 쪽에 넣어도 이미지가 늘어나지 않는다 (`ffc4ea9`)
- 덧그리기 전에 `isolateContent()`로 원래 내용을 감싼다. 원래 내용이 그래픽 상태를 되돌리지 않고 끝나도 엉뚱한 자리에 그려지지 않게

### 결정과 이유

- 합치기·나누기·회전·정리는 "어느 원본의 어느 쪽을 어떤 순서·방향으로"만 달라 조립 작업 하나로 묶었다 (`8d1dad4`).
  같은 원본의 쪽은 한 번에 `copyPages`해 글꼴·이미지 같은 공유 자원이 한 번만 들어간다
- 조립 워커는 원본을 한 번만 열고 결과 여러 개를 차례로 만들며 진행률을 낸다. 한 장씩 나누기에서 300쪽 문서를 300번 읽던 것을 막았다 (`c40a1e0`)
- PDF 하나 틀(`SinglePdfTool`)을 뺐다 (`c80abbf`): 나누기·회전·정리가 고르기·암호·오류·이름 막대를 각자 갖고 있었다
- 글자 넣기 워커를 고치기 워커와 따로 둔다 (`eea1b30`): fontkit이 커서 쪽 번호 같은 가벼운 도구가 무거워지지 않게.
  쓴 글자만 넣고(subset), 글꼴에 없는 글자는 빈 네모로 찍히기 전에 `missing`으로 알린다
- 넣을 글자가 없으면 글꼴 없이 그대로 저장한다 (`51ab3d1`: 한 쪽 문서에서 표지를 뺀 머리말이 'font required'로 실패했다)
- 무거운 저장(인코딩)은 워커로 (리뷰 #29·#32): 쪽 그림 저장(쪽마다 JPG 약 80ms·PNG 약 200ms 멈춤), 사진 회전·다시 저장, ZIP 묶기, 넣을 이미지 준비.
  File을 그대로 넘기고 결과 바이트는 transfer로 받는다
- 쪽 그림은 canvas 한계(iOS Safari 약 1,670만 화소) 안으로 줄여 그린다. 넘으면 빈 이미지가 나온다. 쪽마다 canvas 메모리를 바로 돌려준다 (`6159154`)
- 모아찍기는 쪽 내용만 옮겨(`embedPages`) 주석(양식 입력값·서명·도장)이 빠졌다. 인쇄되는 주석의 모양을 먼저 쪽 내용에 그려 넣는다
  (`c4c23d2`, 인쇄 플래그로 고름 `e3a5d35`, 모양 없는 입력값은 모양을 만든다 `9d5effb`, 그릴 수 없으면 조용히 빼지 않고 알린다 `8c859b6`, 링크는 건너뛴다 `cabf22f`)
- 열기 암호 없이 제한만 걸린 PDF는 빈 암호(`''`)로 열어야 풀린다 (`ab2d1cb`)
- 압축을 그만두면 PDF 워커·사진 워커를 통째로 끝낸다 (`01d81b8`, `649c9d0`): pdf-lib 처리는 중간에 멈출 수 없다. 다음 압축은 새 워커로 한다
- 처리 중 다른 파일을 열면 이전 결과를 버린다 (`2465600`): 늦게 온 이전 결과가 새 파일의 "완료"로 보였다

### 주의할 점

- 원본 바이트는 워커에 **복사해서** 보낸다 (`modifyPdf`·`runTextJob`·`assemblePdfs`·`compressPdf`). 같은 파일로 설정을 바꿔 다시 만들 수 있게. transfer로 바꾸면 원본이 비어 버린다
- `openPdf()`에는 복사본을 넘긴다. 열다가 실패해도 `task.destroy()`로 메모리를 푼다
- 워커는 반드시 `createWorker()`로 ([격리 frame](../frame-isolation/README.md)). pdf.js 보조 파일 주소는 절대 주소여야 한다 (워커가 blob URL에서 돈다)
- `scripts/copy-pdfjs-assets.mjs`가 dev/build 전에 CMap 등을 `public/vendor/pdfjs/`로 복사한다. `/vendor/*`에는 CORS 헤더가 있다 (`public/_headers`)
- 화면 미리보기와 워커가 같은 계산을 쓰는 파일(`*-layout.ts`, `edit-constants.ts`, `modify-errors.ts`)은 다른 모듈을 import하지 않는다 (워커가 무거워진다)
- 새 쪽 위 편집 화면은 `PageSheet` 위에 만든다. 새 PDF 하나 도구는 `SinglePdfTool` 안에 그린다
- 색은 토큰만: 썸네일 그림자 `--shadow-page`, 새 canvas 배경 `--color-paper` (리뷰 #29·#32)

### 2026-10-17 배포로 들어온 것

- 가리기(PR #63·#58): `content-tokens.ts`(내용 스트림 토큰 나누기), `content-usage.ts`, `redact.ts`, `redact-pages.ts`, `rendering-only.ts`, `base-encodings.ts`(pdf.js 기본 인코딩 표)
- 사진 꺼내기(PR #59): `content-tokens.ts`, `extract-images.ts` + `.worker.ts`, `image-pixels.ts`(Flate·PNG 예측 풀기)
- 문서 정보(PR #61): `remove-unused.ts`(쓰지 않는 객체 지우기, 압축 워커에서 옮김), `modify.ts`에 문서 정보 job
- 서명 PDF 알림: `pdfjs.ts`의 `isSigned()`(+`signature-scan.worker.ts`로 바이트에서 `/ByteRange` 찾기). `SinglePdfTool`에 `saves`를 주면 열 때 알린다
  - 찾기 워커에는 바이트 복사본이 아니라 고른 파일(`File`)을 넘겨 워커가 읽는다. 화면 스레드에서 큰 복사를 하지 않는다 (2026-10-18)
  - `/ByteRange`와 `[` 사이의 공백은 PDF 공백 모두(NUL·탭·LF·폼 피드·CR·스페이스)를 건너뛴다
- `SinglePdfTool`의 세대 번호(`generation`): 열기는 앞 문서 닫기를 기다리기 **전에** 번호를 받는다. 기다린 뒤에 받으면
  연달아 고른 두 열기가 같은 번호를 받아, 먼저 고른 파일이 늦게 끝날 때 나중 파일을 덮어쓴다 (2026-10-18).
  닫기(`close`)는 상태를 **먼저 비우고 맨 끝에** 문서 닫기를 기다린다. 기다린 뒤에 비우면 늦게 끝난 닫기가 그사이 연
  새 파일의 상태를 지운다 (PDF 보기의 `closeDoc`·`reset`도 같다). PDF 보기의 `show`는 고른 파일(`current`)을 닫기 전에 정하고,
  닫기가 끝난 뒤 아직 그 파일일 때만 연다

## 3. 구현 체크리스트

- [x] pdf.js 열기·썸네일·쪽 그리기, CMap 등 직접 호스팅
- [x] 조립 워커 (합치기·나누기·회전·정리), 원본 한 번 읽기·진행률
- [x] PDF 하나 틀(`SinglePdfTool`, 암호·닫을 때 알림), 쪽 격자 두 종류
- [x] 쪽을 이미지로 그리기 (canvas 한계, 저장은 워커)
- [x] 이미지로 PDF 만들기 워커, 넣을 이미지 준비 워커
- [x] 고치기 워커 (암호, 쪽 번호, 이미지 찍기, 자르기, 모아찍기, 글자층)
- [x] 쪽 좌표 계산 공통 모듈 (회전·CropBox)
- [x] 쪽 크게 그리기 틀과 배치·자르기·서명 화면
- [x] 압축 (PDF 워커 + 사진 워커 여러 개, 그만두기)
- [x] 글자 넣기 워커 (워터마크·머리말·편집·양식, subset, 없는 글자 알림)
- [x] 모아찍기 주석 평면화
- [x] 가리기·사진 꺼내기·문서 정보 공통 모듈, 서명 PDF 알림 (2026-10-17 배포)

## 4. 검증과 히스토리

### 자동 테스트

공통 모듈만 따로 시험하는 E2E는 `ranges.spec.ts`뿐이다. 나머지는 도구 E2E가 거친다.

- `tests/e2e/ranges.spec.ts`: 쪽 범위 해석 (범위·한 쪽·쉼표, 물결표·끝까지·처음부터·줄바꿈, 겹치는 범위 등)
- 조립: `pdf-merge.spec.ts`(순서·암호 PDF·끌기), `pdf-split.spec.ts`(범위 ZIP·한 장씩·고른 쪽·암호), `pdf-rotate.spec.ts`, `pdf-organize.spec.ts`
- 고치기·좌표: `pdf-stamp.spec.ts`(키보드 배치, 돌린 쪽에서도 화면 기준 같은 자리, 쪽 밖으로 안 나감, 서명 투명 PNG, 자르기)
- `pdf-light-tools.spec.ts`: 암호 해제(제한만 걸린 PDF 포함)·걸기, 쪽 번호(돌린 쪽 아래 가운데), 글자 추출
- 평면화: `pdf-n-up.spec.ts`(양식 입력값·주석 옮기기, 모양 없는 입력값·형광펜, 그릴 수 없는 주석 알림, 인쇄되지 않는 칸)
- 이미지로 그리기: `pdf-to-image.spec.ts` / 압축: `pdf-compress.spec.ts`(다른 파일로 바꾸면 이전 압축 그만둠 포함)
- 글자 넣기: `pdf-watermark.spec.ts`, `pdf-header-footer.spec.ts`, `pdf-edit.spec.ts`, `pdf-fill-form.spec.ts`
- 각 도구 E2E의 `expectLocalOnly()`로 처리 중 요청에 파일이 나가지 않는지 본다

### 직접 확인

- 2026-10-15 (리뷰 #29 답글): 300 DPI 스캔 PDF에서 멈춤이 그리기가 아니라 저장에서 나는 것을 재고(쪽마다 JPG 약 80ms·PNG 약 200ms), 저장을 워커로 옮긴 뒤 같은 측정으로 확인
- 그 밖의 기록은 각 도구 문서를 본다

### 히스토리

- [history.md](./history.md): PR·커밋·리뷰 지적과 처리
