# HEIC JPG 변환 (`image/heic-to-jpg`)

쓴 날 2026-10-23 · 고친 날 2026-10-24

- 주소: `/image/heic-to-jpg/` (영어 `/en/image/heic-to-jpg/`)
- 상태: PR 진행 중 (2026-10-23)
- 관련 문서: [히스토리](./history.md), [이미지 공통](../../foundations/image-common/README.md),
  [형식 변환](../image-convert/README.md), [글꼴·데이터 보관](../../foundations/fonts-and-data/README.md),
  [격리 frame](../../foundations/frame-isolation/README.md)
- 가이드 글: `src/content/guides/ko/heic-to-jpg.md` (영어판 `en/heic-to-jpg.md`)

## 1. 어떤 기능인지

- 아이폰 사진(HEIC·HEIF)을 JPG(또는 PNG·WebP)로 바꾼다. 윈도우에서 안 열릴 때, JPG만 받는 곳에 올릴 때 쓴다
- 사용자 결정(2026-10-23): HEIC를 모든 브라우저에서 열 수 있게 libheif를 넣는다. LGPL·HEVC 특허 우려는 사용자가 감수한다
- 입력: HEIC·HEIF 여러 장 (파일 고르기 창은 HEIC만 보이고, 끌어다 놓은 다른 이미지도 바꿀 수는 있다)
- 출력: 한 장은 `<원래 이름>.jpg`, 여러 장은 `HEIC_변환.zip` (영어 `heic-converted.zip`), 목록의 ↓로 한 장씩
- 화면은 형식 변환과 같다 (`ConvertTool`). 화질 0.92, 결과 비교 가능
- 하지 않는 것·한계 (화면·FAQ·가이드와 같게)
  - **촬영 정보(EXIF·XMP)를 남기지 않는다.** 다시 그려 저장하므로 위치·날짜·기기가 빠진다. 위치가 함께 퍼지는 문제가
    있어 기본으로 지우고, '촬영 날짜만 남기기' 같은 선택은 두지 않았다 (사진 앱에서 날짜순 정리가 안 될 수 있다고 FAQ에 밝힘)
  - 여러 장이 든 파일(연사·이미지 묶음)은 **대표 그림(primary) 하나**만 바꾼다. 라이브 포토의 움직임은 따로 된 MOV라 해당 없음
  - 10·12비트·HDR은 **8비트**로 줄인다. HDR 게인 맵(밝기 정보)·깊이 지도 같은 보조 그림은 버린다
  - Display P3(아이폰)는 sRGB로 바꿔 저장한다. BT.2020·PQ 같은 HDR 색은 바꾸지 않는다(그대로 8비트로 줄어 옅어질 수 있음)
  - 회전·뒤집기(irot·imir)는 적용해 바로 선 사진으로 저장한다

## 2. 어떻게 만드는지

### 파일

| 파일                                            | 역할                                                                                                      |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `src/tools/image/heic-to-jpg/meta.ts`           | 이름·한 줄 설명·아이콘(휴대폰 → 화살표), 묶음 `convert`, 흐름 그림(HEIC 2장 → JPG 2장), 관련 도구         |
| `src/tools/image/heic-to-jpg/content.ts`        | 쓰임새 3·사용법 4·FAQ 6 (아이폰 '높은 호환성'·'자동' 전송, 촬영 정보, 라이브 포토·HDR, libheif·LGPL 안내) |
| `src/tools/image/heic-to-jpg/messages.ts`       | 화면 문구 (`ConvertMessages`, 늘 보이는 안내 `note`)                                                      |
| `src/tools/image/heic-to-jpg/App.svelte`        | `ConvertTool`에 문구와 고르기 형식(`.heic,.heif,image/heic,image/heif`)만 넘긴다                          |
| `src/lib/image/ConvertTool.svelte`              | 형식 변환과 같이 쓰는 화면 (형식 고르기·실행·받기)                                                        |
| `src/lib/image/heif.ts`                         | 화면 스레드 쪽: HEIC인지(`isHeif`), 브라우저가 읽는지(`browserReadsHeif`), 풀기 워커 1~2개, `readable` 등 |
| `src/lib/image/heif.worker.ts`                  | libheif(WebAssembly)로 대표 그림을 RGBA 8비트로 풀어 ImageBitmap 또는 JPG로                               |
| `src/lib/image/heif-container.ts`               | 그림을 풀지 않고 파일 구조에서 읽기: `ftyp` 브랜드(HEVC HEIF인지), 대표 그림의 `colr`(Display P3인지)     |
| `scripts/copy-libheif-notice.mjs`               | dev/build 전에 `public/vendor/libheif/`에 허가서 전문(LICENSE.txt)과 안내(README.txt)를 둔다              |
| `public/samples/<언어>/예시-아이폰사진1·2.heic` | 견본 (`make_samples.py`의 `iphone_photos()`, 둘째 장은 화소를 눕히고 irot)                                |
| `tests/fixtures/*.heic`                         | `iphone`(irot)·`burst`(대표 그림)·`deep`(10비트)·`p3`·`broken` (`make_image_fixtures.py`, pillow-heif)    |

