# 사진 위치 정보 지우기 (`image/remove-location`)

쓴 날 2026-10-20 · 고친 날 2026-10-20

- 주소: `/image/remove-location/` (영어 `/en/image/remove-location/`)
- 상태: PR 진행 중 (2026-10-20)
- 관련 문서: [히스토리](./history.md), [이미지 공통](../../foundations/image-common/README.md),
  [PDF 문서 정보](../pdf-metadata/README.md)(PDF 안 JPEG의 정보 지우기를 같이 쓴다)

## 1. 어떤 기능인지

- 사진을 보내거나 올리기 전에 촬영 위치(GPS)와 찍은 날짜·기기 같은 정보를 지운다
- 입력: JPG·PNG·WebP 여러 장. 넣으면 목록에 사진마다 위치(위도·경도)·찍은 날짜·기기를 보여 준다
- 방식 두 가지
  - **모든 정보 지우기**(기본): 그림을 그리는 데 필요한 것(색 프로필·밀도·Adobe 색 변환, PNG의 감마·색 공간 등)만 남기고
    EXIF·XMP·IPTC·설명 글·고친 시각을 모두 뺀다. 사진이 눕지 않게 방향(Orientation) 한 칸만 새로 적는다
  - **위치만 지우기**: EXIF의 GPS 칸을 비우고, EXIF와 그림을 그리는 데 필요한 조각 말고는 모두 뺀다(XMP·IPTC·설명 글·알 수 없는 조각).
    찍은 날짜·기기 등 나머지 EXIF는 남긴다
- 출력: 한 장은 `<이름>_정보삭제.<원래 확장자>`(위치만: `_위치삭제`), 여러 장은 `사진_정보삭제.zip`.
  지울 것이 없던 사진은 원본 그대로 ZIP에 넣는다
- **다시 압축하지 않는다**: 정보 조각만 빼고 다시 잇는다. 그림 자료는 한 바이트도 바뀌지 않는다
- 하지 않는 것·한계
  - HEIC는 받지 않는다 (아이폰 Safari는 사진 보관함에서 고르면 보통 JPG로 바꿔 넘긴다). HEIC 도구 때 다시 본다
  - JPEG 그림 끝(EOI) 뒤에 덧붙은 자료(움직이는 사진의 영상, MPF의 다른 그림)는 두 방식 모두 뺀다. 거기에도 촬영 정보가 있을 수 있다
  - 제조사 메이커노트(MakerNote) 안의 내용은 '위치만 지우기'에서 남는다. 위치를 넣는 곳은 GPS 칸이 표준이다
  - 사진에 찍힌 것(창밖 풍경·주소)은 지우지 못한다 (가이드에 밝힘)

## 2. 어떻게 만드는지

### 파일

