# PDF 사진 꺼내기 (`pdf/extract-images`)

쓴 날 2026-10-16 · 고친 날 2026-10-16

- 주소: `/pdf/extract-images/` (영어 `/en/pdf/extract-images/`)
- 상태: PR #59 리뷰 중 (브랜치 `feat/pdf-extract-images`, 아직 dev에 병합 전)
- 관련 문서: [히스토리](./history.md), [PDF 공통](../../foundations/pdf-common/README.md),
  [격리 frame](../../foundations/frame-isolation/README.md), [가리기](../pdf-redact/README.md)(같은 토큰 나누기)

## 1. 어떤 기능인지

- PDF 안에 들어 있는 사진·그림 파일 자체를 꺼낸다. 쪽 전체를 찍는 "PDF를 이미지로"와 달리 원래 크기·화질 그대로다.
- 입력: PDF 한 개 (암호 PDF는 `SinglePdfTool`에서 암호를 받아 연다)
- 출력: 하나씩 `<원래이름>_p<쪽>_<번호>.<확장자>`, 모두 `<원래이름>_images.zip`
  - 번호는 꺼낸 사진만 차례로 센다 (못 꺼낸 것은 건너뜀). 쪽은 처음 나온 쪽
- 할 수 있는 것
  - 파일을 열면 바로 꺼내 미리보기와 함께 보여 준다 (JPG·PNG만 미리보기)
  - "아주 작은 그림 빼기" (짧은 변 50화소 미만, 기본 켬). 바꾸면 다시 꺼낸다
  - 같은 사진은 한 번만 꺼낸다. 다만 부른 쪽의 자원에 따라 색이 달라지면 따로 꺼낸다
- 형식별 결과 (FAQ와 같다)
  - JPG(DCT): 파일 안의 바이트 그대로. PDF가 정한 ICC 프로필은 JPG에 넣는다. 투명도가 붙으면 PNG로 합친다
  - Flate(+PNG 예측), 8비트 회색·RGB, 1·2·4·8비트 색 목록(+투명도): 화소를 풀어 PNG(무손실)
  - JPEG 2000: 원본 그대로 `.jp2`·`.jpx`·`.j2k` (브라우저에서 미리 볼 수 없음)
- **하지 않는 것·한계**
  - 흑백 팩스(CCITT·JBIG2), CMYK 화소, 16비트, 보정 색공간(CalRGB·CalGray·Lab) 등은 꺼내지 못한 수로 알린다
  - 쪽 내용에 바로 써 넣은 그림(BI … EI)은 꺼내지 않고 못 꺼낸 수에 넣는다 (작은 그림 기준 이상만)
  - 쪽에서 잘리거나 돌아간 모습이 아니라 파일 안의 원래 사진을 꺼낸다
  - PDF에서 보이는 색과 같게 낼 수 없으면 틀린 색으로 내지 않고 못 꺼낸 것으로 센다 (아래 "결정과 이유")

## 2. 어떻게 만드는지

### 파일

| 파일                                               | 역할                                                                          |
| -------------------------------------------------- | ----------------------------------------------------------------------------- |
| `src/tools/pdf/extract-images/meta.ts`             | 이름·설명·아이콘, 묶음 `view`, 관련 도구(PDF를 이미지로·글자 추출)            |
| `src/tools/pdf/extract-images/content.ts`          | 사용법·FAQ (한·영)                                                            |
| `src/tools/pdf/extract-images/messages.ts`         | 화면 문구 (한·영)                                                             |
| `src/tools/pdf/extract-images/App.svelte`          | 화면. `SinglePdfTool` 안에 목록·미리보기, ZIP은 `src/lib/zip.ts`              |
| `src/lib/pdf/extract-images.ts`                    | 화면 쪽 진입점 `extractImages()`. 워커를 띄우고 사진·진행을 하나씩 받는다     |
| `src/lib/pdf/extract-images.worker.ts`             | 사진 찾기(`collect`)와 형식별 꺼내기(`extract`), PNG·JPG 만들기               |
| `src/lib/pdf/image-pixels.ts`                      | Flate 풀기(`inflate`), PNG 예측 풀기(`unpredict`). 압축 도구 워커와 같이 쓴다 |
| `src/lib/pdf/content-tokens.ts`                    | 내용 스트림 토큰 나누기 (가리기와 같은 파일)                                  |
| `src/lib/pdf/recompress-image.worker.ts`           | 화소 풀기를 `image-pixels.ts`로 옮김 (동작 그대로)                            |
| `src/content/guides/{ko,en}/extract-images-pdf.md` | 가이드 글                                                                     |

### 처리 흐름

1. 파일 고르기 → `$effect`가 `canUse('pdf/extract-images')`를 확인한 뒤 `extractImages()`를 부른다
   (파일을 닫거나 바꾸면 늦게 온 결과는 버리고 미리보기 Blob URL을 돌려준다)
