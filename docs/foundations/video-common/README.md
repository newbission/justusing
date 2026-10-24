# 동영상 도구 공통 (`src/lib/video/`)

쓴 날 2026-10-23 · 고친 날 2026-10-23

- 쓰는 곳: [동영상 자르기](../../features/video-trim/README.md), [용량 줄이기](../../features/video-compress/README.md),
  [소리 추출](../../features/video-extract-audio/README.md). 동영상을 GIF로·장면 캡처는 `<video>`·canvas로 장면을 뽑는
  따로 된 기반(`src/lib/video-frames/`)을 쓴다 (WebCodecs·mediabunny를 쓰지 않음)
- 상태: PR 진행 중 (feat/video-tools)
- 관련 문서: [히스토리](./history.md), [격리 frame](../frame-isolation/README.md)

## 1. 무엇인지

동영상 하나를 열어 "자르기·다시 저장·소리 꺼내기"를 하는 도구들의 공통 부분이다.

- **열기** `SingleVideoTool`: 파일 고르기 → 그릇·길이·트랙·코덱 읽기 → 정보 막대(길이·크기·해상도·코덱) → 도구 화면
- **처리** `engine.ts`: mediabunny로 그릇(MP4·MOV·WebM·MKV)을 읽고 쓰고, 풀기·다시 저장은 브라우저 WebCodecs가 한다
- **진행** `VideoJobRunner`: 시작 → 진행률·남은 시간 → 결과(받기) / 실패 / 그만두기
- **지원 확인**: 열 때 이 브라우저가 그 코덱을 풀 수 있는지, 해상도마다 H.264·VP9로 저장할 수 있는지, AAC·Opus로 저장할 수 있는지
  (`isConfigSupported`, mediabunny `canDecode`·`getFirstEncodableVideoCodec`·`canEncodeAudio`)를 읽어 화면이 미리 알린다

하지 않는 것·한계

- ffmpeg.wasm을 쓰지 않는다 (수십 MB, 사용자 철칙 2026-10-24). 그래서 브라우저 WebCodecs가 못 다루는 코덱(MPEG-4 Part 2·WMV 등)과
  그릇(AVI·WMV·FLV)은 열지 않는다. 코덱을 모르면 열 때 알린다
- 다시 인코딩하는 일은 WebCodecs가 있어야 한다: 크롬·엣지 94+, Safari 16.4+(동영상), Safari 26+(소리 풀기·저장), 파이어폭스 130+(컴퓨터).
  그릇만 바꾸는 일(빠르게 자르기, 소리 그대로 꺼내기)은 WebCodecs 없이 된다
- 결과는 메모리(Blob 조각)에 모았다가 받는다. 파일 시스템에 바로 쓰지 않는다 (격리 frame은 저장소를 못 쓴다)

## 2. 어떻게 만드는지

### 파일

