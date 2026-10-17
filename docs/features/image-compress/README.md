# 이미지 압축 (`image/compress`)

쓴 날 2026-10-16 · 고친 날 2026-10-16

- 주소: `/image/compress/` (영어 `/en/image/compress/`)
- 상태: live (PR #36, 2026-10-15 병합)
- 관련 문서: [히스토리](./history.md), [이미지 공통](../../foundations/image-common/README.md),
  [격리 frame](../../foundations/frame-isolation/README.md)
- 가이드 글: `src/content/guides/ko/compress-image.md` (영어판 `en/compress-image.md`)

## 1. 어떤 기능인지

- 사진·화면 캡처의 용량을 가로·세로는 그대로 두고 줄인다. 메신저·메일·웹 올리기용
- 입력: JPG·PNG·WebP, 여러 장 (개수 제한 없음)
- 출력
  - 한 장: `<원래 이름>_압축.<확장자>` (영어 `_compressed`)
  - 여러 장: `이미지_압축.zip` (영어 `compressed-images.zip`). 줄어든 것은 결과를, 원본 그대로 둔 것은 원본을 넣는다
  - 목록의 ↓ 버튼으로 한 장씩도 받는다
- 설정
  - 줄이는 정도: 조금(화질 우선) / 보통(추천) / 많이(용량 우선)
  - 저장 형식: 원래 형식 그대로 / WebP로 바꾸기(더 작음)
- 하지 않는 것·한계 (화면·FAQ와 같게)
  - 가로·세로 크기는 바꾸지 않는다. 크기까지 줄이려면 "이미지 크기 조절"
  - 원본보다 작아지지 않으면 원본을 그대로 둔다 ("이미 작아서 원본 그대로")
  - EXIF(위치·날짜·기기)는 남지 않는다. 휴대폰 사진 회전은 미리 적용한다
  - "조금"은 PNG 색을 줄이지 않아 PNG 화질이 그대로다
  - 브라우저가 WebP로 저장하지 못하면 알린다 ("원래 형식 그대로"로 해 보세요)
  - 휴대폰에서 아주 큰 사진 수십 장은 메모리가 모자랄 수 있다 (FAQ)

## 2. 어떻게 만드는지

### 파일

| 파일                                   | 역할                                                                                                                                           |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/tools/image/compress/meta.ts`     | 이름·설명·아이콘, 묶음 `optimize`, 관련 도구 `image/resize`·`pdf/compress`                                                                     |
| `src/tools/image/compress/content.ts`  | 사용법 4단계·FAQ 6개 (한·영)                                                                                                                   |
| `src/tools/image/compress/messages.ts` | 화면 문구, `Level`·`Format` 타입                                                                                                               |
| `src/tools/image/compress/Frame.astro` | `FrameLayout` 안에 `App.svelte`를 mount                                                                                                        |
| `src/tools/image/compress/App.svelte`  | 설정·실행·결과 표시·받기                                                                                                                       |
| 공통                                   | `ImageBatchTool`·`ImageBatch`·`processImage` ([이미지 공통](../../foundations/image-common/README.md)), `ActionBar`, `downloadFile`, `makeZip` |

### 처리 흐름

1. `ImageBatchTool`로 이미지를 넣는다 (`new ImageBatch()`, JPG·PNG·WebP만)
2. "압축하기" → `canUse('image/compress')` → 지금 설정으로 아직 `done`이 아닌 이미지만 처리한다
3. 이미지마다 `processImage(file, { type, quality, pngColors })` (크기 없음 = 원래 크기)
   - `type`: "그대로"면 원래 형식(`item.type`), "WebP"면 `image/webp`
4. 결과가 원본보다 작으면 `done`, 아니면 `kept`, 오류면 `failed`(`decode`·`encode`)
5. 모두 끝나면 막대에 합계 `완료: 전 → 후 (n% 줄어듦)`. 줄어든 것이 없으면 "더 줄일 수 없었습니다"
6. 받기: 한 장이면 "다운로드", 여러 장이면 "모두 받기 (ZIP, n장)"

### 단계별 값 (`LEVEL_OPTIONS`)

| 단계            | JPG·WebP 화질 | PNG 색 수               |
| --------------- | ------------- | ----------------------- |
| light (조금)    | 0.85          | 0 (줄이지 않음, 무손실) |
| balanced (보통) | 0.75          | 256                     |
| strong (많이)   | 0.6           | 128                     |

### 결정과 이유

- 원본보다 커지면 원본을 그대로 둔다. 이미 작게 저장된 사진을 다시 저장하면 오히려 커질 수 있어서다
- ZIP에는 원본 그대로 둔 것도 넣어 "고른 이미지가 모두 들어 있게" 한다
- 결과는 설정 문자열(`level:format`)과 함께 둔다. 설정을 바꾸면 다시 압축해야 받을 수 있다
- PNG는 화질 대신 색 수로 줄인다 (UPNG). 화면 캡처는 이것이 가장 많이 줄어든다
- 목록 화면은 처음 이 도구 안에 있었는데, 크기 조절을 만들며 공통 화면으로 뺐다 (`c3b5205`)

### 주의할 점

- 뺀 이미지의 결과는 `onremove`에서 지운다 (리뷰 지적 #36, `a616482`)
- `item.type!`을 쓰므로 `anyFormat`을 켜면 안 된다 (형식을 모르는 이미지가 들어온다)
- 버튼 이름("압축하기", "모두 받기")을 바꾸면 `content.ts` 사용법과 가이드 글도 맞춘다

## 3. 구현 체크리스트

- [x] 폴더(`meta.ts`·`content.ts`·`Frame.astro`·`App.svelte`·`messages.ts`)와 레지스트리 등록 (`556bb40`)
- [x] 처리(공통 워커 풀)와 화면, 단계 3개·WebP 바꾸기
- [x] 원본보다 크면 원본 유지, 실패 이유 표시(WebP 저장 불가·못 여는 이미지)
- [x] 한·영 문구, 사용법·FAQ, 가이드 글
- [x] E2E (로컬 처리 약속 `expectLocalOnly` 포함)
- [x] `status: 'live'`
- [ ] 처리 중에 그만두기 — 없음. 처리하는 동안에는 이미지를 더하거나 뺄 수 없다

## 4. 검증

### 자동 테스트

`tests/e2e/image-compress.spec.ts` (받은 파일을 브라우저로 다시 열어 크기·형식·투명을 본다)

- 사진 한 장을 같은 크기(1200×900)의 더 작은 JPG로 줄인다 (절반 미만), 이름 `photo_압축.jpg`, 로컬 처리 확인
- 여러 장은 `이미지_압축.zip` 하나로 받고, PNG는 투명(왼쪽 위 alpha 0)을 지킨 채 줄어든다
- "WebP로 바꾸기"를 고르면 `photo_압축.webp`(WebP)로 저장한다
- EXIF 방향이 붙은 `rotated.jpg`(400×300 화소)를 300×400으로 바로 세워 저장한다
- 더 줄지 않는 `small.jpg`는 원본 그대로 두고, 깨진 `broken.png`는 "열 수 없는 이미지"로 알리며 다운로드 버튼이 없다

### 직접 확인

- 확인 기록 없음 (커밋·PR에 남은 것이 없다)

### 히스토리

- [history.md](./history.md): PR·커밋·리뷰 지적과 처리
