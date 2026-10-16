# PDF 압축 (`pdf/compress`)

- 주소: `/pdf/compress/` (영어 `/en/pdf/compress/`)
- 상태: live (2026-10-15 배포, PR #33)
- 관련 문서: [히스토리](./history.md), [PDF 공통](../../foundations/pdf-common/README.md),
  [격리 frame](../../foundations/frame-isolation/README.md)
- 가이드: `src/content/guides/{ko,en}/compress-pdf.md`

## 1. 어떤 기능인지

- PDF 용량을 줄인다 ('pdf 용량 줄이기'). 메일 첨부·제출 용량 제한에 맞출 때 쓴다.
- 입력: PDF 한 개 (암호 PDF는 암호를 넣어 연다)
- 고르는 것: 줄이는 정도 "조금 (화질 우선)" / "보통 (추천)" / "많이 (용량 우선)" (휴대폰 "조금"·"보통"·"많이")
- 출력: `원래이름_압축.pdf` (영어 화면 `_compressed.pdf`). 원래 크기 → 줄어든 크기와 % 를 보여 준다
- 할 수 있는 것 / 한계 (화면·FAQ와 같음)
  - 글자와 도형은 그대로 두고 **PDF 안의 사진만** 다시 저장한다. 글자 검색·복사는 그대로 된다
  - 사진이 많은 PDF(스캔본, 사진 든 보고서)는 절반 이하로 줄어드는 경우가 많다. 글자만 있는 PDF는 거의 줄지 않는다
  - 원본보다 작아지지 않으면 받을 파일을 만들지 않고 "더 줄일 수 없었습니다."라고 알린다
  - 글자를 사진처럼 찍은 스캔본은 "많이"에서 흐려질 수 있다
  - 결과 PDF에는 암호가 없다 (다시 걸려면 "PDF 암호 걸기")
  - 휴대폰에서 수백 MB 파일은 메모리가 부족할 수 있다

## 2. 어떻게 만드는지

### 파일

| 파일                                     | 역할                                                                          |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| `src/tools/pdf/compress/meta.ts`         | 이름·설명·아이콘, 묶음 `optimize`, 관련 도구(from-image, split)               |
| `src/tools/pdf/compress/content.ts`      | 사용법·FAQ (한·영)                                                            |
| `src/tools/pdf/compress/messages.ts`     | 화면 문구, 단계 이름·설명                                                     |
| `src/tools/pdf/compress/Frame.astro`     | 격리 frame 페이지                                                             |
| `src/tools/pdf/compress/App.svelte`      | 화면: 단계 고르기, `ActionBar`, 쪽 격자. 취소(`AbortController`)              |
| `src/lib/pdf/compress.ts`                | `compressPdf()`: PDF 워커 하나 + 사진 워커 여러 개를 부린다. 단계 값 `LEVELS` |
| `src/lib/pdf/compress.worker.ts`         | pdf-lib로 열어 사진 꺼내기(`scan`), 바꿔 넣고 저장(`finish`), 놓기(`drop`)    |
| `src/lib/pdf/recompress-image.worker.ts` | 사진 하나를 줄여 JPG로 다시 저장                                              |

### 단계 값 (`LEVELS`)

| 단계            | JPG 화질 | 사진 한 변 최대 |
| --------------- | -------- | --------------- |
| light (조금)    | 0.85     | 3000px          |
| balanced (보통) | 0.72     | 2000px          |
| strong (많이)   | 0.55     | 1400px          |

### 처리 흐름

1. "압축하기" → `canUse('pdf/compress')` → 단계를 지역 변수로 고정, `AbortController` 만들기
2. PDF 워커 `scan`
   - `PDFDocument.load(bytes, { password })`
   - `removeUnused()`: Root·Info에서 닿지 않는 객체를 먼저 지운다 (쓰지 않는 옛 사진을 줄이느라 시간을 쓰지 않게)
   - 다른 사진의 마스크(SMask·Mask)로 쓰이는 사진은 뺀다
   - `sourceImage()`로 줄일 수 있는 사진만 꺼낸다 (아래 "바꾸는 사진") → 바이트를 화면으로 넘긴다
3. 사진 워커 풀 (`poolSize()` = CPU 수 − 1, 1~4개)이 사진을 나눠 줄인다
   - JPG: `createImageBitmap(colorSpaceConversion: 'none', imageOrientation: 'none')`
   - 화소: Flate 풀기(`DecompressionStream`) → PNG 예측 풀기(`unpredict`) → RGBA `ImageData`
   - 한 변 `maxSide`까지 줄이고 JPG로 저장. 원본의 90% 이상이면(`MIN_SAVING`) `skip`
   - 사진 하나 끝날 때마다 진행 막대 `사진을 줄이는 중… n/m`
4. PDF 워커 `finish`
   - 줄어든 사진만 바꿔 넣는다: `Filter=DCTDecode`, 크기 갱신, `DecodeParms` 지우기, 회색이면 `ColorSpace=DeviceRGB`.
     나머지 설정(3색 색공간·SMask)은 그대로
   - `deflateRaw()`: 필터 없는 1KB 이상 스트림을 Flate로 압축 (손실 없음, 남은 `DecodeParms`도 지움)
   - `save({ useObjectStreams: true })`
5. 원본보다 작으면 `done`, 아니면 `no-gain`

### 바꾸는 사진 (`sourceImage`)

- 바꾼다: 20KB 이상(`MIN_IMAGE_BYTES`)인
  - JPG(`DCTDecode` 하나, `DecodeParms` 없음)
  - 8비트 화소(`FlateDecode` 또는 필터 없음), 색: RGB 계열(DeviceRGB·CalRGB·ICC N=3) 또는 **보정 없는 DeviceGray**
  - PNG 예측(10 이상)은 `Colors`·`Columns`·`BitsPerComponent`가 사진과 같을 때만, Flate일 때만
- 그대로 둔다: `ImageMask`, `Decode`, 색 투명(`Mask` 배열), `Matte`가 붙은 SMask의 부모, CMYK·색 목록·특수 색,
  TIFF 예측(2), 여러 필터, `DefaultGray`·`DefaultRGB`가 있는 PDF의 회색 사진, 브라우저가 읽지 못하는 사진

### 결정과 이유

- **사진만 줄인다**: PDF 용량의 대부분은 사진이다. 글자를 그림으로 바꾸지 않으니 검색·복사를 잃지 않는다.
- **브라우저가 확실히 다루는 사진만**: 색·모양이 달라질 위험이 있는 사진은 손대지 않는다. 리뷰에서 지적된 경우를 하나씩 막았다
  (보정·ICC 색공간 덮어쓰기, 예측 줄 길이, EXIF 방향, Matte, DefaultGray, 색 변환 설정 JPG).
- **3색은 색공간을 남긴다**: 화소 값을 그대로 두고 색공간도 그대로 두면 같은 색이 된다. 그래서 JPG를 ICC 변환 없이 읽는다.
  회색은 RGB로 바꿀 수밖에 없어 보정 없는 DeviceGray만 다룬다.
- **워커 두 종류**: pdf-lib 문서는 PDF 워커 하나가 쥐고, 무거운 사진 줄이기는 CPU 수만큼 나눈다. 메모리를 생각해 사진 워커는 4개까지.
- **취소는 워커를 끝낸다**: pdf-lib 열기·저장은 중간에 멈출 수 없다. 그만두면 PDF 워커와 사진 워커 풀을 `terminate`하고
  다음 압축은 새 워커로 한다 (안 그러면 새 파일 작업과 겹쳤다).
- **원본 바이트는 복사해서 보낸다**: 다른 단계로 다시 줄일 수 있게 원본이 남는다.

### 주의할 점

- 다른 파일을 열거나 "다른 파일"로 닫으면 `SinglePdfTool`의 `onclose`에서 압축을 그만두고 결과도 버린다.
  새로 연 파일과 결과를 섞지 않도록 `pdf !== source`로도 확인한다.
- 사진을 바꿔 넣을 때 `refs[index]`로 자리를 찾는다. `scan`에서 꺼낸 순서와 사진 워커의 `index`가 같아야 한다.
- 회색 사진을 받을지(`grayAllowed`)는 문서 전체에 `DefaultGray`·`DefaultRGB`가 하나라도 있으면 끈다.

## 3. 구현 체크리스트

- [x] 폴더와 레지스트리 등록, PDF 목록 '최적화' 묶음
- [x] 세 단계, 원래 크기 → 줄어든 크기 표시, 줄지 않으면 받을 파일 없이 안내
- [x] PDF 워커 + 사진 워커 풀(CPU 수 − 1, 최대 4)
- [x] JPG, 8비트 회색·RGB(Flate·무압축, PNG 예측) 다시 저장
- [x] 손실 없는 정리: 쓰지 않는 객체 지우기, 압축 안 된 스트림 Flate
- [x] 색·모양이 바뀔 수 있는 사진 빼기 (리뷰 지적 반영)
- [x] 다른 파일·닫기에서 취소, 워커 끝내기, 결과 버리기
- [x] 한·영 문구, 사용법·FAQ, 가이드(`compress-pdf`)
- [x] E2E (로컬 처리 약속 포함)
- [x] `status: 'live'`
- [ ] CMYK·색 목록·16비트·흑백 팩스(CCITT)·JPX 사진은 줄이지 않는다
- [ ] 글꼴 줄이기(subset)·중복 객체 합치기는 하지 않는다

## 4. 검증

### 자동 테스트

`tests/e2e/pdf-compress.spec.ts`

- `photos.pdf`(1008KB, JPG 하나 + PNG 예측을 건 Flate 하나): `photos_압축.pdf`가 원본의 절반 미만,
  사진 두 장 모두 `/DCTDecode`, 쪽마다 글자(`Photo page 1`·`2`)와 사진 1장이 그대로. 요청이 기기 밖으로 나가지 않음
- "조금"과 "많이"로 각각 압축하면 "많이"가 더 작다
- 사진 없는 `three-pages.pdf` → "더 줄일 수 없었습니다." 안내, 압축 버튼 꺼짐, 다운로드 없음
- 압축 중에 "다른 파일"로 바꾸고 다시 압축하면 끝까지 되어 2쪽 PDF를 받는다

### 직접 확인

- 2026-10-14 (PR #33): PNG 예측을 건 사진을 결과에서 꺼내 눈으로 확인 (깨짐 없음)

### 히스토리

- [history.md](./history.md): PR·커밋·리뷰 지적과 처리
