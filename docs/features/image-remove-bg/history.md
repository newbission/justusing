# 이미지 배경 제거 — 검증·오류·수정 히스토리

쓴 날 2026-10-23 · 고친 날 2026-10-23

## 요약

- 2026-10-23 처음 만듦. 모델 후보(Selfie Segmenter, MagicTouch v1·v2, U²-Net, RMBG, BiRefNet)를 크기·허가·품질로 견줘
  MagicTouch v1(6.2MB, Apache-2.0)을 골랐다. 증명사진과 엔진을 같이 써서 엔진 띄우기(`mediapipe-engine.ts`)와 파일 목록(`data-files.ts`)을 나눴다
- 2026-10-23 부드럽게를 1로 두니 상품 사진 테두리에 탁자 색이 2~3화소 비쳐 기본값을 0으로 바꿨다
- 2026-10-23 휴대폰 폭에서 "데이터 받기"가 미리보기 아래로 밀려 보이지 않아 데이터 칸을 미리보기 위로 옮겼다

## 기록

<!-- auto:start -->
<!-- scripts/docs/history.mjs가 만든다. 직접 고치지 않는다 -->
<!-- auto:end -->