2. 워커가 pdf-lib로 열고 `collect()`로 **화면에 실제로 그리는 사진**만 모은다
   - 쪽 내용을 토큰으로 훑어 `/이름 Do`로 그리는 것만 따라간다 (자원 목록에만 있는 사진은 뺌)
   - 묶음 그림(Form): 자기 자원 목록, 없으면 부른 쪽 자원을 물려받아 (묶음 그림, 자원) 짝마다 한 번 훑는다
   - 바둑무늬 무늬(`/이름 scn`, PatternType 1), Type3 글꼴로 찍은 글자의 모양(CharProcs, `/Differences`로 코드→이름)
   - 주석의 보이는 모양(`/AP /N`, 상태가 여럿이면 `/AS`). 말풍선·숨김(2)·NoView(32) 주석은 뺀다
   - 꺼진 보이기 층: 원본 `/OCProperties /D`(BaseState·ON·OFF)와 OCMD `/P`로 판단. 사진·묶음 그림·주석의 `/OC`,
     내용의 `/OC /이름 BDC` 안에서 그린 것은 뺀다
   - 글자 모양 가림(ImageMask)은 사진이 아니라 뺀다. 바로 써 넣은 그림은 수만 센다
3. 작은 그림을 거르고, 사진마다 `extract()` → 하나 꺼낼 때마다 화면에 보낸다(`image`, `progress`)
4. 끝나면 못 꺼낸 수(`failed`)를 보내고, 화면이 안내 문구(`failedNote`)를 보여 준다

### 결정과 이유

- **JPG는 다시 저장하지 않는다.** 화질 손실 없이 원본 바이트를 낸다. 대신 PDF가 그리는 색과 같을 때만 그대로 낸다:
  - `/Decode`가 [0 1]이 아니거나 `/ColorTransform`이 있으면 못 꺼낸 것으로 센다 (JPG 파일만으로 그 뜻을 옮길 수 없다)
  - ICCBased이면 그 프로필을 APP2 `ICC_PROFILE` 조각으로 넣는다(원래 든 프로필은 바꿈, `jpegWithIcc`)
  - 장치 색공간이면 JPG 안의 ICC 프로필을 뺀다. PDF는 JPG 안 프로필을 쓰지 않아, 그대로 두면 다른 프로그램에서 색이 다르다
  - 투명도(`/SMask`)나 색 키(`/Mask` 배열)가 붙으면 PNG로 합친다. 이때 `createImageBitmap`에
    `colorSpaceConversion: 'none'`을 줘 JPG 안 프로필로 바꾸지 않은 값을 읽는다. CMYK 프로필이면 못 꺼낸 것으로 센다
- **PNG는 PDF 색을 그대로 옮긴다.**
  - ICC RGB는 PNG `iCCP` 덩어리로 넣는다. 회색 ICC는 canvas가 늘 RGB로 저장해 넣을 수 없어 회색 PNG를 직접 만든다(`grayPng`)
  - ICC `/Range`가 0~1이 아니면 못 꺼낸 것으로 센다 (`plainRange`, Flate·JPG·JPEG 2000 모두)
  - 자원 목록의 `/DefaultGray`·`/DefaultRGB`·`/DefaultCMYK`가 장치 색공간을 대신한다. `/CS0` 같은 이름 색공간도 푼다
  - 색 목록은 `hival`보다 큰 값을 마지막 색으로 본다
  - SMask는 1·2·4·8비트와 `/Decode [1 0]`을 다루고, `/Matte`(미리 섞인 투명도)·크기가 다른 마스크·Flate가 아닌 마스크는
    투명도를 잃은 채 내지 않고 못 꺼낸 것으로 센다. SMask가 있으면 `/Mask` 색 키는 쓰지 않는다
  - 예측의 행 크기(`DecodeParms`의 Columns·Colors·BitsPerComponent)가 사진과 다르면 못 꺼낸 것으로 센다
- **JPEG 2000은 그대로 내되 색이 같을 때만.** 브라우저가 JPEG 2000을 못 읽어 투명도(`/SMask`·`/Mask`)를 합칠 수 없으면
  못 꺼낸 것으로 센다. PDF가 장치 색공간을 정했으면 파일 안 `colr` 상자가 방법 1이고 같은 색공간 번호
  (RGB: sRGB 16·sYCC 18, 회색 17, CMYK 12)일 때만 낸다(`jpxColorMatches`). 확장자는 코드 스트림(FF4F)이면 `.j2k`,
  상자 파일이면 `ftyp` 이름에 따라 `.jp2`·`.jpx`(`jpxKind`)