| 파일                                          | 역할                                                                                        |
| --------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/tools/image/remove-location/meta.ts`     | 이름·설명·아이콘(위치 핀에 빗금)·관련 도구, 흐름 그림 `location` → `photo`                  |
| `src/tools/image/remove-location/content.ts`  | 쓰임새·사용법·FAQ (한·영)                                                                   |
| `src/tools/image/remove-location/messages.ts` | 화면 문구 (한·영)                                                                           |
| `src/tools/image/remove-location/App.svelte`  | `ImageBatchTool` 위의 화면: 방식 고르기, 줄마다 정보·결과, 받기                             |
| `src/lib/image/photo-metadata.ts`             | `readPhotoInfo()`·`cleanPhoto()`: JPG·PNG·WebP의 정보 조각을 읽고 고친다 (EXIF는 직접 읽음) |
| `src/lib/image/metadata.ts` + `.worker.ts`    | `readMetadata()`·`removeMetadata()`: 워커에서 읽고 지운 뒤 결과를 다시 읽어 함께 넘긴다     |
| `src/lib/image/jpeg-metadata.ts`              | `rewriteJpeg()`: JPEG 정보 조각마다 두기·빼기·바꾸기. `stripJpegMetadata()`도 이 위에 있다  |
| `tests/e2e/image-remove-location.spec.ts`     | E2E                                                                                         |
| `src/content/guides/*/photo-location.md`      | 가이드 글 (그림: 견본을 두 방식으로 지운 결과의 정보 표)                                    |

### 처리 흐름

1. 사진을 넣으면 `ImageBatch`가 크기·썸네일을 읽는다 (읽지 못하면 '열 수 없는 사진')
2. 읽힌 사진마다 `readMetadata()` → 워커가 파일 전체를 읽어 `readPhotoInfo()`. 목록 줄에 `위치 37.5663, 126.9779 · 날짜 · 기기`
3. "정보 지우기" → 사진마다 차례로 `removeMetadata(file, mode)`
   - 워커: `cleanPhoto()` → 지울 것이 없으면 같은 배열(→ `kept`), 있으면 새 배열
   - 워커가 결과를 다시 `readPhotoInfo()`로 읽어 넘긴다. 화면은 위치가 남았거나(두 방식) 날짜·기기가 남았으면('모두') 실패로 둔다
4. 결과는 방식(`mode`)과 함께 저장한다. 방식을 바꾸면 이전 결과를 쓰지 않는다 (이미지 공통의 `settings` 방식)

### 형식별로 하는 일

- **JPEG**: `rewriteJpeg()`가 APP0~15·COM 조각마다 묻는다
  - 모두: `stripJpegMetadata()`(허용 목록: JFIF·ICC·Adobe) 뒤, 방향이 1이 아니면 방향만 든 APP1 Exif를 JFIF 뒤에 넣는다
  - 위치만: 허용 목록. JFIF·ICC·Adobe는 두고, APP1 Exif는 복사본의 GPS 칸을 비워 바꿔 넣고, 나머지(XMP·IPTC·MPF·COM·제조사 조각)는 뺀다
- **PNG**: 조각(길이·종류·자료·CRC)을 IEND까지 읽는다. IEND 뒤 자료는 뺀다
  - 모두: `eXIf`·`tEXt`·`zTXt`·`iTXt`·`tIME`을 빼고, 방향이 1이 아니면 첫 IDAT 앞에 방향만 든 `eXIf`(CRC 새로 계산)
  - 위치만: `eXIf`의 GPS를 비우고 CRC를 다시 계산, `tIME`은 남긴다. 글 조각은 모두 뺀다(XMP·`Raw profile type iptc` 같은 프로필을 담는다)
  - 두 방식 모두 그림용 보조 조각(투명·색·감마·밀도·HDR·APNG)과 필수 조각(첫 글자 대문자)만 남기고, 알 수 없는 보조 조각은 뺀다
- **WebP**: RIFF 조각을 읽는다. `EXIF`·`XMP `를 빼거나 고치고, VP8X 머리의 표시 비트(EXIF 0x08, XMP 0x04)와 RIFF 크기를 맞춘다.
  WebP EXIF 앞에 `Exif\0\0`을 붙인 프로그램도 있어 둘 다 읽는다

### GPS 칸 비우기 (`clearGps`)

- IFD0의 GPS 포인터(0x8825)가 가리키는 칸에서, 4바이트보다 큰 값(위도·경도 유리수 등)이 있는 곳을 0으로 덮고,
  항목 수·항목·다음 칸 위치를 0으로 만든다
- 칸을 지우고 뒤를 당기지 않는 이유: EXIF 안의 다른 값들은 TIFF 머리에서 잰 위치로 서로를 가리킨다. 길이를 바꾸면
  모든 위치를 다시 계산해야 해서, 같은 길이로 덮어 다른 값의 자리를 그대로 둔다. GPS 포인터는 빈 칸(항목 0개)을 가리키게 남는다

### 결정과 이유

- **다시 저장하지 않는다**: 이미지 압축처럼 다시 그려 저장하면 정보는 사라지지만 JPG 화질이 떨어지고 용량이 바뀐다.
  이 도구를 찾는 사람은 사진은 그대로 두고 정보만 지우길 바란다
- **위치만 지우기도 허용 목록**: 위치는 XMP·IPTC뿐 아니라 설명 글, 프로필 글 조각, 제조사 조각 등 어디에든 적힐 수 있다.
  아는 조각만 빼는 방식(거부 목록)은 Codex 리뷰에서 PNG IPTC 프로필이 남는 것이 드러나 남길 것만 정하는 방식으로 바꿨다 (2026-10-20)
- **'모두'가 기본**: 남에게 보내는 사진에는 위치 말고도 기기 일련번호·편집 기록 같은 정보가 있을 수 있다. 날짜순 정리가 필요한 사람만 '위치만'을 고른다
- **방향은 남긴다**: 휴대폰 사진은 화소는 가로로 두고 EXIF 방향으로 세우는 경우가 많아, 지우면 사진이 눕는다
- **덧붙은 자료는 두 방식 모두 뺀다**: 움직이는 사진의 영상(MP4)에도 위치가 들어갈 수 있다. 그 안을 고치는 대신 통째로 뺀다
- **지운 뒤 다시 읽어 확인한다**: 파일 구조가 예상과 다르면 지우지 못한 채 '완료'로 보일 수 있어, 결과를 같은 읽기 코드로 다시 확인한다
- **목록에 정보를 먼저 보여 준다**: 내 사진에 무엇이 남아 있는지 보는 것만으로도 쓰임새가 있고, 지운 뒤 차이를 알 수 있다

### 주의할 점

- `rewriteJpeg()`는 아무것도 바뀌지 않으면 받은 배열을 그대로 돌려준다. 읽기(`readPhotoInfo`)는 이것으로 '덧붙은 자료가 있는지'를 안다
- 워커는 결과 배열의 `buffer`를 transfer한다. `cleanPhoto()`가 새로 만든 배열(`concat`)만 넘기고, 받은 배열과 같으면 넘기지 않는다
- `stripJpegMetadata()`는 PDF 문서 정보 지우기(`modify.worker.ts`)와 PDF에 넣을 사진 준비(`prepare.ts`: 이미지를 PDF로·이미지 넣기·서명)도 쓴다. 고치면 그 도구 E2E도 돌린다
- PNG 조각을 바꾸면 CRC를 꼭 다시 계산한다 (Pillow·브라우저가 CRC가 틀린 PNG를 거부할 수 있다)

## 3. 구현 체크리스트

- [x] 폴더(`meta.ts`·`content.ts`·`Frame.astro`·`App.svelte`·`messages.ts`)와 레지스트리 등록
- [x] 처리(워커)와 화면
- [x] 한·영 문구, 사용법·FAQ, 가이드 글(그림 1장)
- [x] 견본(`예시-위치사진.jpg`, 공공장소 좌표·지어낸 기기 이름)과 '예시 파일로 해 보기'
- [x] E2E (로컬 처리 약속 `expectLocalOnly` 포함)
- [x] `npm run build` 후 실제 배포 방식(wrangler)으로 확인, 390×844 휴대폰 화면 확인
- [x] `status: 'live'`, 이 문서와 `CLAUDE.md` 진행 상황 갱신
- [ ] HEIC (HEIC 도구를 만들 때)

## 4. 검증

### 자동 테스트

- `tests/e2e/image-remove-location.spec.ts`
  - 모두 지우기: 목록의 위치·날짜·기기 표시, 결과에 위치·날짜·기기·XMP·덧붙은 자료가 없음, 압축 자료가 원본과 같음,
    방향이 남아 세로로 열림, 로컬 처리
  - 위치만 지우기: JPG·PNG·WebP 세 장을 ZIP으로, 셋 다 위치·설명 글이 없고 날짜·기기는 남음, 브라우저가 열 수 있음
  - 지울 정보가 없는 사진: 원본 그대로 두고 알림, 다운로드 버튼 없음
  - 방식을 바꾸면 이전 결과를 버림
- 시험 사진은 `tests/fixtures/make_image_fixtures.py`가 만든다 (`located.jpg`·`located.png`·`located.webp`)

### 직접 확인

- 2026-10-20 크롬(빌드 결과): 1280·390 폭 화면, 견본 '예시 파일로 해 보기'·따라 하기
- 2026-10-20 결과 파일을 Pillow로 다시 열어 GPS 칸이 비고 그림이 그대로 열리는지 확인 (JPG·PNG·WebP)

### 히스토리

- [history.md](./history.md): PR·커밋·리뷰 지적과 처리
