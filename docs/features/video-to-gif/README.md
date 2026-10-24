# 동영상을 GIF로 (`video/to-gif`)

쓴 날 2026-10-24 · 고친 날 2026-10-24

- 주소: `/video/to-gif/` (영어 `/en/video/to-gif/`)
- 상태: PR 진행 중 (2026-10-24)
- 관련 문서: [히스토리](./history.md), [장면 캡처](../video-frame-capture/README.md), [격리 frame](../../foundations/frame-isolation/README.md)

## 1. 어떤 기능인지

- 동영상의 한 구간을 움직이는 그림(GIF 또는 움직이는 WebP)으로 만든다. 움짤·화면 녹화를 문서·게시판에 붙일 때
- 입력: 동영상 하나. **이 브라우저가 재생하는 형식만** (대개 MP4(H.264)·WebM, Safari는 HEVC·MOV도)
- 고르는 것: 구간(시작·끝, 최대 30초), 폭(240·320·480·640px, 원본보다 큰 폭은 빼고 원본이 640px보다 작으면 원본 폭을 더함),
  초당 장면 수(5~20), GIF 색 수(256·128·64·32)·디더링, WebP 화질(높음 0.9·보통 0.75·낮음 0.5), 반복(계속·한 번)
- 출력: `<원래 이름>.gif` 또는 `.webp`. 만들기 전에 예상 용량, 만든 뒤 실제 용량과 결과 미리보기
- 하지 않는 것·한계
  - 소리 없음 (GIF·WebP가 담지 못함)
  - 재생 속도 바꾸기·자르기(화면 영역)·글자 넣기는 없음
  - Safari는 WebP로 저장하지 못해 WebP를 고를 수 없다 (화면에 까닭을 적는다)
  - 브라우저가 재생하지 못하는 동영상(크롬의 일부 HEVC, MKV 안의 낯선 코덱 등)은 열지 못한다고 알린다

## 2. 어떻게 만드는지

### 파일

| 파일                                       | 역할                                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `src/tools/video/to-gif/meta.ts`           | 이름·설명·아이콘·관련 도구, 넣는 것 그림(MP4 → GIF)                                                    |
| `src/tools/video/to-gif/content.ts`        | 쓰임새·사용법·FAQ (한·영)                                                                              |
| `src/tools/video/to-gif/App.svelte`        | 화면: 플레이어·구간, 설정, 예상 용량(설정이 바뀌면 400ms 뒤), 만들기·그만두기·받기, 결과 미리보기      |
| `src/lib/video-frames/video.ts`            | `openVideo()`(blob URL, 첫 장면까지 풀어 봄), `seekVideo()`, `FrameReader`(숨은 `<video>`로 장면 읽기) |
| `src/lib/video-frames/times.ts`            | 장면 시각(`frameTimes`), GIF 장면 길이(`frameDelays`, 10ms 단위 누적 반올림), 시각 표시                |
| `src/lib/video-frames/animation.ts`        | 화면 쪽 흐름: 색 표용 장면 → 워커 시작 → 장면을 하나씩 뽑아 보냄(4장까지 먼저) → 끝. 용량 예상         |
| `src/lib/video-frames/animation.worker.ts` | GIF·WebP 저장 워커. 장면을 받는 대로 저장하고 버린다                                                   |
| `src/lib/video-frames/palette.ts`          | 전체 색 표(gifenc `quantize`, rgb565), 화소 → 색 번호(가까운 색, 5비트 기억), 순서 디더링(Bayer 4×4)   |
| `src/lib/video-frames/gif-writer.ts`       | gifenc로 GIF 쓰기. 앞 장면과 같은 색 번호는 투명으로 비움(dispose 1)                                   |
| `src/lib/video-frames/webp-anim.ts`        | 브라우저가 저장한 WebP 한 장의 그림 조각(VP8·VP8L·ALPH)을 ANMF로 감싸 움직이는 WebP로 묶기             |
| `src/lib/video-frames/gifenc.d.ts`         | gifenc 타입 (쓰는 것만)                                                                                |
| `tests/e2e/video-to-gif.spec.ts`           | E2E                                                                                                    |
| `tests/fixtures/make_frame_fixtures.py`    | 시험 동영상 `color-steps.mp4`, 열지 못하는 `not-a-video.mp4`                                           |
| `scripts/samples/make_video_samples.py`    | 견본 `예시-공튀기기.mp4`·`sample-bouncing-ball.mp4` (직접 그린 4초, 33KB)                              |

### 처리 흐름

1. 파일 고르기 → `openVideo()`: blob URL을 숨은 `<video>`에 넣고 `loadedmetadata`·`loadeddata`(첫 장면)까지 기다린다.
   길이가 비어 있으면(MediaRecorder WebM) 끝으로 찾아가 알아낸다. 오류·20초 초과·폭 0이면 "열 수 없습니다"
2. 화면 플레이어(`<video controls muted>`)로 구간을 고른다. 장면 읽기는 따로 만든 숨은 `<video>`(`FrameReader`)가 해서
   사용자가 보던 위치를 건드리지 않는다
3. 설정이 바뀌면 400ms 뒤 예상: 색 표용 장면 12장 + 이어진 두 장면 3묶음을 실제로 저장해 본다 →
   `첫 장면 + (장면 수 - 1) × 바뀐 장면 평균` (WebP는 장면 평균 × 장면 수)
4. "GIF 만들기": 예상을 그만두고, 색 표용 장면 → 워커 `start`(색 표 만들기) → 장면마다 `seek` → canvas로 줄여 `getImageData` →
   워커로 넘김(버퍼 이동, 4장까지 먼저 보냄) → `finish`. 만드는 동안 설정은 `<fieldset disabled>`로 잠근다
