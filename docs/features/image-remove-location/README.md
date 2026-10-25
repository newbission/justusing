# 사진 위치 정보 지우기 (`image/remove-location`)

쓴 날 2026-10-20 · 고친 날 2026-10-24

- 주소: `/image/remove-location/` (영어 `/en/image/remove-location/`)
- 상태: live (2026-10-20 배포, PR #116·#117)
- 관련 문서: [히스토리](./history.md), [이미지 공통](../../foundations/image-common/README.md),
  [PDF 문서 정보](../pdf-metadata/README.md)(PDF 안 JPEG의 정보 지우기를 같이 쓴다)

## 1. 어떤 기능인지

- 사진을 보내거나 올리기 전에 촬영 위치(GPS)와 찍은 날짜·기기 같은 정보를 지운다
- 입력: JPG·PNG·WebP·HEIC 여러 장 (HEIC는 2026-10-24). 넣으면 목록에 사진마다 위치(위도·경도)·찍은 날짜·기기를 보여 준다
- 방식 두 가지
  - **모든 정보 지우기**(기본): 그림을 그리는 데 필요한 것(색 프로필·밀도·Adobe 색 변환, PNG의 감마·색 공간 등)만 남기고
    EXIF·XMP·IPTC·설명 글·고친 시각을 모두 뺀다. 사진이 눕지 않게 방향(Orientation) 한 칸만 새로 적는다
  - **위치만 지우기**: EXIF는 위치가 적힐 수 없는 칸(날짜·기기·촬영 설정)만 골라 새로 만들고, 그림을 그리는 데 필요한 조각 말고는 모두 뺀다(XMP·IPTC·설명 글·알 수 없는 조각).
    찍은 날짜·기기 등 나머지 EXIF는 남긴다
- 출력: 한 장은 `<이름>_정보삭제.<원래 확장자>`(위치만: `_위치삭제`), 여러 장은 `사진_정보삭제.zip`.
  지울 것이 없던 사진은 원본 그대로 ZIP에 넣는다
- **다시 압축하지 않는다**: 정보 조각만 빼고 다시 잇는다. 그림 자료는 한 바이트도 바뀌지 않는다. HEIC는 정보 칸을 그 자리에서 비워 파일 크기까지 같다
- 하지 않는 것·한계
  - HEIC에 허용 목록 밖의 상자·속성·항목·참조(동영상 트랙 `moov`, 확장 속성 `uuid`, 글 속성 `udes`, 압축한 XMP, 사용자 자료 SEI 등)가 하나라도 있으면
    고치지 않고, 목록에 "이 HEIC는 위치 정보를 안전하게 지울 수 없어 고치지 않습니다"를 지우기 전부터 보인다 (`PhotoInfo.unsafe`)
  - HEIC의 HDR 밝기 그림(게인 맵)은 그림이라 남지만, 그 설정이 적힌 XMP·제조사 메모가 비워져 HDR로 보이지 않을 수 있다 (FAQ에 밝힘)
  - JPEG 그림 끝(EOI) 뒤에 덧붙은 자료(움직이는 사진의 영상, MPF의 다른 그림)는 두 방식 모두 뺀다. 거기에도 촬영 정보가 있을 수 있다
    - 안드로이드 Ultra HDR의 밝기 정보(게인 맵)도 여기 붙어 있어, HDR 사진은 일반(SDR) 사진이 된다. 그림이나 영상이 붙은 사진
      (`appended`: 뒤 자료에 `FF D8 FF`나 `ftyp`가 있음)이 있으면 지우기 전에 설정 아래에 알린다 (Codex #116)
    - 남기지 않은 이유: 게인 맵을 남기려면 MPF의 위치 값을 다시 계산하고 HDR용 XMP를 살려야 하는데, XMP에는 위치도 들어갈 수 있어
      지우려는 것과 부딪힌다. 지금은 위치를 확실히 지우는 쪽을 고르고 미리 알린다
  - 사진에 찍힌 것(창밖 풍경·주소)은 지우지 못한다 (가이드에 밝힘)

## 2. 어떻게 만드는지

### 파일

| 파일                                          | 역할                                                                                             |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/tools/image/remove-location/meta.ts`     | 이름·설명·아이콘(위치 핀에 빗금)·관련 도구, 흐름 그림 `location` → `photo`                       |
| `src/tools/image/remove-location/content.ts`  | 쓰임새·사용법·FAQ (한·영)                                                                        |
| `src/tools/image/remove-location/messages.ts` | 화면 문구 (한·영)                                                                                |
| `src/tools/image/remove-location/App.svelte`  | `ImageBatchTool` 위의 화면: 방식 고르기, 줄마다 정보·결과, 받기                                  |
| `src/lib/image/photo-metadata.ts`             | `readPhotoInfo()`·`cleanPhoto()`: JPG·PNG·WebP·HEIC의 정보 조각을 읽고 고친다 (EXIF는 직접 읽음) |
| `src/lib/image/heif-metadata.ts`              | HEIC의 EXIF·XMP 항목 자리(`iinf`·`iloc`·`idat`) 찾기, 같은 길이로 덮어쓰기, 모르는 항목 알리기   |
| `src/lib/image/metadata.ts` + `.worker.ts`    | `readMetadata()`·`removeMetadata()`: 워커에서 읽고 지운 뒤 결과를 다시 읽어 함께 넘긴다          |
| `src/lib/image/jpeg-metadata.ts`              | `rewriteJpeg()`: JPEG 정보 조각마다 두기·빼기·바꾸기. `stripJpegMetadata()`도 이 위에 있다       |
| `tests/e2e/image-remove-location.spec.ts`     | E2E                                                                                              |
| `src/content/guides/*/photo-location.md`      | 가이드 글 (그림: 견본을 두 방식으로 지운 결과의 정보 표)                                         |

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
  - 위치만: 허용 목록. JFIF·ICC·Adobe는 두고, APP1 Exif는 `safeExif`로 새로 만든 것으로 바꿔 넣고, 나머지(XMP·IPTC·MPF·COM·제조사 조각)는 뺀다
- **PNG**: 조각(길이·종류·자료·CRC)을 IEND까지 읽는다. IEND 뒤 자료는 뺀다
  - 모두: `eXIf`·`tEXt`·`zTXt`·`iTXt`·`tIME`을 빼고, 방향이 1이 아니면 첫 IDAT 앞에 방향만 든 `eXIf`(CRC 새로 계산)
  - 위치만: `eXIf`를 `safeExif`로 새로 만들고 CRC를 다시 계산, `tIME`은 남긴다. 글 조각은 모두 뺀다(XMP·`Raw profile type iptc` 같은 프로필을 담는다)
  - 두 방식 모두 그림용 보조 조각(투명·색·감마·밀도·HDR·APNG)과 필수 조각(첫 글자 대문자)만 남기고, 알 수 없는 보조 조각은 뺀다
- **HEIC** (2026-10-24): 상자(ISOBMFF)를 읽어 `meta`의 항목 목록(`iinf`)과 위치표(`iloc`, 파일 안 또는 `idat` 안)로 EXIF(`Exif`)·XMP(`mime`
  `application/rdf+xml`) 항목의 바이트 자리를 찾는다 (`heif-metadata.ts`). 항목 길이를 바꾸면 그 뒤 그림 조각의 위치를 모두 고쳐야 해서
  **길이를 그대로 두고 그 자리에서 덮어쓴다**
  - EXIF: 새 TIFF(위치만: `safeExif`, 모두: 방향만 또는 빈 TIFF)를 쓰고 나머지는 0으로 지운다 (예전 GPS 바이트가 파일에 남지 않게).
    앞 4바이트(TIFF까지 건너뛸 수) 뒤에는 `Exif\0\0` 머리만 남기고, 그 밖의 앞 바이트(자유 글이 있을 수 있다, Codex #146)는 비우고
    TIFF를 앞으로 당겨 건너뛸 수를 고친다. 새 TIFF가 들어가지 않으면 실패. 읽지 못하는 EXIF는 통째로 0
  - XMP: 두 방식 모두 빈 XMP(`<x:xmpmeta xmlns:x="adobe:ns:meta/"/>`)와 공백으로 덮는다 (JPG에서 XMP 조각을 빼는 것과 같다)
  - 허용 목록 (모든 단계, Codex #146에서 같은 종류 지적이 세 번 나와 한 번에 바꿈). 밖의 것이 하나라도 있으면 `unknown`이라 고치지 않는다
    - 맨 바깥 상자 `ftyp`·`meta`·`mdat`·`free`·`skip`, `meta` 안 `hdlr`·`dinf`·`pitm`·`iinf`·`iloc`·`iref`·`iprp`·`idat`·`grpl`, `iprp` 안 `ipco`·`ipma`
    - 그림 속성(ipco) `hvcC`·`ispe`·`colr`·`pixi`·`irot`·`imir`·`clap`·`pasp`·`auxC`·`clli`·`mdcv`·`cclv`·`amve`·`lsel`·`rloc`.
      색 프로필(ICC)은 JPG에서 남기는 것과 같은 기준으로 남긴다. `auxC`는 종류 이름이 `urn:`(영문·숫자·`:`)이고 덧붙임에 글이 없어야 한다
    - 항목 종류(iinf) `hvc1`·`grid`·`iden`·`iovl`·`tmap`·`jpeg`·`Exif`·`mime`(XMP: 종류 이름이 정확히 `application/rdf+xml`이고 압축하지 않은 것). 보호(암호화)된 항목과
      항목 정보(infe)의 정해진 칸 뒤에 바이트가 더 있는 것은 받지 않는다
    - 항목 참조(iref) `thmb`·`auxl`·`dimg`·`cdsc`·`base`·`prem`, 묶음(grpl) `altr`·`ster`, 자료 참조(dref)는 '이 파일 안'(`url ` 깃발 1)만
    - HEVC: `hvcC`와 `hvc1` 그림 자료의 NAL은 0~40번만, SEI는 사용자 자료(4·5번, 인코더 이름 같은 글)가 없어야 한다
  - JPEG 그림 항목: 안의 정보 조각을 `stripJpegMetadata`와 같은 기준(JFIF·ICC·Adobe만 남김)으로, 길이를 두고 내용만 0으로 비운다
    (`blankJpegMetadata`, 그림 끝 뒤 자료도 0). 위치만 지울 때도 날짜·기기까지 비운다(작은 그림이라 더 엄격하게). 읽지 못하면 고치지 않는다
  - 마지막 안전망: 압축한 그림 자료(HEVC·JPEG 항목) 밖에 `GPS`나 소수점 아래 네 자리 넘는 숫자(좌표)가 남았으면 위치가 있는 것으로 본다.
    지운 결과를 다시 읽을 때도 같으니 남으면 실패가 된다
  - 어느 항목도 쓰지 않는 바이트(`free`·`skip` 상자, `mdat`·`idat` 안에서 위치표가 가리키지 않는 틈, 마지막 상자 뒤 자료)는 0으로,
    자유 글인 항목 이름은 공백으로(0을 넣으면 뒤 글자의 시작이 바뀐다), `hdlr` 이름은 0으로 비운다. 예전 편집이 남긴 EXIF·XMP·위치 글이
    있을 수 있다 (Codex #146: free 상자의 GPS 글이 남음). 읽을 때도 이 자리의 XMP GPS 글을 위치로 본다
  - 그림을 풀지 않으므로 libheif가 필요 없다 (크롬에서 목록 썸네일을 그릴 때만 받는다)
- **WebP**: RIFF 조각을 읽는다. `EXIF`·`XMP `를 빼거나 고치고, VP8X 머리의 표시 비트(EXIF 0x08, XMP 0x04)와 RIFF 크기를 맞춘다.
  WebP EXIF 앞에 `Exif\0\0`을 붙인 프로그램도 있어 둘 다 읽는다

### 위치만 지울 때의 EXIF (`safeExif`)

- 위치가 적힐 수 없는 칸만 골라(허용 목록 `KEEP_IFD0`·`KEEP_EXIF`: 제조사·모델·방향·해상도·날짜, 노출·조리개·ISO·초점 거리·렌즈 등)
  EXIF를 새로 만든다(`writeTiff`, 바이트 순서는 원본 그대로). GPS 칸, 자유 글(설명 `ImageDescription`, 메모 `UserComment`,
  윈도 `XP*`), 제조사 메모(`MakerNote`), 썸네일(IFD1)은 옮기지 않는다
- 처음에는 GPS 칸만 0으로 덮었는데(같은 길이로 덮어 다른 값의 자리를 지킴), 자유 글에 적힌 주소가 남는다는 Codex 지적(#116)으로 바꿨다
- 읽지 못하는 EXIF는 통째로 뺀다. 새로 만든 EXIF가 원본과 바이트까지 같으면 원본 조각을 그대로 둔다

### 결정과 이유

- **다시 저장하지 않는다**: 이미지 압축처럼 다시 그려 저장하면 정보는 사라지지만 JPG 화질이 떨어지고 용량이 바뀐다.
  이 도구를 찾는 사람은 사진은 그대로 두고 정보만 지우길 바란다
- **위치만 지우기도 허용 목록**: 위치는 XMP·IPTC뿐 아니라 설명 글, 프로필 글 조각, 제조사 조각 등 어디에든 적힐 수 있다.
  아는 조각만 빼는 방식(거부 목록)은 Codex 리뷰에서 PNG IPTC 프로필이 남는 것이 드러나 남길 것만 정하는 방식으로 바꿨다 (2026-10-20)
- **'모두'가 기본**: 남에게 보내는 사진에는 위치 말고도 기기 일련번호·편집 기록 같은 정보가 있을 수 있다. 날짜순 정리가 필요한 사람만 '위치만'을 고른다
- **방향은 남긴다**: 휴대폰 사진은 화소는 가로로 두고 EXIF 방향으로 세우는 경우가 많아, 지우면 사진이 눕는다
- **덧붙은 자료는 두 방식 모두 뺀다**: 움직이는 사진의 영상(MP4)에도 위치가 들어갈 수 있다. 그 안을 고치는 대신 통째로 뺀다
- **HEIC는 JPG로 바꾸지 않고 그 자리에서 고친다** (2026-10-24): JPG로 바꾸면 위치는 확실히 빠지지만 '다시 저장하지 않는다'는 약속이 깨지고
  화질·용량이 바뀐다. 위치표 길이를 건드리지 않고 정보 항목 안만 덮으면 그림·구조는 그대로라 안전하다고 보았다. 대신 모르는 항목이
  있으면 고치지 않고(위치가 거기 있을 수 있다), 결과는 같은 읽기 코드로 다시 확인한다
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
- [x] HEIC (2026-10-24, EXIF·XMP 항목을 같은 길이로 그 자리에서 덮어쓰기)

## 4. 검증

### 자동 테스트

- `tests/e2e/image-remove-location.spec.ts`
  - 모두 지우기: 목록의 위치·날짜·기기 표시, 결과에 위치·날짜·기기·XMP·덧붙은 자료가 없음, 압축 자료가 원본과 같음,
    방향이 남아 세로로 열림, 로컬 처리
  - 위치만 지우기: JPG·PNG·WebP 세 장을 ZIP으로, 셋 다 위치·설명 글이 없고 날짜·기기는 남음, 브라우저가 열 수 있음
  - 지울 정보가 없는 사진: 원본 그대로 두고 알림, 다운로드 버튼 없음
  - EXIF가 머리 4바이트에서 끝난 사진: 그 조각만 빼고 지움, 그림은 그대로 열림
  - 방식을 바꾸면 이전 결과를 버림
  - HEIC(`located.heic`): 위치만 지우면 HEIC 그대로 날짜·기기가 남고 GPS·XMP·자유 글이 없으며, 모두 지우면 날짜·기기도 없다.
    두 방식 모두 크기가 같고 정보 항목 밖은 한 바이트도 바뀌지 않는다, 로컬 처리
  - HEIC 뒤에 GPS 글이 든 `free`·`skip` 상자와 덧붙은 자료를 붙여도 결과에 GPS·주소 글이 남지 않는다
  - `located-uuid.heic`(확장 속성 `uuid`에 위치 글): 지우기 전부터 '안전하게 지울 수 없음', 지우기는 실패, 다운로드 없음
  - `located-exif-prefix.heic`(EXIF의 TIFF 앞 자리에 주소 글): 주소 글이 남지 않고 남길 칸은 다시 읽힌다
  - `located-jpeg-item.heic`(`located.jpg`를 JPEG 항목으로): 크기가 같고 GPS·주소·설명 글·덧붙은 영상이 남지 않으며 안의 JPEG는 읽히고 정보가 없다
- 시험 사진은 `tests/fixtures/make_image_fixtures.py`가 만든다 (`located.jpg`·`located.png`·`located.webp`·`located.heic`·`located-uuid.heic`·`located-jpeg-item.heic`·`located-exif-prefix.heic`, 뒤의 셋은 `rebuild_heif`로 다시 쓴다)

### 직접 확인

- 2026-10-20 크롬(빌드 결과): 1280·390 폭 화면, 견본 '예시 파일로 해 보기'·따라 하기
- 2026-10-24 허용 목록으로 바꾼 뒤: 견본 HEIC 7개(공용 시험·사이트 견본), 아이폰 11 HEIC, 아이폰 사진 한 장(상자 종류만 봄: `hdlr,dinf,pitm,iinf,iref,iprp,idat,iloc`,
  속성 `colr,hvcC,ispe,irot,pixi`, 참조 `dimg,cdsc`)이 모두 허용 목록 안이라 두 방식 모두 고쳐지고, 결과의 대표 그림을 pillow-heif로 다시 연다
- 2026-10-24 HEIC: `located.heic`와 실제 아이폰 11 HEIC(공개 시험 파일), 아이폰 사진 한 장(구조만 봄: `ftyp,meta,mdat`, 항목 `hvc1`·`grid`·`Exif`·`mime`)에서
  두 방식 모두 고쳐지고 위치가 남지 않음, 결과를 pillow-heif로 다시 열어 그림이 열리고 EXIF는 남길 칸만, XMP는 비었는지 확인
- 2026-10-20 결과 파일을 Pillow로 다시 열어 GPS 칸이 비고 그림이 그대로 열리는지 확인 (JPG·PNG·WebP), EXIF 자유 글(설명·메모)이 빠지고 날짜·기기·렌즈·노출은 남는지 확인

### 히스토리

- [history.md](./history.md): PR·커밋·리뷰 지적과 처리
