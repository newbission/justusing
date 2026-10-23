# 이미지를 PDF로 (`pdf/from-image`)

쓴 날 2026-10-16 · 고친 날 2026-10-23

- 주소: `/pdf/from-image/` (영어 `/en/pdf/from-image/`)
- 상태: live (2026-10-15 배포, PR #29)
- 관련 문서: [히스토리](./history.md), [PDF 공통](../../foundations/pdf-common/README.md),
  [이미지 공통](../../foundations/image-common/README.md), [격리 frame](../../foundations/frame-isolation/README.md),
  짝 도구 [PDF를 이미지로](../pdf-to-image/README.md)
- 가이드: 없음

## 1. 어떤 기능인지

- 사진·스캔 이미지 여러 장을 PDF 하나로 묶는다. 이미지 한 장이 한 쪽이 된다.
- 입력: 이미지 여러 장 (`accept="image/*"`). JPG·PNG와 WebP처럼 브라우저가 여는 형식은 모두.
  HEIC(아이폰 사진)도 받는다 (2026-10-23). 브라우저가 못 읽는 HEIC는 libheif로 연다 ([HEIC 변환](../image-heic-to-jpg/README.md)): 목록은 줄인 JPG(`readForDisplay`), 만들 때 `imagesToPdf`가 원래 크기 JPG(화질 0.92)로 바꿔 워커에 넘긴다
  "이미지 추가"로 더 넣을 수 있다
- 고르는 것
  - 순서: 줄 끌기 또는 ↑ ↓ 버튼, × 버튼으로 빼기 (목록 모양·순서 바꾸기는 `pdf/merge`와 같다)
  - 쪽 크기: "A4" / "Letter" / "이미지에 맞춤"(휴대폰 "맞춤"). 영어 화면은 Letter, 그 밖은 A4가 기본
  - 여백: "여백 없음" / "여백 있음"(36pt, 약 12mm)
- 출력: 목록 맨 위 이미지 이름을 딴 `사진이름.pdf`
- 할 수 있는 것 / 한계 (FAQ와 같음)
  - 휴대폰 사진의 EXIF 방향을 읽어 화면에 보이는 방향 그대로 넣는다
  - JPG·PNG는 다시 압축하지 않고 원본 그대로 넣는다. 방향을 바로잡아야 하는 사진과 그 밖의 형식만 다시 저장한다
  - A4·Letter: 비율 그대로 가운데에 맞추고, 가로로 긴 이미지는 종이도 가로로. 종이보다 작은 이미지는 키우지 않는다
  - "이미지에 맞춤": 쪽 크기 = 이미지 크기 (화소를 96 DPI로 보고 pt로 바꾼다)
  - 열 수 없는 이미지는 목록에 "열 수 없는 이미지입니다. 빼고 만듭니다."로 표시하고 PDF에서 뺀다

## 2. 어떻게 만드는지

### 파일

| 파일                                   | 역할                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/tools/pdf/from-image/meta.ts`     | 이름·설명·아이콘, 묶음 `convert`, 관련 도구(to-image, merge)                                     |
| `src/tools/pdf/from-image/content.ts`  | 사용법·FAQ (한·영)                                                                               |
| `src/tools/pdf/from-image/messages.ts` | 화면 문구                                                                                        |
| `src/tools/pdf/from-image/Frame.astro` | 격리 frame 페이지                                                                                |
| `src/tools/pdf/from-image/App.svelte`  | 화면: `FileDrop`, 목록(끌기·키보드), 쪽 크기·여백, `ActionBar`                                   |
| `src/lib/image/prepare.ts`             | `readImageInfo()`(바로 세운 크기), `jpegOrientation()`(EXIF 방향), `toEmbeddable()`(넣을 바이트) |
| `src/lib/pdf/images-to-pdf.ts`         | `imagesToPdf()`: 워커에 일을 맡기고 진행을 받는다                                                |
| `src/lib/pdf/images-to-pdf.worker.ts`  | pdf-lib로 쪽을 만들고 이미지를 넣는다                                                            |

### 처리 흐름

1. 파일 고르기·끌어 놓기(`onFrameFiles`) → `add()`: `image/*` 또는 확장자(jpg·png·webp·gif·bmp·avif)만 받는다
2. 이미지마다 `load()`: `readImageInfo()`로 크기를 읽고 썸네일 Blob URL을 만든다. 실패하면 `error`
3. "PDF 만들기" → `canUse('pdf/from-image')` → 쪽 크기·여백을 지역 변수로 고정
4. `imagesToPdf({ images: File[], size, margin })`: File을 그대로 워커에 넘긴다 (복사 없음)
5. 워커에서 이미지마다 `toEmbeddable()`
   - JPG이고 방향 값이 1 → 원본 바이트 그대로
   - JPG이고 방향이 있음 → `createImageBitmap(imageOrientation: 'from-image')`로 세워 `OffscreenCanvas`에서 JPG(0.92, 흰 바탕)로 다시 저장
   - PNG → 원본 그대로
   - 그 밖 → PNG로 다시 저장
6. `embedJpg`/`embedPng` → 쪽 추가 → `drawImage`(가운데, 비율 유지, 키우지 않음) → 진행 알림 → `save()`
7. "다운로드" → `downloadFile()`

### 결정과 이유

- **원본 그대로 넣기**: pdf-lib가 JPG·PNG는 바로 넣을 수 있어 화질 손실이 없다. 다른 형식만 PNG로 바꾼다.
- **EXIF 방향만 직접 읽는다**: 휴대폰 사진은 화소가 누워 있고 '돌려 보라'는 표시만 있어, 그대로 넣으면 PDF에서 눕는다.
  `jpegOrientation()`이 APP1 'Exif'의 첫 IFD에서 0x0112 태그만 찾는다.
- **다시 저장·PDF 만들기를 모두 워커에서**: 큰 휴대폰 사진을 화면 canvas에서 다시 저장하면 화면이 멈췄다 (Codex 지적).
  워커가 File을 직접 읽어 메모리도 두 배로 들지 않는다. 같은 `toEmbeddable()`을 이미지 넣기·서명(`src/lib/image/embed.ts`)도 쓴다.
- **결과 서명에 읽는 중인 이미지도 넣는다**: 이미지를 더하자마자 이전 다운로드가 사라져야 한다. 안 그러면 새 이미지가 빠진 PDF를 받았다.
- **읽는 동안 뺀 이미지는 썸네일 주소를 만들지 않는다**: 해제할 곳이 없어 메모리에 남는다.

### 주의할 점

- 실행 막대(`ActionBar`)는 목록 위에 둔다 (모바일 하단 광고와 멀게).
- 끌어서 순서 바꾸기의 `dragOver`는 `dragId`가 있을 때만 받는다. 파일 끌기는 frame 전체(`src/frame/drop.ts`)가 받는다.
- 줄을 옮긴 뒤 포커스를 같은 버튼에 다시 맞춘다 (키보드 조작).
- `toEmbeddable()`은 워커 전용이다(`OffscreenCanvas`). 화면에서 부르지 않는다.

## 3. 구현 체크리스트

- [x] 폴더와 레지스트리 등록
- [x] 여러 장 넣기·추가·빼기, 끌기·↑↓로 순서 바꾸기
- [x] A4·Letter·이미지에 맞춤, 여백 없음·있음, 가로 이미지는 가로 종이
- [x] JPG·PNG 원본 그대로, EXIF 방향 바로 세우기, 그 밖 형식 PNG로
- [x] 열 수 없는 이미지 표시하고 빼기
- [x] 다시 저장·PDF 만들기를 워커에서, File을 복사 없이 넘기기
- [x] 시작할 때 쪽 크기·여백 고정, 목록이 바뀌면 결과 숨기기
- [x] 한·영 문구, 사용법·FAQ
- [x] E2E (로컬 처리 약속 포함)
- [x] 데스크톱(1280)·휴대폰(390) 화면 캡처 확인 (PR #29)
- [x] `status: 'live'`
- [ ] 가이드 글 없음
- [ ] 진행 중에 목록을 바꿔도 만들기를 그만두지 않는다 (결과는 서명이 달라 숨겨지지만 워커는 끝까지 돈다)

## 4. 검증

### 자동 테스트

`tests/e2e/pdf-from-image.spec.ts`

- `wide.png`·`tall.jpg` → `wide.pdf`, 쪽 크기 `[841×595]`(가로 A4), `[595×841]`
- `tall.jpg 위로` 버튼으로 순서를 바꾸면 `tall.pdf`, 쪽 순서도 바뀜
- `rotated.jpg`(화소 400×300, EXIF로 세우면 300×400): 목록에 300×400, "이미지에 맞춤"이면 쪽 225×300pt,
  PDF 안 이미지 자체가 `/Width 300 /Height 400`. "여백 있음"으로 바꾸면 297×372
- `broken.png`는 표시되고 버튼이 꺼짐 → `tall.jpg`를 추가하면 그것만 넣어 `tall.pdf`
- 만드는 동안 요청이 기기 밖으로 나가지 않음 (`expectLocalOnly`)

### 직접 확인

- 2026-10-14 (PR #29): 데스크톱(1280)·휴대폰(390) 화면 캡처로 배치 확인

### 히스토리

- [history.md](./history.md): PR·커밋·리뷰 지적과 처리
