# 이미지 도구 공통 (`src/lib/image/`)

쓴 날 2026-10-16 · 고친 날 2026-10-23

- 쓰는 곳: [이미지 압축](../../features/image-compress/README.md), [크기 조절](../../features/image-resize/README.md),
  [형식 변환](../../features/image-convert/README.md), [용량 맞추기](../../features/image-target-size/README.md)(`fitImage`), [위치 정보 지우기](../../features/image-remove-location/README.md)(목록 화면만),
  [이어 붙이기](../../features/image-stitch/README.md)(목록 상태 `ImageBatch`, 저장 `saveDrawing`), [자르기·회전](../../features/image-crop/README.md)(`worker-canvas`·`EXTENSIONS`),
  [모자이크](../../features/image-mosaic/README.md)(`worker-canvas`·`EXTENSIONS`, 영역 계산은 `crop-geometry`의 `clampRect`·`resizeRect`),
  [HEIC 변환](../../features/image-heic-to-jpg/README.md)(`ConvertTool`·`heif.ts`),
  [글자 추출](../../features/image-ocr/README.md)(목록 상태 `ImageBatch`만, 처리는 `src/lib/ocr/`). 사진 준비(`prepare.ts`·`embed.ts`)는 PDF 도구
  (이미지를 PDF로·이미지 넣기·서명 넣기)도 쓴다
