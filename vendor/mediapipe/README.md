# MediaPipe 모델

증명사진 도구(`/image/id-photo/`)가 쓰는 모델이다.
npm 패키지에 들어 있지 않아 받아서 그대로 커밋해 두었다 (고치지 않음). 허가는 둘 다 Apache License 2.0 (`LICENSE`, Google MediaPipe).

## 얼굴 점 찾기 (Face Landmarker)

얼굴 위치·기울기를 찾는다.

- 파일: `face_landmarker.task` (float16, 버전 1)
- 받은 곳: https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
- SHA-256: `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`
- 설명: https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker

## 사람 영역 나누기 (Selfie Segmenter)

배경을 바꿀 때 사람과 배경을 나눈다.

- 파일: `selfie_segmenter.tflite` (float16, 버전 1, 정사각 256×256)
- 받은 곳: https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite
- SHA-256: `191ac9529ae506ee0beefa6b2c945a172dab9d07d1e802a290a4e4038226658b`
- 설명: https://ai.google.dev/edge/mediapipe/solutions/vision/image_segmenter
- 고른 이유 (2026-10-20): 같은 엔진으로 도는 여러 부위 모델(`selfie_multiclass_256x256`, 16MB)보다 작고(250KB),
  성조기 같은 복잡한 배경 사진 3장에서 배경을 덜 남겼다. 흰 배경 사진의 머리카락 가장자리는 둘이 비슷했다

`scripts/copy-face-data.mjs`가 dev/build 전에 엔진(`@mediapipe/tasks-vision`의 wasm)과 함께 `public/data/face/`로 복사한다.
