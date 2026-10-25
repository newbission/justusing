# MediaPipe 모델

증명사진 도구(`/image/id-photo/`), 배경 지우기 도구(`/image/remove-bg/`), 모자이크(`/image/mosaic/`)가 쓰는 모델이다.
npm 패키지에 들어 있지 않아 받아서 그대로 커밋해 두었다 (고치지 않음). 허가는 모두 Apache License 2.0 (`LICENSE`, Google MediaPipe).

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

## 누른 곳의 물체 나누기 (Interactive Segmenter, MagicTouch)

배경 지우기에서 사용자가 누른 곳(처음에는 사진 가운데)의 물체·사람·동물을 배경과 나눈다.

- 파일: `magic_touch.tflite` (float32, 버전 1, 입력 512×512 + 누른 점 지도)
- 받은 곳: https://storage.googleapis.com/mediapipe-models/interactive_segmenter/magic_touch/float32/1/magic_touch.tflite
- SHA-256: `e24338a717c1b7ad8d159666677ef400babb7f33b8ad60c4d96db4ecf694cd25`
- 설명·허가: 모델 카드 https://storage.googleapis.com/mediapipe-assets/Model%20Card%20MagicTouch.pdf ("Licensed under Apache License, Version 2.0")
- 고른 이유 (2026-10-23): 일반 물체용 모델 비교는 `docs/features/image-remove-bg/README.md`

## 여러 얼굴 찾기 (Face Detector, BlazeFace full range)

모자이크에서 사진 속 얼굴(여러 명, 작은 얼굴)을 찾아 가릴 곳으로 넣는다.

- 파일: `blaze_face_full_range.tflite` (float16, 버전 1, 입력 192×192, 1.1MB)
- 받은 곳: https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_full_range/float16/1/blaze_face_full_range.tflite
- SHA-256: `3698b18f063835bc609069ef052228fbe86d9c9a6dc8dcb7c7c2d69aed2b181b`
- 설명·허가: 모델 카드 https://storage.googleapis.com/mediapipe-assets/MediaPipe%20BlazeFace%20Model%20Card%20(Full%20Range).pdf ("LICENSED UNDER Apache License, Version 2.0")
- 고른 이유 (2026-10-24): 같은 엔진의 `blaze_face_short_range`(230KB, 앞 카메라 셀카용)와 비교했다. 단체 사진
  (가상 인물 6명, 얼굴 폭 22~200px)을 통째로 넣으면 short range는 한 명도, full range는 3명을 찾았고, 사진을 나눠 보면
  short range는 가장 작은 얼굴을 놓치고 full range는 6명을 모두 찾았다. 번호판·풍경·상품 사진 4장에서 full range는 얼굴이
  아닌 곳을 찾지 않았다. 자세한 것은 `docs/features/image-mosaic/README.md`

`scripts/copy-face-data.mjs`가 dev/build 전에 엔진(`@mediapipe/tasks-vision`의 wasm)과 함께 `public/data/face/`로 복사한다.
