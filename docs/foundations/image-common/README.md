# 이미지 도구 공통 (`src/lib/image/`)

쓴 날 2026-10-16 · 고친 날 2026-10-16

- 쓰는 곳: [이미지 압축](../../features/image-compress/README.md), [크기 조절](../../features/image-resize/README.md),
  [형식 변환](../../features/image-convert/README.md). 사진 준비(`prepare.ts`·`embed.ts`)는 PDF 도구
  (이미지를 PDF로·이미지 넣기·서명 넣기)도 쓴다
- 상태: dev·main 반영 (PR #36, #44, 2026-10-15)
- 관련 문서: [히스토리](./history.md), [격리 frame](../frame-isolation/README.md), [PDF 공통](../pdf-common/README.md)

## 1. 무엇인지

여러 장의 이미지를 넣고 한꺼번에 "읽기 → 크기 바꾸기 → 다시 저장"하는 도구들의 공통 부분이다.

- **목록 화면** `ImageBatchTool`: 파일 고르기, 개수·합계 크기, 추가, 실행 막대 자리, 설정 자리, 이미지 목록(썸네일·이름·설명·빼기)
- **목록 상태** `ImageBatch`: 넣은 이미지의 형식·크기·썸네일을 들고 있다
- **처리** `processImage()`: 워커 여러 개가 CPU 수에 맞춰 나눠 처리한다
- 도구는 설정·실행 막대·줄 설명·받기 버튼만 그린다

하지 않는 것·한계

- 결과 형식은 JPG·PNG·WebP 셋뿐이다 (`OutputType`)
- 다시 그려 저장하므로 EXIF(위치·날짜·기기)는 남지 않는다. EXIF 방향은 미리 적용해 바로 세운다
- 움직이는 GIF는 첫 장면만 읽힌다 (브라우저 `createImageBitmap`이 첫 장면만 준다)
- HEIC는 브라우저가 읽을 때만(Safari) 된다. libheif는 아직 넣지 않았다 (CLAUDE.md 9단계, 사용자 결정 대기)
- 브라우저가 그 형식으로 저장하지 못하면 실패로 알린다 (예: WebP 저장을 못 하는 Safari)

## 2. 어떻게 만드는지

### 파일

| 파일                                         | 역할                                                                                                     |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `src/lib/image/ImageBatchTool.svelte`        | 여러 장 도구의 공통 화면. `bar`·`options`·`meta`·`actions` snippet과 `hint`·`broken`·`onremove`를 받는다 |
| `src/lib/image/batch.svelte.ts`              | `ImageBatch` 클래스(목록 상태), `BATCH_ACCEPT`, `EXTENSIONS`(형식 → 확장자)                              |
| `src/lib/image/process.ts`                   | `processImage(file, options, signal?)`, 워커 풀, `ImageProcessError(reason: 'decode' \| 'encode')`       |
| `src/lib/image/process.worker.ts`            | 바로 세워 읽기 → 절반씩 줄이기 → 저장 (OffscreenCanvas, PNG 색 줄이기는 UPNG)                            |
| `src/lib/image/upng-globals.ts`              | UPNG.js가 워커에서 찾는 `window`·`pako`를 fflate로 마련한다                                              |
| `src/lib/image/prepare.ts`                   | `readImageInfo()`(바로 세운 가로·세로), `jpegOrientation()`, `toEmbeddable()`(PDF에 넣을 JPG·PNG 준비)   |
| `src/lib/image/embed.ts` + `embed.worker.ts` | `embedImage()`: `toEmbeddable`을 워커에서 돌린다 (이미지 넣기·서명 넣기)                                 |
| `src/lib/zip.ts` + `zip.worker.ts`           | `makeZip()`: 여러 결과를 ZIP 하나로 (워커)                                                               |
| `src/frame/messages.ts`의 `images`           | 목록 화면 공통 문구 (한·영)                                                                              |

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
   - 결과 바이트는 transfer로 넘긴다
5. 빼기 버튼 → `batch.remove(item)`(썸네일 주소 해제) + 도구의 `onremove`(그 이미지 결과 버리기)

### 워커 풀 (`process.ts`)

- 워커 수: `hardwareConcurrency - 1`, 1~4개. 큰 사진의 메모리 때문에 4개로 막았다
- 쉬는 워커는 `idle`에 두고 다시 쓴다. 워커는 `createWorker()`로 띄운다 ([격리 frame](../frame-isolation/README.md))
- 워커가 죽으면(`error` 이벤트, 메모리 부족 등) 그 일을 `encode` 실패로 끝내고 워커를 버린다
- `signal`로 그만두면 기다리던 일은 시작하지 않고, 하던 워커는 `terminate()`한다. 지금 세 도구는 `signal`을 넘기지 않는다
  (처리 중에는 `busy`로 추가·빼기를 막는다)

### 결정과 이유

- 세 도구가 같은 일(읽기 → 크기 → 저장)이라 처리 모듈 하나로 묶었다 (`d76609f`)
- 여러 장은 오래 걸려 CPU 수에 맞춘 워커 여러 개로 나눴다 (CLAUDE.md 8단계 원칙)
- PNG 색 줄이기는 브라우저가 못 해서 UPNG.js를 쓴다. 색을 줄이지 않을 때는 브라우저 저장이 훨씬 빨라 브라우저로 저장한다 (`8d1f3a2`)
- UPNG.js는 `require` 또는 `window.pako`로 zlib을 찾는다. 번들된 워커에는 둘 다 없어 이미 쓰는 fflate로 `pako.deflate`·`inflate`를 넣어 준다 (`629d725`)
- 압축·크기 조절은 다시 저장할 수 있는 세 형식만 받고, 형식 변환만 `anyFormat`으로 브라우저가 읽는 모든 형식을 받는다 (`9a307fc`)
- 줄 높이(72px)·막대 높이를 고정해 읽는 중·처리 뒤에 목록이 흔들리지 않는다
- 실행 막대는 목록 위에 둔다. 모바일 하단 고정 광고와 멀게 하려는 것이다

### 주의할 점

- `process.worker.ts`에서 `import './upng-globals'`는 `upng-js`보다 **먼저** 와야 한다. 순서를 바꾸면 PNG 저장 전에 워커가 죽는다
- 도구는 `onremove`에서 그 이미지의 결과를 꼭 지운다 (`delete outcomes[item.id]`). 안 하면 다시 저장한 이미지 전체가 메모리에 남는다 (`a616482`)
- `#load()`는 읽는 동안 목록에서 빠졌으면 썸네일 주소를 만들지 않는다 (해제할 곳이 없어 남는다)
- 도구는 결과를 설정 문자열과 함께 저장하고(`settings`), 설정이 바뀌면 이전 결과를 쓰지 않는다. 새 도구도 같은 방식을 따른다
- `makeZip()`은 받은 바이트를 워커로 넘겨(transfer) 비운다. 결과를 다시 받을 수 있게 `bytes.slice()` 복사본을 넘긴다.
  같은 이름은 ` (2)`처럼 번호를 붙인다
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
- [ ] HEIC를 모든 브라우저에서 (libheif, LGPL·HEVC 특허 — 사용자 결정 대기)
- [ ] 배경 제거, 자르기·회전 같은 다음 이미지 도구 (CLAUDE.md 9단계)
- [ ] 처리 중 그만두기(`signal`)를 도구 화면에서 쓰기 — 지금은 처리 중에 목록을 잠근다

## 4. 검증과 히스토리

### 자동 테스트

공통 모듈만 따로 시험하는 E2E는 없다. 세 도구의 E2E가 이 모듈을 거친다.

- `tests/e2e/image-compress.spec.ts`: 같은 크기로 줄이기·로컬 처리, ZIP·PNG 투명 유지, WebP 저장, EXIF 방향, 원본 유지·못 여는 파일
- `tests/e2e/image-resize.spec.ts`: 비율·칸 맞추기·정확한 크기·너무 큰 결과
- `tests/e2e/image-convert.spec.ts`: PNG→JPG 흰 바탕, GIF·BMP→WebP, JPG→PNG, 읽지 못하는 파일
- 테스트 파일은 `tests/fixtures/make_image_fixtures.py`가 만든다 (`photo.jpg`, `rotated.jpg`, `screen.png`, `small.jpg`, `broken.png`, `moving.gif`, `green.bmp` 등)

### 직접 확인

- 확인 기록 없음 (커밋·PR에 남은 것이 없다)

### 히스토리

- [history.md](./history.md): PR·커밋·리뷰 지적과 처리
