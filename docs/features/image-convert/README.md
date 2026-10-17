# 이미지 형식 변환 (`image/convert`)

쓴 날 2026-10-16 · 고친 날 2026-10-16

- 주소: `/image/convert/` (영어 `/en/image/convert/`)
- 상태: live (PR #44, 2026-10-15 병합)
- 관련 문서: [히스토리](./history.md), [이미지 공통](../../foundations/image-common/README.md),
  [격리 frame](../../foundations/frame-isolation/README.md)
- 가이드 글: `src/content/guides/ko/convert-image.md` (영어판 `en/convert-image.md`)

## 1. 어떤 기능인지

- 이미지를 JPG·PNG·WebP로 바꾼다. 웹에서 저장한 WebP가 안 열릴 때, PNG를 JPG로 바꿀 때 쓴다
- 입력: 지금 브라우저가 열 수 있는 이미지 (JPG·PNG·WebP·GIF·BMP·AVIF, Safari의 HEIC 등), 여러 장
- 출력
  - 한 장: `<원래 이름>.<jpg|png|webp>` (예: `screen.jpg`)
  - 여러 장: `이미지_변환.zip` (영어 `converted-images.zip`). 성공한 것만 넣는다
  - 목록의 ↓ 버튼으로 한 장씩도 받는다
- 하지 않는 것·한계 (화면·FAQ와 같게)
  - JPG로 바꾸면 투명한 부분이 흰색이 된다 (투명을 남기려면 PNG·WebP)
  - 움직이는 GIF는 첫 장면만 바뀐다 (GIF를 넣으면 설정 안내에 "움직이는 GIF는 첫 장면만 바뀝니다.")
  - HEIC는 Safari에서만 된다. 크롬·엣지는 읽지 못해 "이 브라우저가 읽지 못하는 형식입니다. HEIC(아이폰 사진)는 Safari에서 열 수 있습니다."로 알린다
  - JPG·WebP는 화질 0.92로 저장한다. 손실 형식끼리 바꾸면 아주 조금씩 손실이 생긴다. PNG는 손실 없음
  - 브라우저가 WebP로 저장하지 못하면 알린다 ("다른 형식을 고르세요")
  - 크기는 그대로다. EXIF 방향은 적용하고, 위치 같은 EXIF는 남지 않는다

## 2. 어떻게 만드는지

### 파일

| 파일                                  | 역할                                                                                                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/tools/image/convert/meta.ts`     | 이름·설명·아이콘, 묶음 `convert`, 관련 도구 `image/compress`·`image/resize`                                                                                         |
| `src/tools/image/convert/content.ts`  | 사용법 4단계·FAQ 5개 (한·영)                                                                                                                                        |
| `src/tools/image/convert/messages.ts` | 화면 문구, 형식별 도움말, `hint`·`unreadable`(목록 화면에 넘김)                                                                                                     |
| `src/tools/image/convert/Frame.astro` | `FrameLayout` 안에 `App.svelte`를 mount                                                                                                                             |
| `src/tools/image/convert/App.svelte`  | 형식 고르기·실행·받기                                                                                                                                               |
| 공통                                  | `ImageBatchTool`·`ImageBatch({ anyFormat: true })`·`processImage` ([이미지 공통](../../foundations/image-common/README.md)), `ActionBar`, `downloadFile`, `makeZip` |

### 처리 흐름

1. `new ImageBatch({ anyFormat: true })`: 파일 고르기 `accept`가 `image/*,.heic,.heif,.avif`가 되고,
   이름이 이미지 확장자(GIF·BMP·AVIF·HEIC·TIFF·ICO 등)인 것도 받는다
2. 목록 줄마다 `크기 · 원래 형식 → 바꿀 형식`을 보여 준다. 원래 형식은 확장자로 읽는다(`sourceLabel`, JPEG는 JPG로)
3. 브라우저가 읽지 못하면 그 줄은 `error`가 되고 `unreadable` 안내가 나온다. 나머지만 바꾼다
4. "변환하기" → `canUse('image/convert')` → 시작할 때 형식을 `target`으로 잡아 두고
   `processImage(file, { type: target, quality: 0.92, pngColors: 0 })`
5. 받기: 한 장이면 "다운로드", 여러 장이면 "모두 받기 (ZIP, n장)"

### 결정과 이유

- 처리는 압축·크기 조절과 같은 공통 워커를 쓴다. 디코딩은 브라우저(`createImageBitmap`)에 맡겨,
  브라우저가 읽는 형식이면 따로 라이브러리 없이 모두 받는다 (`9a307fc`)
- HEIC를 모든 브라우저에서 읽으려면 libheif가 필요한데, LGPL·HEVC 특허 문제로 사용자 결정을 기다린다 (CLAUDE.md 9단계).
  그래서 지금은 Safari를 안내한다
- 결과는 형식과 함께 둔다 (`outcomes[id].format`). 형식을 바꾸면 이전 결과는 쓰지 않는다
- 형식만 바꾸는 도구라 눈에 띄는 손실이 없게 화질을 0.92로 높게 둔다

### 주의할 점

- 결과 이름이 `<원래 이름>.<새 확장자>`라 같은 형식으로 바꾸면 원래 파일과 이름이 같다 (예: JPG → JPG)
- 원래 이름이 같고 확장자만 다른 두 파일(`a.png`, `a.webp`)을 같은 형식으로 바꾸면 이름이 겹친다.
  ZIP에서는 `makeZip()`이 뒤에 ` (2)`를 붙여 덮어쓰지 않는다. 한 장씩 받을 때는 브라우저가 이름을 정한다
- `makeZip()`은 받은 바이트를 워커로 넘겨(transfer) 비우므로 `outcome.bytes.slice()`로 복사본을 넘긴다
- 뺀 이미지의 결과는 `onremove`에서 지운다 (공통 규칙)
- 버튼 이름("변환하기", "모두 받기")을 바꾸면 `content.ts` 사용법과 가이드 글도 맞춘다

## 3. 구현 체크리스트

- [x] 폴더(`meta.ts`·`content.ts`·`Frame.astro`·`App.svelte`·`messages.ts`)와 레지스트리 등록 (`f5525b8`)
- [x] 공통 목록에 "모든 형식 받기"(`anyFormat`)와 안내 바꾸기(`hint`·`broken`) 추가
- [x] JPG·PNG·WebP로 바꾸기, 형식별 도움말, GIF 첫 장면 안내, 읽지 못하는 형식 안내
- [x] 한·영 문구, 사용법·FAQ, 가이드 글
- [x] E2E (로컬 처리 약속 `expectLocalOnly` 포함)
- [x] `status: 'live'` (`8c69d00`)
- [ ] HEIC를 모든 브라우저에서 (libheif — 사용자 결정 대기)

## 4. 검증

### 자동 테스트

`tests/e2e/image-convert.spec.ts`

- 투명한 `screen.png`를 JPG로 바꾸면 `screen.jpg`(800×600)가 되고, 투명했던 왼쪽 위가 흰색이다. 요청에 파일이 나가지 않는다
- `moving.gif`·`green.bmp`를 WebP로 바꿔 `이미지_변환.zip`으로 받는다. GIF는 첫 장면(빨강)만 남고, GIF 안내가 보인다
- 사진(`photo.jpg`)을 PNG로 바꾸면 크기(1200×900)가 그대로인 `photo.png`
- 읽지 못하는 `broken.png`는 안내하고 빼고, "이미지 1장을 JPG로 바꿉니다."가 된다

### 직접 확인

- 확인 기록 없음. Safari의 HEIC 읽기는 FAQ에 적혀 있지만, 커밋·PR에 확인 기록은 없다 (E2E는 크롬만 돈다)

### 히스토리

- [history.md](./history.md): PR·커밋·리뷰 지적과 처리