- **틀린 색으로 내느니 못 꺼낸 수로 알린다.** 사용자는 "PDF를 이미지로"로 쪽 전체를 받을 수 있다.
- **보이는 사진만 꺼낸다.** 찾는 길마다 따로 고치다 보이지 않는 사진이 섞여, 같은 기준(그리는 것만, 꺼진 층·숨긴 주석·
  찍지 않은 글자 모양 제외)으로 맞췄다(`1afdab4`). 같은 토큰 나누기를 가리기와 같이 쓴다.

### 주의할 점

- 중복을 고르는 열쇠는 사진 참조 + 부른 쪽 자원에서 색공간이 풀리는 값(`spaceKey`)이다. 열쇠를 사진 참조만으로 줄이면
  쪽마다 다른 이름 색공간으로 부른 사진이 하나로 합쳐진다.
- JPEG 2000 상자 길이는 8바이트 확장 길이도 있다. 상자를 찾을 때 내용의 시작과 끝을 함께 돌려준다.
- 새 형식을 지원하려면 "PDF에서 보이는 색과 같은가"를 먼저 따진다. 리뷰 지적 대부분이 이 질문이었다.
- `content-tokens.ts`는 `feat/pdf-redact` 브랜치에도 같은 내용으로 들어 있다. 나중에 병합하는 쪽에서 확인한다.

## 3. 구현 체크리스트

- [x] 폴더(`meta.ts`·`content.ts`·`Frame.astro`·`App.svelte`·`messages.ts`)와 레지스트리 등록
- [x] 워커: 보이는 사진 찾기 (Do, 묶음 그림, 무늬, 주석 모양, Type3 글자 모양, 꺼진 층·NoView 제외)
- [x] JPG 원본 그대로 + ICC 넣기/빼기, 투명 JPG는 PNG
- [x] Flate·색 목록 → PNG (iCCP, 회색 PNG 직접 만들기, 색 키·SMask 투명도)
- [x] JPEG 2000 원본 그대로 (확장자, `colr` 확인)
- [x] 꺼내기 전에 `canUse()`, 파일을 닫으면 결과 정리, 꺼낸 것만 번호 매기기
- [x] 한·영 문구, 사용법·FAQ, 가이드 글 (`extract-images-pdf.md`)
- [x] E2E (로컬 처리 약속 `expectLocalOnly` 포함)
- [ ] PR #59 병합, 배포 확인, `CLAUDE.md` 진행 상황 갱신 (브랜치에서는 추가해 둠)
- [ ] 꺼내지 못하는 형식: CCITT·JBIG2, CMYK 화소, 16비트, 보정 색공간, `/Matte`, 바로 써 넣은 그림

## 4. 검증

### 자동 테스트

- `tests/e2e/pdf-extract-images.spec.ts` (브랜치에만 있음)
  - JPG는 원본 그대로, 그 밖은 PNG로 꺼내고 같은 사진은 한 번만 꺼낸다 (`expectLocalOnly`)
  - 작은 그림 빼기를 끄면 아이콘 크기 그림도 꺼낸다 / PNG 예측을 건 Flate 사진
  - ICC 프로필 넣기, 색 키 투명 → 알파, 바로 써 넣은 그림·보정 색공간은 못 꺼낸 수
  - 1비트·뒤집은 투명도, JPG 색 키 투명, 글자열 속 `BI`는 세지 않음
  - 자원 목록의 색공간 이름, 투명도가 붙은 JPEG 2000
  - 예측 행 크기가 다름, `Matte` 투명도
  - 그리지 않고 자원 목록에만 있는 사진, `Decode`로 바꿔 보이는 JPG
  - ICC 색공간 JPG는 프로필을 넣고, 보정 색공간 JPG는 못 꺼냄 / SMask가 있으면 `/Mask` 색 키 무시
  - 여러 쪽이 같이 쓰는 자원 없는 묶음 그림, `ColorTransform` JPG
  - JPEG 2000 확장자, 장치 색공간이 아닌 JPEG 2000, CMYK 프로필 투명 JPG
  - 기본 색공간(`/DefaultRGB` 등) / 회색 ICC 프로필 → 회색 PNG
  - 색 목록 범위(`hival`), 쪽마다 다른 이름 색공간으로 부른 같은 사진은 따로
  - 무늬 안 사진, 장치 색공간 JPG의 안쪽 프로필 빼기, 꺼낸 것만 번호
  - 도장 주석·Type3 글자 모양 안 사진, 파일 안 색이 다른 JPEG 2000, 값 범위가 다른 ICC JPG
  - 보이지 않는 사진(꺼진 층·숨긴 주석·찍지 않은 Type3 글자)은 꺼내지 않음
  - 8바이트 길이 JPEG 2000 머리 상자

### 직접 확인

- 브라우저별(Safari·휴대폰) 확인 기록은 아직 없다

### 히스토리

- [history.md](./history.md): PR·커밋·리뷰 지적과 처리