### 처리 흐름

1. 파일을 넣으면 `ImageBatch({ anyFormat: true, accept })`가 줄마다 `readForDisplay()`를 부른다
   - `needsHeifDecoder(file)`: 앞 64바이트로 HEVC HEIF인지 보고(`isHeifHead`), 브라우저가 HEIC를 읽는지는 16×16 HEIC(435바이트,
     `heif.ts`의 `PROBE`)를 한 번 열어 본다. Safari는 읽으므로 이 길을 타지 않는다
   - 못 읽으면 `heifToJpeg(file, { side: 2048, quality: 0.85 })`로 크기(바로 세운 원래 크기)와 줄인 JPG를 받아 썸네일·비교 화면에 쓴다
     (브라우저는 HEIC를 `<img>`로 그리지 못한다)
2. "변환하기" → `processImage()` → 워커 풀의 `run()`이 **일을 시작할 때** `readable(file)`로 HEIC를 풀어 ImageBitmap으로 바꾸고
   처리 워커에 transfer한다 (미리 한꺼번에 풀면 12MP 한 장에 48MB씩 메모리에 남는다)
3. 처리 워커는 ImageBitmap이면 그대로(이미 바로 섬), 파일이면 `createImageBitmap(..., { imageOrientation: 'from-image' })`
4. 풀기 워커(`heif.worker.ts`)
   - 처음 띄울 때 화면이 `fetch(wasmUrl)`로 받은 엔진 바이트를 `init`으로 넘긴다. Emscripten 모듈에 `wasmBinary`로 줘서 워커는 받으러 가지 않는다
   - `heif_context_read_from_memory` → `heif_js_context_get_primary_image_handle` → `heif_js_decode_image2(RGB, interleaved RGBA)`.
     libheif가 irot·imir를 적용하고 깊은 비트를 8비트로 줄인다. 줄 끝 채움(stride)이 있어 줄마다 옮긴다
   - `colr`가 Display P3면 `new ImageData(..., { colorSpace: 'display-p3' })`로 만들어, 그리는 쪽(sRGB canvas)이 색을 바꾸게 한다
5. 결과·받기는 형식 변환과 같다 ([형식 변환](../image-convert/README.md))

### 라이브러리 고르기 (2026-10-23)

| 후보                       | 판·갱신         | 허가     | 판단                                                                                       |
| -------------------------- | --------------- | -------- | ------------------------------------------------------------------------------------------ |
| **libheif-js 1.23.5** (씀) | 2026-10 갱신    | LGPL-3.0 | libheif 판을 따라 관리됨. wasm(1.46MB)과 글루(91KB)가 따로 있어 직접 호스팅·바꿔 쓰기 쉽다 |
| heic-to 1.6.6              | 2026-10 갱신    | LGPL-3.0 | libheif를 감싼 것. 패키지 25MB(여러 빌드), 우리가 필요한 것보다 크다                       |
| heic2any 0.0.4             | 2023 이후 멈춤  | MIT 표기 | 안에 든 libheif가 오래됨, wasm을 JS에 넣어 크다                                            |
| heic-decode 2.1.0          | libheif-js 감쌈 | ISC      | Node용 편의 함수뿐                                                                         |

- `libheif-wasm/libheif.js`(글루) + `libheif.wasm`을 쓴다. `libheif-bundle.js`는 wasm을 base64로 품어 2MB가 넘고 엔진만 바꿔 쓰기 어렵다
- 안에 든 판: libheif 1.23 (`heif_get_version()` 1.23.5), libde265 1.0.15. HEVC 외 코덱(AV1 등)은 들어 있지 않다

### 데이터 보관 방식을 쓰지 않은 이유 (크기 판단)

- 엔진은 압축 전 **1.46MB**, gzip **0.48MB**, brotli **0.36MB**다. Cloudflare가 압축해 보내면(wasm은 압축 대상 형식) 실제로 받는 것은 0.5MB 아래다
- [데이터 보관](../../foundations/fonts-and-data/README.md)(받기 전에 묻기·바깥 보관·SHA-256)은 OCR(2.9MB+언어 데이터)·얼굴(17MB)·글꼴처럼
  수 MB인 데이터를 위한 것이다. 0.5MB는 PDF 도구들이 묻지 않고 받는 pdf.js(약 1MB)보다 작다