5. 결과를 blob URL `<img>`로 미리 보이고 "GIF 받기"로 받는다. 설정을 바꾸면 결과를 지운다

### 결정과 이유

- **ffmpeg.wasm을 쓰지 않는다** (사용자 철칙, 2026-10-24): 수십 MB 엔진은 사이트를 무겁게 한다. 장면 풀기는 브라우저 `<video>`,
  줄이기는 canvas, GIF 저장만 gifenc(MIT, 압축본 9KB, gzip 4KB)로 한다. 이 도구 frame의 워커에서만 불러온다
  - 버린 것: gif.js(스스로 `new Worker(주소)`를 띄워 격리 frame에서 막힘, 2017년 이후 멈춤), omggif(색 줄이기가 없음)
  - WebCodecs(`VideoDecoder`)는 MP4·WebM을 풀어 줄 demuxer가 따로 필요하고, 격리 frame의 blob 워커에는 없다(secure context 아님,
    동영상 담당 A 확인). 장면 찾기(`seeked`)로 충분히 빨라 쓰지 않았다
- **전체 색 표 하나** (장면마다 색 표 X): 장면마다 바꾸면 멈춘 배경도 깜박이고, 투명 비우기가 덜 먹는다. 구간 곳곳 12장으로 만든다
- **바뀐 화소만 담기**: 앞 장면과 색 번호가 같으면 투명. 손실이 없고, 멈춘 배경(화면 녹화)이 크게 준다. 바뀐 영역만 잘라 쓰지는 않는다(gifenc는 늘 전체 크기)
- **순서 디더링**: 오차 확산은 한 화소가 바뀌면 그 뒤 무늬가 다 바뀌어 움직이는 그림에서 자글거리고 투명 비우기도 덜 먹는다.
  세기는 `128 / ∛색 수` (처음 `256 / ∛색 수`는 256색에서도 하늘에 점이 또렷해 반으로 줄임)
- **움직이는 WebP는 직접 묶는다**: 브라우저(`convertToBlob('image/webp')`)가 장면을 저장하고, 그림 조각만 꺼내 ANMF로 감싼다.
  라이브러리 없이 100줄 안쪽. 같은 설정에서 GIF의 4분의 1 정도 (견본: GIF 192KB, WebP 46KB)
- **구간 최대 30초**: GIF는 길이에 비례해 커져 30초면 수십 MB가 되기 쉽다. 장면을 쌓지 않아 메모리는 길이와 상관없다
- **예상 용량**: 정확히 하려면 다 만들어야 한다. 몇 장면만 실제로 저장해 늘려 잡고, 만든 뒤 실제 용량을 보인다 (견본: 예상 329KB, 실제 288KB)

### 주의할 점

- frame CSP에 `media-src blob:`가 있어야 `<video>`가 blob URL을 연다 (`FrameLayout.astro`)
- `seekVideo()`는 이미 그 시각이면 `seeked`가 오지 않으므로 기다리지 않는다. 동영상 끝 시각은 그릴 장면이 없는 브라우저가 있어 1ms 앞으로 찾아간다
- 워커 파일에 `/// <reference lib="webworker" />`를 넣지 않는다. 프로젝트 전체 타입이 바뀌어 다른 파일(`drop.ts` 등)에 타입 오류가 난다
- gifenc `quantize`는 버퍼 전체를 4바이트씩 읽는다. 장면들을 처음부터 시작하는 새 버퍼에 모아 넘긴다
- 투명 자리를 위해 색 표는 255색까지만 만든다 (`colors`가 256이어도)

## 3. 구현 체크리스트

- [x] 폴더(`meta.ts`·`content.ts`·`Frame.astro`·`App.svelte`·`messages.ts`)와 레지스트리 등록, 동영상 카테고리
- [x] 장면 읽기(`<video>` seek → canvas), GIF·WebP 저장 워커, 예상 용량
- [x] 한·영 문구, 사용법·FAQ, 가이드 글(`reduce-gif-size`) + 실제 결과 그림
- [x] 견본(직접 그린 4초 MP4), E2E (로컬 처리 약속 `expectLocalOnly` 포함)
- [x] `npm run build` 후 wrangler로 확인, 1280·390 화면 확인
- [ ] Safari·iOS에서 장면 찾기 확인 (숨은 `<video>`가 미리 읽지 않을 수 있음)
- [ ] 재생 속도(빠르게·느리게), 화면 일부만 자르기

## 4. 검증

### 자동 테스트

- `tests/e2e/video-to-gif.spec.ts`
  - 0~2초, 240px, 초당 10장 → GIF 240×135, 20장, 장면마다 1/10초, 계속 반복(NETSCAPE 0), 첫 장면 빨강, 예상 용량 표시, 미리보기
  - 1~3초, 320px, 초당 5장, 32색·디더링 끔, 한 번만 → 10장, 장면마다 1/5초, 반복 표시 없음
  - 설정을 바꾸면 만든 결과·미리보기를 지운다
  - 움직이는 WebP: VP8X 애니메이션 표시, 320×180, ANMF 15개, 반복 0, 첫 장면 빨강
  - 열지 못하는 파일, 영어 화면(원본이 320px이면 480px 선택지 없음)
- `samples.spec.ts`·`tour.spec.ts`·`tool-pages.spec.ts`가 견본·따라 하기·쓰임새를 함께 본다

### 직접 확인

- 2026-10-24 크롬(맥): 견본 4초 480px 초당 10장 128색 → 예상 329KB, 실제 288KB, 40장. 390×844에서 막대·버튼·선택지 줄바꿈 확인

### 히스토리

- [history.md](./history.md): PR·커밋·리뷰 지적과 처리
