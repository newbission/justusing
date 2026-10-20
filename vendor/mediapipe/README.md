# MediaPipe Face Landmarker 모델

증명사진 도구(`/image/id-photo/`)가 얼굴 위치·기울기를 찾는 데 쓰는 모델이다.
npm 패키지에 들어 있지 않아 받아서 그대로 커밋해 두었다 (고치지 않음).

- 파일: `face_landmarker.task` (float16, 버전 1)
- 받은 곳: https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
- SHA-256: `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`
- 허가: Apache License 2.0 (`LICENSE`, Google MediaPipe, https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker)

`scripts/copy-face-data.mjs`가 dev/build 전에 엔진(`@mediapipe/tasks-vision`의 wasm)과 함께 `public/data/face/`로 복사한다.