| 파일                                                           | 역할                                                                                                                                          |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/video/video.ts`                                       | 화면 쪽 입구: `probeVideo()`, `runVideoJob()`(진행률·그만두기), `webCodecs()`(이 문서에 WebCodecs가 있는지). `engine`은 처음 쓸 때 `import()` |
| `src/lib/video/engine.ts`                                      | mediabunny 처리: `probe()`, `run()` → 계획(planTrim·planCompress·planAudio) → `Conversion` → 결과를 다시 읽어 길이·크기·코덱                  |
| `src/lib/video/blob-target.ts`                                 | `BlobCollector`: mediabunny `StreamTarget`의 쓰기를 Blob 조각으로 모은다. 이미 쓴 자리를 고쳐 쓰면 조각을 잘라(slice) 바꿔 끼운다             |
| `src/lib/video/plan.ts`                                        | 화면과 처리 코드가 같이 쓰는 규칙: 소리를 어떻게 담을지(`audioPlan`·`audioContainerFor`), 용량 줄이기 비트레이트·예상 용량                    |
| `src/lib/video/sizes.ts`                                       | 짧은 변 후보(원래·1080·720·480), 짝수 크기, 화질 단계별 비트레이트(화소·장면당 비트), 볼 만한 최소 비트레이트                                 |
| `src/lib/video/SingleVideoTool.svelte`                         | 공통 틀. `needs`('video'·'audio') 트랙이 없거나 코덱을 모르면 열지 않고 알린다. 미리보기용 blob URL을 만들고 닫을 때 해제                     |
| `src/lib/video/job.svelte.ts`                                  | `VideoJobRunner`(설정 key별 결과·실패, 그만두기, 늦게 온 결과 버리기), `progressText()`                                                       |
| `src/lib/video/messages.ts`, `time.ts`, `files.ts`, `types.ts` | 공통 문구·코덱 이름, 시간 보이기·읽기(`1:05.5`, `65.5`), 결과 파일 이름, 주고받는 타입                                                        |
| `src/frame/FrameLayout.astro`                                  | 동영상 카테고리 frame에만 CSP `media-src blob:` (미리보기 `<video>`, GIF·장면 캡처와 같이 씀)                                                 |
| `src/styles/tokens.css`                                        | `--color-video`: 미리보기 바탕(두 테마 같은 검정)                                                                                             |

### 처리 흐름

1. 파일을 고르면 `probeVideo(file)` → (처음이면 `engine` 청크를 받고) `Input(BlobSource)`가 필요한 부분만 잘라 읽어 길이·트랙·코덱·지원 여부를 낸다
2. 도구가 설정으로 일(`TrimJob`·`CompressJob`·`AudioJob`)을 만들어 `VideoJobRunner.start()`
3. `engine.run()`이 계획을 세워 `Conversion.init()` → 필요한 트랙이 빠지면(풀지 못함·저장하지 못함·옮기지 못함) 실패 이유로 바꿔 던진다
4. `execute()` 중 진행률을 0.2초마다 알린다. 그만두면 `conversion.cancel()`
5. 결과 Blob을 다시 읽어(MP4·MOV·WebM·MKV·M4A) 길이·크기·코덱을 재고, 화면은 '받기'를 보인다 (오래 걸린 뒤에는 저절로 받기가 막힐 수 있어 사용자가 누른다)

### 결정과 이유

- **mediabunny** (2026-10-23): MPL-2.0, 의존성 없음, 쓰는 부분만 번들(tree-shaking), mp4-muxer·webm-muxer를 만든 사람이 이어 관리(매주 릴리스).
  읽기·쓰기·자르기·다시 저장을 `Conversion` 하나로 한다. mp4box.js(읽기만, 쓰기는 따로)·mp4-muxer/webm-muxer(쓰기만, 지금은 mediabunny로 넘어감)보다
  하나로 끝나고 관리가 활발하다. 버전은 고정한다 (1.61.6)
  - MPL-2.0 고지: 번들에서는 허가서 머리말이 빠지므로 `scripts/copy-mediabunny-notice.mjs`가 dev·build 전에 `public/vendor/mediabunny/`에
    `LICENSE.txt`와 `README.txt`(고정 판의 npm·GitHub 주소, 이 사이트 소스)를 둔다. 세 도구의 FAQ "무엇을 내려받나요?"가 연결한다 (libheif와 같은 방식)
  - 크기: `engine` 청크 약 500KB(gzip 약 120KB). 대부분이 `Conversion`(풀기·저장 파이프라인)이고 그릇 형식은 몇 KB씩이라 도구별로 나누지 않았다.
    동영상 도구 페이지에서 **파일을 처음 열 때만** 받는다
- **워커가 아니라 frame 본문에서 돈다** (2026-10-23): 격리 frame(출처 null) 안에서 `createWorker()`로 띄운 blob 워커는 크롬에서 안전한 문맥
  (`isSecureContext`)이 아니라 `VideoDecoder`·`VideoEncoder`·`AudioDecoder`가 아예 없다. frame 본문(window)에는 있다.
  무거운 풀기·저장은 브라우저가 WebCodecs 뒤에서 따로 돌리고, mediabunny는 그릇 읽기·쓰기만 해서 화면이 멈추지 않는다
- **결과를 Blob 조각으로**: `BufferTarget`은 커질 때마다 ArrayBuffer를 두 배로 다시 잡아 큰 동영상에서 메모리가 모자란다. MP4는 목차를 끝에
  두고(`fastStart: false`) 4MiB씩 모아 Blob으로 바꾼다. 끝에 앞쪽 상자 크기를 고쳐 쓰는 것은 조각을 잘라 바꿔 끼운다
- **비트레이트는 `new Quality({ bitrate })`**: `new Quality(숫자)`는 화질 단계(0~1)다. 비트레이트를 그대로 넘겨 2.3MB가 14.4MB가 됐었다
- **화질 단계 비트레이트**: 화소·장면당 비트(높음 0.1·보통 0.06·낮음 0.035, 30fps 기준, 장면 수는 0.6제곱으로)로 정하되,
  원본이 화소마다 쓴 비트의 90%를 넘지 않게 한다 (이미 작게 저장된 영상이 커지지 않게)

### 주의할 점

- WebCodecs를 쓰는 코드를 워커로 옮기지 않는다 (위 "결정과 이유"). 격리 frame의 다른 secure-context 전용 API도 워커에서는 없을 수 있다
- `webCodecs()`는 frame 본문에서 본다. E2E는 `addInitScript`로 지워 "WebCodecs가 없는 브라우저"를 만든다 (frame에도 적용된다)
- 빠르게 자른 MP4를 다시 읽으면(`computeDuration`) 편집 목록으로 가린 장면까지 센다. 자르기 결과 길이는 고른 길이를 쓴다
- 소리 그릇(MP3·Ogg·FLAC·WAV)은 읽기 코드를 번들에 넣지 않으려고 결과를 다시 읽지 않는다 (길이는 원본 기준)
- 사이트 주소·파일 이름을 신호나 요청에 넣지 않는다. 미리보기 blob URL은 frame 안에서만 쓴다

## 3. 구현 체크리스트

- [x] mediabunny 고정 버전, 그릇 4종 읽기, 결과 그릇 MP4·MOV·WebM·MKV·M4A·MP3·Ogg·FLAC·WAV
- [x] 열 때 코덱·지원 확인, WebCodecs 없는 브라우저 안내
- [x] 진행률·남은 시간·그만두기, 결과 다시 읽기
- [x] 큰 파일: 필요한 부분만 읽기(BlobSource), 결과 Blob 조각
- [x] 견본 동영상(`scripts/samples/make_sea_video.py`), 테스트 동영상(`tests/fixtures/make_video_fixtures.py`)
- [ ] Safari·파이어폭스 실기기 확인 (E2E는 크롬만)
- [ ] 결과를 디스크에 바로 쓰기 (`showSaveFilePicker`는 격리 frame에서 막힐 수 있어 검토 필요)

## 4. 검증

### 자동 테스트

- 각 도구 E2E(`tests/e2e/video-*.spec.ts`)와 도우미 `tests/e2e/video.ts`: 받은 파일을 Node에서 mediabunny로 그릇만 읽어(트랙·코덱·크기·길이·첫 시각)
  확인하고, 장면 색은 바깥 페이지의 `<video>`로 풀어 본다 (도구와 다른 길)
- 테스트 동영상은 1초마다 색이 바뀌고(빨강·초록·파랑·노랑·자홍·청록) 키프레임이 2초마다다. 잡음을 얹어 실제 영상처럼 비트레이트를 쓴다
- `local-only.ts`: WebM·MKV(GkXfo), Ogg(OggS), WAV(WAVEfmt·UklGR) 첫머리도 요청에 없는지 본다

### 직접 확인

- 2026-10-23 맥 크롬(설치판·Playwright 번들): 자르기·줄이기·소리 추출, 1280·390 폭 화면
