# 증명사진 만들기 — 검증·오류·수정 히스토리

쓴 날 2026-10-20 · 고친 날 2026-10-20

## 요약

- MediaPipe를 sandbox frame 워커에서 띄우려면 글루를 번들하고 wasm을 `instantiateWasm`으로 넘겨야 했다. `Module.wasmBinary`는
  이 빌드에서 읽히지 않아 엔진이 빈 주소로 받으러 가다 멈췄다
- 정수리를 사진 귀퉁이 색과 비교하면 스튜디오 사진의 그늘진 귀퉁이 때문에 대부분 실패했다. 머리 바로 위 배경과 비교하도록 바꿨다

## 기록

<!-- auto:start -->
<!-- scripts/docs/history.mjs가 만든다. 직접 고치지 않는다 -->
<!-- auto:end -->
