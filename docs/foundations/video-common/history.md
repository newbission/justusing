# 동영상 도구 공통 — 검증·오류·수정 히스토리

쓴 날 2026-10-23 · 고친 날 2026-10-23

## 요약

- 2026-10-23 처음 만듦. 그릇 읽기·쓰기는 mediabunny(MPL-2.0, 고정 1.61.6), 풀기·저장은 브라우저 WebCodecs. ffmpeg.wasm은 쓰지 않는다 (사용자 철칙)
- 2026-10-23 처음에는 mediabunny를 워커에서 돌렸는데 H.264를 '풀 수 없음'으로 보였다. 격리 frame(출처 null) 안의 blob 워커는 안전한 문맥이 아니어서
  WebCodecs가 아예 없었다(`isSecureContext === false`). frame 본문에서 동적 import로 돌리게 바꿨다
- 2026-10-23 `new Quality(숫자)`를 비트레이트로 알고 넘겨 줄인 동영상이 원본의 6배(2.3MB → 14.4MB)가 됐다. 숫자는 화질 단계(0~1)였다. `{ bitrate }`로 고침
- 2026-10-23 빠르게 자른 MP4를 다시 읽으면 편집 목록으로 가린 장면까지 세어 길이가 1.8초로 보였다(실제 재생 1.7초, ffprobe로 확인). 자르기 결과 길이는 고른 길이로
- 2026-10-23 리뷰: mediabunny(MPL-2.0) 고지가 배포물에 없었다(번들에서 머리말이 빠짐). `public/vendor/mediabunny/`에 허가서와 소스 안내를 두고 FAQ에서 연결

## 기록

<!-- auto:start -->
<!-- scripts/docs/history.mjs가 만든다. 직접 고치지 않는다 -->
<!-- auto:end -->
