# 동영상 장면 캡처 (`video/frame-capture`)

쓴 날 2026-10-24 · 고친 날 2026-10-24

- 주소: `/video/frame-capture/` (영어 `/en/video/frame-capture/`)
- 상태: PR 진행 중 (2026-10-24)
- 관련 문서: [히스토리](./history.md), [동영상을 GIF로](../video-to-gif/README.md)(장면 읽기를 같이 씀),
  [격리 frame](../../foundations/frame-isolation/README.md)

## 1. 어떤 기능인지

- 동영상의 원하는 장면을 사진으로 저장한다. 화면 캡처와 달리 재생 막대 없이 동영상의 원래 크기 그대로
- 입력: 동영상 하나. **이 브라우저가 재생하는 형식만** (대개 MP4(H.264)·WebM, Safari는 HEVC·MOV도)
- 받는 방식
  - 지금 장면 한 장: 플레이어에 보이는 장면 → `<원래 이름>_00m01.50s.jpg`
  - 일정 간격으로 여러 장: 구간(시작·끝)에서 0.5·1·2·5·10초마다 → `<원래 이름>_장면.zip`(영어 `_frames.zip`),
    안의 이름은 `<원래 이름>_00m00.00s.jpg`… (이름순 = 시간순). 끝 시각에 장면이 걸리면 넣는다. 한 번에 200장까지
- 형식: JPG(화질 92%)·PNG
- 하지 않는 것·한계
  - 크기 바꾸기·자르기 없음 (이미지 도구로)
  - 장면 옮기기는 1/30초씩이다. 초당 60장 동영상은 두 장면씩 건너뛰어 위치를 숫자(0.01초)로 맞춘다 (FAQ에 밝힘)
  - 장면 화질은 동영상 압축만큼이다 (FAQ·화면에 밝힘)

## 2. 어떻게 만드는지

### 파일

| 파일                                                | 역할                                                                                                                    |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `src/tools/video/frame-capture/meta.ts`             | 이름·설명·아이콘·관련 도구, 넣는 것 그림(MP4 → JPG 여러 장)                                                             |
| `src/tools/video/frame-capture/content.ts`          | 쓰임새·사용법·FAQ (한·영)                                                                                               |
| `src/tools/video/frame-capture/App.svelte`          | 화면: 플레이어, 1/30초 버튼, 위치(초) 칸, 받는 방식·간격·구간·형식, 받기·그만두기                                       |
| `src/lib/video-frames/video.ts`                     | `openVideo()`, `seekVideo()`, `FrameReader.bitmap()`, `captureBitmap()` (→ [동영상을 GIF로](../video-to-gif/README.md)) |
| `src/lib/video-frames/times.ts`                     | `intervalTimes()`, 파일 이름 시각 `timeLabel()`, 화면 시각 `formatTime()`                                               |
| `src/lib/video-frames/still.ts` + `still.worker.ts` | 장면(ImageBitmap)을 워커의 OffscreenCanvas로 JPG·PNG 저장                                                               |
| `src/lib/zip.ts`                                    | 여러 장을 ZIP 하나로 (기존 공통 워커)                                                                                   |
| `tests/e2e/video-frame-capture.spec.ts`             | E2E                                                                                                                     |

### 처리 흐름

1. 파일 고르기 → `openVideo()` (첫 장면까지 풀어 봄, 못 열면 알림)
2. 지금 장면: 플레이어를 멈추고, 끄는 중이면 그 장면이 나올 때까지 기다린 뒤 canvas에 원래 크기로 그려 ImageBitmap → 워커가 저장 → 내려받기
3. 여러 장: 숨은 `<video>`(`FrameReader`)로 시각마다 찾아가 ImageBitmap → 워커 저장(3장까지 먼저 맡김) → 모두 모이면 ZIP 워커로 묶어 내려받기.
   만드는 동안 설정은 `<fieldset disabled>`로 잠그고 "그만두기"로 멈춘다

### 결정과 이유

- **브라우저 `<video>`로만** (사용자 철칙, 2026-10-24): ffmpeg.wasm 없이. 장면 찾기는 `currentTime` + `seeked`
- **장면은 canvas에 그린 뒤 ImageBitmap으로**: `createImageBitmap(video)`를 받지 않는 브라우저가 있다
- **저장은 워커**: 4K 장면 PNG 저장도 화면을 멈추지 않게
- **여러 장은 숨은 `<video>`로**: 사용자가 보던 플레이어 위치를 옮기지 않는다
- **파일 이름에 시각** (`00m01.50s`): 장 번호보다 쓸모 있고, 분·초를 0으로 채워 이름순이 시간순이 된다
- **200장까지**: 모두 메모리에 모아 ZIP으로 묶는다 (1080p PNG 200장이면 수백 MB)

### 주의할 점

- 플레이어의 `seeked`·`timeupdate`로 위치 칸을 맞춘다. 장면 받기 안내는 그 위치를 쓴다
- frame CSP의 `media-src blob:` (`FrameLayout.astro`, `video` 카테고리 frame에만)

## 3. 구현 체크리스트

- [x] 폴더와 레지스트리 등록, 견본(동영상을 GIF로와 같은 `ballClip`)
- [x] 지금 장면 받기, 1/30초 옮기기, 위치 칸, 일정 간격 ZIP, 그만두기
- [x] 한·영 문구, 사용법·FAQ
- [x] E2E (로컬 처리 약속 `expectLocalOnly` 포함)
- [x] `npm run build` 후 wrangler로 확인, 1280·390 화면 확인
- [ ] 가이드 글 (동영상 가이드는 GIF 용량 1편이 먼저)
- [ ] Safari·iOS에서 장면 찾기 확인

## 4. 검증

### 자동 테스트

- `tests/e2e/video-frame-capture.spec.ts`
  - 1.5초로 옮겨 받은 JPG: 이름 `color-steps_00m01.50s.jpg`, 320×180, 초록 장면
  - 1/30초 앞·뒤 버튼으로 2.53·2.47초, PNG로 받은 파랑 장면
  - 1초마다 0~3초 → ZIP 4장, 이름·순서, 빨강·초록·파랑·파랑
  - 간격·구간·"지금 위치를 시작으로"로 장 수가 바뀐다
  - 열지 못하는 파일, 영어 화면

### 직접 확인

- 2026-10-24 크롬(맥): 견본으로 1280·390×844 화면, 간격 단추 줄바꿈 확인

### 히스토리

- [history.md](./history.md): PR·커밋·리뷰 지적과 처리