- 상태: dev·main 반영 (PR #36, #44, 2026-10-15)
- 관련 문서: [히스토리](./history.md), [격리 frame](../frame-isolation/README.md), [PDF 공통](../pdf-common/README.md)

## 1. 무엇인지

여러 장의 이미지를 넣고 한꺼번에 "읽기 → 크기 바꾸기 → 다시 저장"하는 도구들의 공통 부분이다.

- **목록 화면** `ImageBatchTool`: 파일 고르기, 개수·합계 크기, 추가, 실행 막대 자리, 설정 자리, 이미지 목록(썸네일·이름·설명·빼기)
- **목록 상태** `ImageBatch`: 넣은 이미지의 형식·크기·썸네일을 들고 있다
- **처리** `processImage()`: 워커 여러 개가 CPU 수에 맞춰 나눠 처리한다
- **결과 비교** (2026-10-19): 결과가 있는 줄의 '비교'를 누르면 설정·목록 자리에 원본과 결과를 겹쳐 보여 준다. 가운데 손잡이를 끌거나 아래 막대(방향키)로 경계를 옮기고, '확대해 보기'로 3배로 본다
- 도구는 설정·실행 막대·줄 설명·받기 버튼만 그린다

하지 않는 것·한계

- 결과 형식은 JPG·PNG·WebP 셋뿐이다 (`OutputType`)
- 다시 그려 저장하므로 EXIF(위치·날짜·기기)는 남지 않는다. EXIF 방향은 미리 적용해 바로 세운다
- 움직이는 GIF는 첫 장면만 읽힌다 (브라우저 `createImageBitmap`이 첫 장면만 준다)
- HEIC는 브라우저가 못 읽으면 libheif로 연다 (2026-10-23, 아래 "HEIC 읽기"). 압축·크기 조절은 원래 형식으로 저장하는 도구라 HEIC를 받지 않는다
- 브라우저가 그 형식으로 저장하지 못하면 실패로 알린다 (예: WebP 저장을 못 하는 Safari)

## 2. 어떻게 만드는지

### 파일

| 파일                                         | 역할                                                                                                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/image/ImageBatchTool.svelte`        | 여러 장 도구의 공통 화면. `bar`·`options`·`meta`·`actions` snippet과 `hint`·`broken`·`onremove`·`result`를 받는다                                       |
| `src/lib/compare/CompareSlider.svelte`       | 원본·결과를 겹쳐 비교하는 부품. 문구를 넘겨받아 도구 화면·가이드 어디서나 쓴다                                                                          |
| `src/lib/image/batch.svelte.ts`              | `ImageBatch` 클래스(목록 상태), `BATCH_ACCEPT`, `EXTENSIONS`(형식 → 확장자)                                                                             |
| `src/lib/image/process.ts`                   | `processImage(file, options, signal?)`, `fitImage(file, { type, limit })`, 워커 풀, `ImageProcessError`                                                 |
| `src/lib/image/process.worker.ts`            | 바로 세워 읽기 → 절반씩 줄이기 → 저장 (OffscreenCanvas, PNG 색 줄이기는 UPNG). `limit`이면 용량에 맞춰 화질·크기 탐색                                   |
| `src/lib/image/fit-size.ts`                  | 용량 맞추기의 화질 사다리·이분 탐색(`highestFitting`)·다음 배율(`nextScale`)                                                                            |
| `src/lib/image/upng-globals.ts`              | UPNG.js가 워커에서 찾는 `window`·`pako`를 fflate로 마련한다                                                                                             |
| `src/lib/image/ConvertTool.svelte`           | 형식 변환·HEIC 변환이 같이 쓰는 화면 (문구 `ConvertMessages`, 고르기 형식만 다름)                                                                       |
| `src/lib/image/heif.ts` + `heif.worker.ts`   | HEIC 읽기: 브라우저가 못 읽을 때만 libheif로 풀기 (`readable`·`decodeImage`·`readForDisplay`·`heifToJpeg`)                                              |
| `src/lib/image/heif-container.ts`            | HEIC 파일 구조 읽기: HEVC HEIF인지(`ftyp`), 대표 그림의 색 공간(`colr`)                                                                                 |
| `src/lib/image/prepare.ts`                   | `readImageInfo()`(바로 세운 가로·세로), `jpegOrientation()`, `toEmbeddable()`(PDF에 넣을 JPG·PNG 준비)                                                  |
| `src/lib/image/embed.ts` + `embed.worker.ts` | `embedImage()`: `toEmbeddable`을 워커에서 돌린다 (이미지 넣기·서명 넣기)                                                                                |
| `src/lib/image/jpeg-metadata.ts`             | `rewriteJpeg()`: JPEG 정보 조각마다 두기·빼기·바꾸기, `stripJpegMetadata()`: 허용 목록으로 빼기 (다시 압축하지 않음)                                    |
| `src/lib/image/photo-metadata.ts`            | `readPhotoInfo()`·`cleanPhoto()`: JPG·PNG·WebP의 촬영 정보 읽기·지우기 (위치 정보 지우기)                                                               |
| `src/lib/image/metadata.ts` + `.worker.ts`   | 위 둘을 워커에서 돌린다                                                                                                                                 |
| `src/lib/image/stitch-layout.ts`             | `layoutStitch()`: 여러 장을 한 장으로 이을 때의 배치 (이어 붙이기)                                                                                      |
| `src/lib/image/stitch-detect.ts`             | `detectSeam()`: 화면 캡처의 고정 막대·겹친 부분 찾기                                                                                                    |
| `src/lib/image/stitch.ts` + `.worker.ts`     | `findSeam()`·`stitchImages()`: 위 둘을 워커에서, 나누기·저장까지                                                                                        |
| `src/lib/image/png-stream.ts`                | `PngStream`: 줄 묶음씩 받아 PNG로 저장. canvas 크기 한계를 넘는 결과에 쓴다                                                                             |
| `src/lib/image/jpeg-stream.ts`               | `JpegStream`: 16줄씩 받아 바로 압축하는 기본 JPEG(4:2:0, 표준 양자화·허프만표). canvas 크기 한계를 넘는 결과에 쓴다                                     |
| `src/lib/image/crop-geometry.ts`             | 돌리기·뒤집기·기울기 변환(`applyTurn`)과 자를 영역 계산 (자르기·회전)                                                                                   |
| `src/lib/image/crop.ts` + `.worker.ts`       | `openImage()`·`exportImage()`: 원본을 워커에 두고 돌리고 잘라 저장 (자르기·회전)                                                                        |
| `src/lib/image/worker-canvas.ts`             | `openUpright()`(바로 세워 열고 미리보기), `usableContext()`(canvas를 만들었는지 맨 끝 화소로 확인), `saveDrawing()`(아래 "큰 결과 저장"). 워커 안에서만 |
| `src/lib/image/mosaic-effects.ts`            | `paint()`: 가릴 곳(사각형·타원) 안 화소를 모자이크·흐림·검게 칠하기로 고친다 (미리보기·워커 공통)                                                       |
| `src/lib/image/mosaic.ts` + `.worker.ts`     | `openImage()`·`exportImage()`: 원본을 워커에 두고 가릴 곳을 고쳐 저장 (모자이크)                                                                        |
| `src/lib/crc32.ts`                           | PNG 조각 CRC (사진 정보·사진 꺼내기·`PngStream`)                                                                                                        |
| `src/lib/zip.ts` + `zip.worker.ts`           | `makeZip()`: 여러 결과를 ZIP 하나로 (워커)                                                                                                              |
| `src/frame/messages.ts`의 `images`           | 목록 화면 공통 문구 (한·영)                                                                                                                             |

### 처리 흐름

1. `new ImageBatch()`(압축·크기 조절) 또는 `new ImageBatch({ anyFormat: true })`(형식 변환)를 만든다
2. 파일 고르기·놓기 → `batch.add(files)`
   - 이미지가 아닌 파일은 버린다. `anyFormat`이 아니면 JPG·PNG·WebP만 읽고 나머지는 `error`로 둔다
   - 줄마다 `readImageInfo()`로 크기를 읽고 썸네일 blob 주소를 만든다 (`loading` → `ready`/`error`)
   - 첫 파일이면 `requestShowTool()`로 바깥 페이지를 스크롤한다
3. 도구가 실행하면 `batch.ready`마다 `processImage()`를 한꺼번에 부른다. 동시에 도는 것은 워커 수만큼이다
4. 워커(`process.worker.ts`):
   - `createImageBitmap(file, { imageOrientation: 'from-image' })` → 실패하면 `decode`
   - `scaleDown()`: 목표의 2배 이상이면 절반씩 줄인 뒤 마지막에 맞춘다
   - 저장: PNG + `pngColors > 0`이면 UPNG로 색을 줄이고, 그 밖에는 `convertToBlob`. JPG는 흰 바탕 위에 그린다
   - 받은 Blob의 형식이 요청과 다르면(브라우저가 몰래 PNG로 줌) `encode` 실패
   - `limit`(용량 맞추기)이면 `fit()`: 크기마다 한 번 그리고 화질(PNG는 색 수)만 바꿔 저장해 상한에 드는 가장 높은 값을 찾고,
     못 맞으면 크기를 줄여 다시 한다. 원본 비트맵은 `scaleDown()`이 닫지 않고 메시지 처리 끝에서 닫는다
     ([용량 맞추기](../../features/image-target-size/README.md))
   - 결과 바이트는 transfer로 넘긴다
5. 빼기 버튼 → `batch.remove(item)`(썸네일 주소 해제) + 도구의 `onremove`(그 이미지 결과 버리기)

### HEIC 읽기 (`heif.ts`, 2026-10-23)

- 크롬·엣지·파이어폭스는 HEIC를 못 읽는다. `needsHeifDecoder(file)`(파일 머리가 HEVC HEIF이고 16×16 HEIC를 브라우저가 못 열 때)일 때만
  libheif(WebAssembly, libheif-js) 워커 1~2개로 푼다. Safari는 이 길을 타지 않는다
- 도구가 쓰는 길
  - 워커에 넘길 때: `readable(file)` → 파일 그대로 또는 바로 세운 ImageBitmap(transfer). 처리·자르기·모자이크·증명사진·이어 붙이기 워커는 둘 다 받는다
  - 화면에서 그릴 때: `decodeImage(file)`(ImageBitmap), `readForDisplay(file, side)`(크기 + `<img>`에 쓸 Blob: 원본 또는 줄인 JPG)
  - PDF에 넣을 때: `heifToJpeg(file, { quality })` (이미지를 PDF로)
- 대표 그림만, irot·imir 적용, 8비트, Display P3는 색 공간을 달아 sRGB로. 엔진 받기·라이선스·특허는 [HEIC 변환](../../features/image-heic-to-jpg/README.md)
- 큰 그림을 한꺼번에 풀지 않는다: 처리 워커 풀은 일을 시작할 때 푼다

### 워커 풀 (`process.ts`)

- 워커 수: `hardwareConcurrency - 1`, 1~4개. 큰 사진의 메모리 때문에 4개로 막았다
- 쉬는 워커는 `idle`에 두고 다시 쓴다. 워커는 `createWorker()`로 띄운다 ([격리 frame](../frame-isolation/README.md))
- 워커가 죽으면(`error` 이벤트, 메모리 부족 등) 그 일을 `encode` 실패로 끝내고 워커를 버린다
- `signal`로 그만두면 기다리던 일은 시작하지 않고, 하던 워커는 `terminate()`한다. 지금 세 도구는 `signal`을 넘기지 않는다
  (처리 중에는 `busy`로 추가·빼기를 막는다)

### 큰 결과 저장 (`saveDrawing`, 2026-10-23)

다시 그려 저장하는 워커(자르기·회전, 모자이크, 이어 붙이기)가 같이 쓴다. 도구는 결과를 그리는 방법(`Drawing`)만 넘긴다.

- `whole(ctx)`: 결과 전체를 canvas 하나에 그린다. `strips()`: 줄 묶음 저장을 준비하고(모자이크는 여기서 가릴 곳을 먼저 고친다) 줄 묶음을 그려 RGBA로 돌려주는 함수를 준다
- 순서
  1. 결과 크기의 canvas를 만들어 맨 끝 화소로 확인(`usableContext`)하고, 되면 그려서 `convertToBlob`
  2. canvas를 만들 수 없거나(아이폰 Safari 약 1,670만 화소, 오류 없이 아무것도 그리지 않는다) 브라우저 저장이 실패하면 줄 묶음(400만 화소, 최대 1,024줄)씩 그려 PNG는 `PngStream`, JPG는 `JpegStream`으로 이어 쓴다
  3. WebP는 직접 만들 수 없어 `SaveFailure('tooLarge')` → 도구가 "PNG나 JPG로 저장해 보세요"를 띄운다
- 이어 붙이기는 `pngStrips`로 PNG를 늘 줄 묶음으로 쓴다 (화면 캡처는 줄마다 필터를 고르는 직접 만든 PNG가 더 작다)
- `JpegStream`: 기본(baseline) JPEG, 색 4:2:0, 표준(부록 K) 양자화표를 품질에 맞춰 IJG(libjpeg) 방식으로 늘이고 표준 허프만표를 쓴다. 16줄이 모이면 바로 압축하고 버린다
  - 들고 있는 화소: 줄 묶음 canvas와 그 `ImageData`(폭 8,000이면 500줄 = 각 16MB) + 인코더의 16줄 Y·Cb·Cr(폭 × 16 × 3 × 4바이트). 결과 크기에 따라 늘지 않는다. 압축한 바이트만 쌓인다
  - 품질 0.92는 브라우저 저장(크롬도 libjpeg 계열)과 같은 양자화표가 된다. 같은 사진을 canvas로 저장한 것과 평균 화소 차이 2 미만(E2E)
  - 투명한 곳은 흰 바탕 위에 놓은 색으로 저장한다 (그리는 쪽도 JPG면 흰 바탕을 먼저 칠한다)
  - 가장 긴 변은 65,500px (`JPEG_MAX_SIDE`, libjpeg가 읽는 한계)
- 성능 (2026-10-23, M 계열 Mac 크롬, 빌드 결과): 4,800만 화소(8,000 × 6,000) 잡음이 많은 사진을 자르기·회전에서 저장
  - canvas 한 장 JPG 0.4초, 줄 묶음 JPG(한계 1,670만 화소로 낮춤) 1.7초, 줄 묶음 PNG 9.7초. 모자이크(가릴 곳 1곳)도 0.5 / 1.8 / 9.0초
  - 휴대폰은 몇 배 느리다. 저장하는 동안 실행 막대에 "저장하는 중…"이 보이고 화면은 멈추지 않는다 (워커)
- 시험: 크롬은 작은 시험 이미지를 늘 canvas 하나로 저장한다. 워커 전역 `__canvasPixelLimit`(숫자)을 넣으면 그보다 큰 canvas를 못 만든 것으로 보고 줄 묶음 높이도 그에 맞춘다. E2E가 Playwright로 워커에 직접 넣는다(`tests/e2e/canvas-limit.ts`). 사이트 코드는 이 값을 넣지 않는다

### 결정과 이유

- 세 도구가 같은 일(읽기 → 크기 → 저장)이라 처리 모듈 하나로 묶었다 (`d76609f`)
- 여러 장은 오래 걸려 CPU 수에 맞춘 워커 여러 개로 나눴다 (CLAUDE.md 8단계 원칙)
- PNG 색 줄이기는 브라우저가 못 해서 UPNG.js를 쓴다. 색을 줄이지 않을 때는 브라우저 저장이 훨씬 빨라 브라우저로 저장한다 (`8d1f3a2`)
- UPNG.js는 `require` 또는 `window.pako`로 zlib을 찾는다. 번들된 워커에는 둘 다 없어 이미 쓰는 fflate로 `pako.deflate`·`inflate`를 넣어 준다 (`629d725`)
- 압축·크기 조절은 다시 저장할 수 있는 세 형식만 받고, 형식 변환만 `anyFormat`으로 브라우저가 읽는 모든 형식을 받는다 (`9a307fc`)
- 줄 높이(72px)·막대 높이를 고정해 읽는 중·처리 뒤에 목록이 흔들리지 않는다
- 실행 막대는 목록 위에 둔다. 모바일 하단 고정 광고와 멀게 하려는 것이다
- 결과 비교는 창(모달)이 아니라 frame 안의 설정·목록 자리를 바꿔 보여 준다. 실행 막대는 그대로 있어 비교하며 바로 받을 수 있고, frame 높이도 바뀌지 않는다
- 비교는 화면에 겹쳐 그리기만 한다. 두 이미지의 가로·세로가 달라도 같은 칸에 맞추므로 크기 조절 결과도 비교할 수 있다. 확대 중에 끌면 보는 자리가 옮겨지고, 경계는 막대로 옮긴다
- **JPEG 인코더를 직접 만들었다** (2026-10-23): npm의 JS 인코더(jpeg-js 등)는 전체 화소를 한 번에 받아 줄 묶음으로 쓸 수 없고 고쳐 써야 한다. 기본 JPEG은 표준 표와 DCT만 있으면 되어 (표를 빼면 300줄 남짓) 직접 쓰고, Pillow로 같은 품질 저장과 화소 차이·크기가 거의 같음을 확인했다. 2,400만·4,800만 화소 휴대폰 사진이 흔해 아이폰에서도 JPG로 받을 수 있어야 했다

### 주의할 점

- `process.worker.ts`에서 `import './upng-globals'`는 `upng-js`보다 **먼저** 와야 한다. 순서를 바꾸면 PNG 저장 전에 워커가 죽는다
- 도구는 `onremove`에서 그 이미지의 결과를 꼭 지운다 (`delete outcomes[item.id]`). 안 하면 다시 저장한 이미지 전체가 메모리에 남는다 (`a616482`)
- `#load()`는 읽는 동안 목록에서 빠졌으면 썸네일 주소를 만들지 않는다 (해제할 곳이 없어 남는다)
- 도구는 결과를 설정 문자열과 함께 저장하고(`settings`), 설정이 바뀌면 이전 결과를 쓰지 않는다. 새 도구도 같은 방식을 따른다
- `makeZip()`은 받은 바이트를 워커로 넘겨(transfer) 비운다. 결과를 다시 받을 수 있게 `bytes.slice()` 복사본을 넘긴다.
  같은 이름은 ` (2)`처럼 번호를 붙인다
- 도구는 `result`에 **지금 설정으로 만든** 결과만 돌려준다 (`outcomeOf`). 설정을 바꾸거나 처리를 시작하면 결과가 없어져 비교 화면이 저절로 닫힌다. 비교용 blob 주소는 닫을 때 해제한다
- `item.type`은 JPG·PNG·WebP가 아니면 `undefined`다. 원래 형식으로 저장하는 도구(압축·크기 조절)는 `anyFormat`을 켜면 안 된다
- 격리 frame 규칙(워커는 `createWorker`, `style=""` 금지, form 금지)은 [격리 frame](../frame-isolation/README.md)을 따른다

## 3. 구현 체크리스트

- [x] 처리 모듈과 워커 풀 (`processImage`, CPU 수에 맞춘 1~4개)
- [x] EXIF 방향 적용, 절반씩 줄이기, JPG 흰 바탕
- [x] PNG 색 줄이기(UPNG + fflate), 색을 줄이지 않으면 브라우저 저장
- [x] 저장하지 못한 형식 알아채기(`encode`), 읽지 못한 이미지(`decode`)
- [x] 워커가 죽으면 그 이미지를 실패로 끝내기
- [x] 공통 목록 화면, 빼면 썸네일·결과 해제
- [x] 모든 형식 받기 설정(`anyFormat`), 고르기 안내·못 읽은 안내 바꾸기(`hint`·`broken`)
- [x] 원본과 결과 비교 화면 (`result`, `CompareSlider`)
- [x] HEIC를 모든 브라우저에서 (libheif, 2026-10-23) — 형식 변환·HEIC 변환·자르기·모자이크·증명사진·이어 붙이기·이미지를 PDF로
- [ ] 압축·크기 조절·위치 정보 지우기·이미지 넣기·서명 넣기에서 HEIC
- [x] 이어 붙이기 (2026-10-22, 긴 PNG 저장 `PngStream`)
- [x] 자르기·회전 (2026-10-23)
- [x] 모자이크 (2026-10-23, 원본을 든 워커의 열기·canvas 확인을 `worker-canvas.ts`로 묶음)
- [x] canvas 한계를 넘는 JPG 저장 (2026-10-23, `JpegStream`, 저장 방식 고르기를 `saveDrawing`으로 묶음)
- [ ] canvas 한계를 넘는 WebP 저장 (직접 만드는 WebP 인코더가 없다)
- [x] 글자 추출(OCR) (2026-10-23, 목록 상태만 쓰고 이미지마다 그림·글자 칸을 나란히 그린다)
- [x] 용량 맞추기 (2026-10-23, 공통 워커에 `limit` 경로와 `fitImage()`)
- [ ] 배경 제거 같은 다음 이미지 도구 (CLAUDE.md 9단계)
- [ ] 처리 중 그만두기(`signal`)를 도구 화면에서 쓰기 — 지금은 처리 중에 목록을 잠근다

## 4. 검증과 히스토리

### 자동 테스트

공통 모듈만 따로 시험하는 E2E는 없다. 세 도구의 E2E가 이 모듈을 거친다.

- `tests/e2e/image-compress.spec.ts`: 같은 크기로 줄이기·로컬 처리, 결과 비교(경계 막대·확대·목록으로·설정 바꾸면 사라짐), ZIP·PNG 투명 유지, WebP 저장, EXIF 방향, 원본 유지·못 여는 파일
- `tests/e2e/image-resize.spec.ts`: 비율·칸 맞추기·정확한 크기·너무 큰 결과
- `tests/e2e/image-convert.spec.ts`: PNG→JPG 흰 바탕, GIF·BMP→WebP, JPG→PNG, 읽지 못하는 파일
- `tests/e2e/image-target-size.spec.ts`: 목표 이하로 맞추기(크기도 줄임·화질만), 원본 유지, ZIP, PNG 색 줄이기, 못 맞춤 안내
- 줄 묶음 저장(`saveDrawing`): 자르기·회전, 모자이크, 이어 붙이기 E2E가 `tests/e2e/canvas-limit.ts`로 한계를 낮춰 JPG가 만들어지고 canvas 저장·원본과 화소가 거의 같은지(평균 차이 2·3 미만), WebP는 PNG·JPG를 권하는지 본다
- `tests/e2e/image-heic-to-jpg.spec.ts`: libheif 경로 (방향·대표 그림·10비트·P3·깨진 파일)
- 테스트 파일은 `tests/fixtures/make_image_fixtures.py`가 만든다 (`photo.jpg`, `rotated.jpg`, `screen.png`, `small.jpg`, `broken.png`, `moving.gif`, `green.bmp`,
  HEIC는 pillow-heif로 `iphone`·`burst`·`deep`·`p3`·`broken.heic` 등)

### 직접 확인

- 확인 기록 없음 (커밋·PR에 남은 것이 없다)

### 히스토리

- [history.md](./history.md): PR·커밋·리뷰 지적과 처리
