# 동영상 소리 추출 (`video/extract-audio`)

쓴 날 2026-10-23 · 고친 날 2026-10-23

- 주소: `/video/extract-audio/` (영어 `/en/video/extract-audio/`)
- 상태: PR 진행 중 (feat/video-tools)
- 관련 문서: [히스토리](./history.md), [동영상 공통](../../foundations/video-common/README.md)

## 1. 어떤 기능인지

- 동영상에서 소리만 꺼낸다
- 입력: 동영상 하나 (MP4·MOV·WebM·MKV). 소리 트랙이 있고 코덱을 알아야 한다
- 출력: `<이름>_소리.<형식>` (영어 `_audio`)
  - 원래 소리 그대로(기본): AAC → `.m4a`, MP3 → `.mp3`, Opus·Vorbis → `.ogg`, FLAC → `.flac`, PCM → `.wav`. 다시 인코딩 없음, WebCodecs 없이 됨
  - WAV: 풀어서 16비트 PCM (AudioDecoder 필요, Safari는 26부터)
  - M4A(AAC로 다시 저장, 192kbps): 원래 소리가 AAC가 아닐 때만 보인다 (AudioEncoder AAC 필요)
- 첫 소리 트랙만 (`tracks: 'primary'`)

하지 않는 것·한계

- MP3로 새로 저장하지 않는다: 브라우저에 MP3 인코더가 없다 (FAQ에 밝힘)
- 구간을 고르지 않는다: 일부만 필요하면 동영상 자르기를 먼저 (FAQ·가이드)
- AC-3 등 그대로 담을 그릇이 없는 코덱은 WAV·M4A로만

## 2. 어떻게 만드는지

### 파일

| 파일                                          | 역할                                                                    |
| --------------------------------------------- | ----------------------------------------------------------------------- |
| `src/tools/video/extract-audio/App.svelte`    | 미리보기, 이 동영상의 소리(코덱·kHz·채널), 저장 형식(고를 수 없는 까닭) |
| `src/tools/video/extract-audio/messages.ts`   | 문구 (한·영)                                                            |
| `src/lib/video/plan.ts`의 `audioContainerFor` | 원래 소리를 담을 그릇                                                   |
| `src/lib/video/engine.ts`의 `planAudio`       | `video: { discard: true }`, 그대로는 `copy: { mode: 'forced' }`         |

### 결정과 이유

- 기본을 그대로 꺼내기로: 음질 손실이 없고 가장 빠르며 거의 모든 휴대폰·카메라 영상(AAC)이 M4A가 된다
- '못 하면 WAV': WAV는 거의 모든 편집 프로그램이 열지만 크다(1분 약 10MB). M4A 다시 저장은 AAC 인코더가 있는 브라우저에서만
- 예상 용량: 그대로는 원본 소리 비트레이트, WAV는 표본율 × 채널 × 2바이트, M4A는 192kbps

### 주의할 점

- WAV·M4A로 다시 저장하는 길은 frame 본문의 WebCodecs가 있어야 한다 (워커에서는 없다, 동영상 공통 문서)
- 결과 소리 그릇(MP3·Ogg·FLAC·WAV)은 다시 읽지 않아 길이는 원본 기준으로 보인다

## 3. 구현 체크리스트

- [x] 폴더·레지스트리, 그대로·WAV·M4A, 고를 수 없는 까닭, 예상 용량
- [x] 한·영 문구·사용법·FAQ (가이드는 용량 줄이기·자르기 가이드에서 잇는다)
- [x] E2E, wrangler 확인
- [ ] 소리 가이드 글 (필요하면)

## 4. 검증

### 자동 테스트

- `tests/e2e/video-extract-audio.spec.ts`
  - AAC → `clip_소리.m4a` 그대로(화면 트랙 없음, AAC 48kHz 2채널, 6초), 이미 AAC라 M4A 다시 저장은 없음
  - WebM Opus → `.ogg`(Opus) 그대로, WAV(pcm-s16, 2채널)
  - AAC로 저장할 수 있으면 Opus → M4A(AAC), 없으면 까닭 안내
  - WebCodecs가 없으면 WAV를 막고 그대로만, 소리 없는 동영상 안내(영어)

### 직접 확인

- 2026-10-23 맥 크롬: 견본(10초) → M4A 159KB

### 히스토리

- [history.md](./history.md)