- 묻는 단계를 넣으면 HEIC를 쓰는 모든 도구(형식 변환·자르기·모자이크·증명사진·이어 붙이기·이미지를 PDF로·압축·크기 조절·용량 맞추기 등)에 동의 화면이 생긴다.
  HEIC 변환 도구는 그것이 할 일의 전부라 '받을까요?'가 군더더기다
- 그래서 Vite가 `/_astro/libheif.<해시>.wasm`으로 내보내는 빌드 자산으로 두고, **브라우저가 못 읽는 HEIC가 처음 들어왔을 때만** 받는다
  (Safari·HEIC를 넣지 않은 방문은 받지 않는다). 주소에 내용 해시가 들어가 글루와 판이 어긋나지 않는다
- 받는 곳은 우리 사이트(`/_astro/`, CORS 허용)뿐이고 frame CSP(`connect-src` 우리 사이트)를 지킨다. 격리 frame은 브라우저 캐시가
  방문마다 비워져 방문마다 한 번 받는다 (0.5MB라 감수). 다음에 커지면 데이터 보관 방식으로 옮긴다

### 라이선스 (LGPL-3.0) 처리

- libheif·libde265는 GNU LGPL 3.0이다. 고치지 않고 쓰고, 엔진(wasm)은 사이트 코드와 따로 된 파일로 받는다
- `scripts/copy-libheif-notice.mjs`가 `public/vendor/libheif/`에 둔다 (설치된 패키지와 판이 맞아야 해서 커밋하지 않고 dev/build 전에 만든다)
  - `LICENSE.txt`: libheif-js에 든 허가서 전문 (LGPL 3.0과 그 바탕인 GPL 3.0)
  - `README.txt`(한·영): 쓰는 라이브러리와 판, 소스 저장소, 이 사이트의 소스(`site.config.ts`의 `sourceUrl`, 부르는 코드 위치),
    고친 libheif로 만든 libheif-js를 넣고 다시 빌드하면 바꿔 쓸 수 있다는 점
- 화면에서 보이는 고지: 도구 FAQ "크롬에서도 되나요? 무엇을 내려받나요?"에 이름·허가·안내 파일 주소를 적었다
- 사이트 소스가 공개 저장소라 LGPL 4항(라이브러리를 바꿔 다시 묶을 수 있는 소스)을 그대로 채운다. 소개 페이지에는 오픈소스 목록이 없어 더하지 않았다
- 글루(`libheif.js`)는 `heif.worker.ts` 번들에 함께 들어간다. 우리 코드도 공개라 바꿔 묶기에 막힘이 없다

### HEVC 특허 (기록)

- HEIC 안의 그림은 HEVC(H.265)로 압축되어 있고, HEVC는 특허 풀(Access Advance, Via LA 등)이 사용료를 받는다.
  크롬·파이어폭스가 HEIC·HEVC 이미지를 기본으로 넣지 않는 까닭이다
- libde265(디코더)를 웹에서 나눠 주는 것이 특허 사용료 대상인지는 나라·해석에 따라 다르고, 우리는 판단하지 않았다.
  사용자가 이 위험을 알고 넣기로 정했다 (2026-10-23). 특허권자의 요구가 오면 엔진 파일만 빼면 된다:
  `heif.ts`의 `decodeHeif` 경로가 실패하면 도구는 '읽지 못하는 이미지'로 알리고 Safari는 그대로 된다
- 우리는 HEVC로 **저장(인코딩)하지 않는다**. 결과는 JPG·PNG·WebP뿐이다

### 결정과 이유

- 새 도구를 형식 변환과 따로 둔 까닭: 'HEIC JPG 변환' 검색이 많고, 아이폰 설정·라이브 포토·촬영 정보 이야기는 형식 변환의 FAQ에 담기 어렵다.
  화면은 같은 부품(`ConvertTool`)을 쓴다
- 다른 이미지 도구도 같은 길(`readable`·`decodeImage`·`readForDisplay`·`heifToJpeg`)로 HEIC를 연다 ([이미지 공통](../../foundations/image-common/README.md))
- 원래 형식으로 저장하는 도구(압축·크기 조절·용량 맞추기)는 브라우저가 HEIC로 저장하지 못해 JPG로 저장한다 (2026-10-24).
  압축은 JPG가 HEIC보다 크면 원본 HEIC를 둔다(압축 도구의 원칙). 용량 맞추기는 HEIC를 받는 곳이 드물어 목표 이하여도 JPG로 맞춘다
- 위치 정보 지우기는 HEIC를 다시 저장하지 않고 EXIF·XMP 항목을 그 자리에서 덮어쓴다 (2026-10-24, [위치 정보 지우기](../image-remove-location/README.md)).
  JPG로 바꿔 저장하는 방법도 있었지만 '다시 저장하지 않는다'는 도구의 약속을 지킬 수 있고 위치표(iloc) 길이를 바꾸지 않으면 안전해서 고쳤다
