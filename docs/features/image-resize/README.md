# 이미지 크기 조절 (`image/resize`)

쓴 날 2026-10-16 · 고친 날 2026-10-24

- 주소: `/image/resize/` (영어 `/en/image/resize/`)
- 상태: live (PR #36, 2026-10-15 병합)
- 관련 문서: [히스토리](./history.md), [이미지 공통](../../foundations/image-common/README.md),
  [격리 frame](../../foundations/frame-isolation/README.md)
- 가이드 글: `src/content/guides/ko/resize-image.md` (영어판 `en/resize-image.md`)

## 1. 어떤 기능인지

- 이미지의 가로·세로 화소를 비율(%)이나 픽셀로 바꾼다. 여러 장을 같은 크기로 맞출 때 쓴다
- 입력: JPG·PNG·WebP·HEIC, 여러 장. HEIC는 브라우저가 못 읽으면 libheif로 연다 (2026-10-24)
- 출력
  - 한 장: `<원래 이름>_<가로>x<세로>.<원래 확장자>` (예: `photo_300x225.jpg`)
  - 여러 장: `이미지_크기조절.zip` (영어 `resized-images.zip`). 성공한 것만 넣는다
  - 목록의 ↓ 버튼으로 한 장씩도 받는다
- 크기를 정하는 방법
  - 비율로: 1~400%
  - 가로·세로 크기로 + "원래 비율 유지"(기본 켬): 적은 칸 안에 들어가게 맞춘다. 한쪽만 적으면 그쪽에 맞춘다
  - "원래 비율 유지"를 끄면: 가로·세로를 모두 적어야 하고, 그 크기로 정확히 맞춘다 (늘어나거나 눌린다, 잘라 내지 않는다)
- 결과 비교: 결과가 나온 줄의 "비교"로 원본과 겹쳐 보고 손잡이를 끌어 비교한다 ([이미지 공통](../../foundations/image-common/README.md))
- 하지 않는 것·한계 (화면·FAQ와 같게)
  - 결과는 한 변 16384px, 전체 6400만 화소까지. 넘으면 "결과가 너무 큽니다"로 막는다
  - 키우면 없는 세부를 만들지 못해 흐려진다
  - 원래 형식으로 저장한다. JPG·WebP는 화질 0.92, PNG는 손실 없이(투명 유지). HEIC는 HEIC로 저장하지 못해 JPG로 (HEIC가 있으면 설정 아래 안내)
  - EXIF 방향은 미리 적용하고, 위치 같은 EXIF는 남기지 않는다

## 2. 어떻게 만드는지

### 파일

| 파일                                 | 역할                                                                                                                                           |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/tools/image/resize/meta.ts`     | 이름·설명·아이콘, 묶음 `optimize`, 관련 도구 `image/compress`·`pdf/from-image`                                                                 |
| `src/tools/image/resize/content.ts`  | 사용법 4단계·FAQ 5개 (한·영)                                                                                                                   |
| `src/tools/image/resize/messages.ts` | 화면 문구, `Mode`(`percent`·`pixels`)                                                                                                          |
| `src/tools/image/resize/Frame.astro` | `FrameLayout` 안에 `App.svelte`를 mount                                                                                                        |
| `src/tools/image/resize/App.svelte`  | 설정·결과 크기 계산·실행·받기                                                                                                                  |
| 공통                                 | `ImageBatchTool`·`ImageBatch`·`processImage` ([이미지 공통](../../foundations/image-common/README.md)), `ActionBar`, `downloadFile`, `makeZip` |

### 처리 흐름

1. `ImageBatchTool`로 이미지를 넣는다. 목록 줄마다 `1200×900 → 600×450 · 크기`처럼 바뀔 크기를 미리 보여 준다
2. 설정을 검사한다 (`problem`): 비율 범위, 크기 칸이 비었는지, 비율 유지를 끄면 둘 다 있는지
3. `targetOf(item)`로 이미지마다 결과 크기를 계산하고, 하나라도 상한을 넘으면 `tooLarge`로 막는다
4. "크기 바꾸기" → `canUse('image/resize')` → `processImage(file, { type: saveType(item), quality: 0.92, pngColors: 0, size })` (HEIC는 JPG)
5. 결과 이름은 워커가 돌려준 실제 가로·세로로 만든다
6. 받기: 한 장이면 "다운로드", 여러 장이면 "모두 받기 (ZIP, n장)"

### 크기 계산 (`targetOf`)

- 비율: `round(원래 × percent/100)`, 최소 1
- 비율 유지: `s = min(가로칸/원래가로, 세로칸/원래세로)` (빈 칸은 무한대로 보고 뺀다), 가로·세로에 같은 `s`
- 정확히: 적은 값 그대로
- 빈 칸·0·음수는 "없는 값"으로 본다 (`positive()`)

### 결정과 이유

- 크기만 바꾸는 도구라 화질 손실이 눈에 띄지 않게 JPG·WebP 0.92, PNG는 색을 줄이지 않는다.
  PNG를 무손실로 저장할 때는 UPNG보다 브라우저 저장이 훨씬 빨라 공통 워커가 브라우저로 저장한다 (`8d1f3a2`)
- 상한 16384px·6400만 화소는 "브라우저 canvas가 확실히 그릴 수 있는 크기"로 잡은 값이다 (`MAX_SIDE`·`MAX_PIXELS`)
- 크게 줄일 때는 공통 워커가 절반씩 나눠 줄인다 (한 번에 줄이면 가는 선이 끊긴다)
- 결과는 설정 문자열(`percent:…` 또는 `pixels:가로:세로:비율유지`)과 함께 둔다. 설정을 바꾸면 다시 실행해야 한다

### 주의할 점

- 뺀 이미지의 결과는 `onremove`에서 지운다 (리뷰 지적 #36, `a616482`)
- 원래 형식으로 저장하므로 `saveType(item)`을 쓴다 (형식을 모르면 JPG). `anyFormat`을 켜면 GIF·BMP도 JPG가 되니 켜지 않는다
- 오류 안내: 설정 문제(`blocker`)는 굵게, "읽는 중"·"넣어 주세요"는 보통 글자로 막대에 보인다
- 버튼 이름("크기 바꾸기", "모두 받기")이나 칸 이름을 바꾸면 `content.ts`·가이드 글·E2E(`getByLabel('비율 (%)')` 등)도 맞춘다

## 3. 구현 체크리스트

- [x] 폴더(`meta.ts`·`content.ts`·`Frame.astro`·`App.svelte`·`messages.ts`)와 레지스트리 등록 (`84156dc`)
- [x] 비율·칸 맞추기·정확한 크기, 줄마다 바뀔 크기 미리 보기
- [x] 너무 큰 결과 막기, 입력 검사 안내
- [x] 한·영 문구, 사용법·FAQ, 가이드 글
- [x] E2E (로컬 처리 약속 `expectLocalOnly` 포함)
- [x] `status: 'live'`
- [x] HEIC 받기 (2026-10-24, JPG로 저장)
- [ ] 비율이 다를 때 잘라서 맞추기(cover) — 없음. 지금은 늘리거나(정확히) 칸 안에 맞춘다(비율 유지)

## 4. 검증

### 자동 테스트

`tests/e2e/image-resize.spec.ts`

- 비율 25%로 줄이면 `photo_300x225.jpg`(JPG, 300×225)가 되고, 요청에 파일이 나가지 않는다
- 비율 유지 + 200×200 칸: 가로 사진 200×150, 세로 사진(EXIF로 세운 `rotated.jpg`) 150×200, PNG 200×150(투명 유지)을 `이미지_크기조절.zip`으로
- 비율 유지를 끄면 한쪽만 적었을 때 막고, 500×500을 적으면 정확히 500×500
- `iphone.heic`(크롬은 libheif 경로)를 바로 세운 300×400 기준 50%로 줄여 `iphone_150x200.jpg`로 저장한다
- 가로 20000px처럼 너무 큰 결과는 "결과가 너무 큽니다"로 알리고 버튼을 막는다

### 직접 확인

- 확인 기록 없음 (커밋·PR에 남은 것이 없다)

### 히스토리

- [history.md](./history.md): PR·커밋·리뷰 지적과 처리