- 대표 그림만 쓰는 까닭: 사진 앱이 보여 주는 것이 대표 그림이고, 나머지는 썸네일·깊이·게인 맵이나 연사의 다른 장이다
- P3를 sRGB로: 바꾸지 않으면 아이폰 사진이 크롬 결과에서 눈에 띄게 옅어진다. Safari 경로는 브라우저가 같은 일을 한다
- 풀기 워커는 1~2개만: 12MP 한 장을 풀 때 엔진이 150MB쯤 쓴다. 처리 워커(1~4개)는 풀린 그림을 받아 쓴다

### 주의할 점

- `heif.ts`는 화면 스레드 전용이다 (워커를 띄우고 `fetch`한다). 워커 안(`prepare.ts`의 `toEmbeddable` 등)에서 부르지 않는다
- 넘긴 ImageBitmap은 transfer되어 원래 쪽에서 비워진다. 같은 그림을 두 번 쓰려면 다시 푼다
- `PROBE`를 바꾸면 Safari에서 다시 확인한다 (못 읽으면 Safari도 libheif 길로 간다. 틀리지는 않지만 느리다)
- 버튼 이름("변환하기", "모두 받기")을 바꾸면 `content.ts`·가이드도 맞춘다

## 3. 구현 체크리스트

- [x] libheif-js 고르기·고정 판(1.23.5), 엔진은 빌드 자산, 글루는 워커 번들
- [x] 풀기 워커: 대표 그림, irot·imir, 8비트, Display P3 → sRGB, 깨진 파일은 `decode` 실패
- [x] 브라우저가 읽는지 확인(Safari는 libheif를 받지 않음)
- [x] 목록 썸네일·비교 화면용 줄인 JPG, 처리할 때 일 단위로 풀기
- [x] 도구 폴더·레지스트리·묶음 설명, 흐름 그림 HEIC 종이
- [x] 한·영 문구, 쓰임새·사용법·FAQ, 가이드 글(실제 결과 그림 1장)
- [x] 견본 2장, E2E (로컬 처리 약속 포함, 요청에 HEIC 머리 `ftyp`가 실리지 않는지도 검사)
- [x] LGPL 허가서·안내, FAQ 고지, HEVC 특허 기록
- [x] 다른 이미지 도구에서 HEIC 열기 (형식 변환·자르기·모자이크·증명사진·이어 붙이기·이미지를 PDF로)
- [x] 압축·크기 조절·용량 맞추기에서 HEIC (2026-10-24, JPG로 저장)
- [x] 위치 정보 지우기에서 HEIC (2026-10-24, EXIF·XMP 항목을 같은 길이로 그 자리에서 덮어쓰기)
- [x] 이미지 넣기·서명 넣기(`embedImage`)에서 HEIC (2026-10-24, JPG로 바꿔 넣고 미리보기도 그 JPG)
- [ ] 목록을 읽을 때 원본을 다 풀지 않고 HEIC 안의 작은 미리보기(thmb)만 풀기 (지금 embind에 썸네일 API가 없다)

## 4. 검증

### 자동 테스트

`tests/e2e/image-heic-to-jpg.spec.ts` (크롬은 HEIC를 못 읽어 libheif 경로가 돈다)

- `iphone.heic` → `iphone.jpg` 300×400, 네 귀퉁이 파랑·빨강·흰색·초록(시계 방향으로 바로 섬), 썸네일이 300px JPG, EXIF 없음, 로컬 처리
- `iphone`·`burst`·`deep` → `HEIC_변환.zip`. `burst`는 대표 그림(빨강 120×160)만, `deep`(10비트)은 (200, 40, 40) ±8
- `p3.heic`를 PNG로 → 빨강이 208보다 짙다 (P3 → sRGB를 했다)
- `broken.heic`는 '읽지 못하는 사진입니다'로 빼고 나머지만 바꾼다
- 견본 두 장 → ZIP, 둘째 장은 1200×1600
- 영어 화면

다른 도구: `image-convert`·`image-crop`·`image-mosaic`·`image-id-photo`·`image-stitch`·`pdf-from-image`·`image-compress`·`image-resize`·`image-target-size`·
`image-remove-location`(`located.heic`, 두 방식)·`image-remove-bg`·`image-ocr`·`pdf-stamp`(이미지 넣기·서명 넣기)에 HEIC 열기 테스트가 있다

### 직접 확인

- 2026-10-23: 크롬(Playwright)으로 1280·390 폭 화면 확인. 12MP HEIC 풀기는 Node에서 약 0.7초
- Safari 확인 기록 없음 (Safari는 브라우저가 스스로 읽는 길)

### 히스토리

- [history.md](./history.md): PR·커밋·리뷰 지적과 처리
