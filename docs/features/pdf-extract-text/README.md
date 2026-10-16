# PDF 글자 추출 (`pdf/extract-text`)

- 주소: `/pdf/extract-text/` (영어 `/en/pdf/extract-text/`)
- 상태: live (2026-10-15 배포, PR #31)
- 관련 문서: [히스토리](./history.md), [PDF 공통](../../foundations/pdf-common/README.md),
  [격리 frame](../../foundations/frame-isolation/README.md), 스캔본은 [글자 인식](../pdf-ocr/README.md)
- 가이드: 없음 (OCR 가이드 `ocr-pdf.md`가 스캔본 구별법으로 이 도구를 가리킨다)

## 1. 어떤 기능인지

- PDF에 든 글자를 뽑아 화면에 보여 주고 TXT 파일로 받게 한다.
- 입력: PDF 한 개 (암호 PDF는 암호를 넣어 연다)
- 따로 고를 것이 없다. 열자마자 모든 쪽을 읽는다
- 출력
  - 화면: 읽기 전용 글자 칸(`추출한 글자`). 필요한 부분만 골라 복사할 수 있다
  - "TXT 다운로드": `원래이름.txt`. 여러 쪽이면 쪽마다 `--- 1쪽 ---`(영어 `--- Page 1 ---`) 구분 줄,
    줄바꿈은 CRLF, UTF-8 BOM
- 한계 (FAQ와 같음)
  - 스캔한 PDF는 글자가 그림이라 뽑을 글자가 없다 → "글자를 찾지 못했습니다" 안내, 다운로드 버튼 꺼짐
  - 표·여러 단 문서는 PDF에 저장된 순서대로 이어 붙여 순서가 섞일 수 있다
  - 글자 정보가 빠진 일부 PDF는 엉뚱한 글자로 나올 수 있다

## 2. 어떻게 만드는지

### 파일

| 파일                                     | 역할                                                     |
| ---------------------------------------- | -------------------------------------------------------- |
| `src/tools/pdf/extract-text/meta.ts`     | 이름·설명·아이콘, 묶음 `view`, 관련 도구(view, to-image) |
| `src/tools/pdf/extract-text/content.ts`  | 사용법·FAQ (한·영)                                       |
| `src/tools/pdf/extract-text/messages.ts` | 화면 문구, 쪽 구분 줄(`pageMark`)                        |
| `src/tools/pdf/extract-text/Frame.astro` | 격리 frame 페이지                                        |
| `src/tools/pdf/extract-text/App.svelte`  | 화면과 처리 전부 (`extract()`, `save()`)                 |

워커나 따로 된 처리 모듈이 없다. 글자 읽기는 pdf.js(`src/lib/pdf/pdfjs.ts`, `SinglePdfTool`이 연다)가 자기 워커에서 한다.

### 처리 흐름

1. `SinglePdfTool`이 PDF를 연다 → `onload` → 바로 `extract()`
2. 쪽마다 `getPage()` → `getTextContent()` → `page.cleanup()`
   - 항목의 `str`을 잇고, pdf.js가 알려 주는 줄 끝(`hasEOL`)에서 줄을 바꾼다
   - 공백을 뺀 글자 수를 쪽마다 세어 더한다
   - 진행: `글자를 읽는 중… n/m쪽`
3. 쪽들을 빈 줄로 잇는다 → 글자 수와 함께 `done`
4. "TXT 다운로드" → `canUse('pdf/extract-text')` → CRLF로 바꾸고 BOM을 붙여 `downloadFile()`

### 결정과 이유

- **화면 쪽에서 읽는다 (워커로 옮기지 않음)**: Codex가 워커로 옮기라고 했지만 일부만 반영했다.
  글자 읽기(`getTextContent`)는 이미 pdf.js 워커가 하고, 화면 쪽은 쪽마다 기다리며 그 쪽 글자만 잇는다.
  다 읽은 뒤 전체를 다시 훑어 세던 부분은 쪽마다 세어 더하도록 바꿨다. 남은 마지막 잇기와 `TextEncoder`는
  수백 쪽에서도 수 ms 수준이라 그대로 두었다.
- **CRLF + UTF-8 BOM**: 메모장에서도 줄이 바뀌고 한글이 깨지지 않게. OCR 도구의 TXT도 같은 방식이다.
- **한글 CMap**: 한글 PDF는 pdf.js가 CMap 파일을 받아야 읽힌다. 이 파일은 우리 사이트에 복사해 둔다
  (`scripts/copy-pdfjs-assets.mjs` → `public/vendor/pdfjs/`).

### 주의할 점

- 다른 파일을 열면 이전 읽기를 버린다 (`pdf !== source`).
- 글자 칸은 글자가 1자 이상일 때만 보인다.

## 3. 구현 체크리스트

- [x] 폴더와 레지스트리 등록
- [x] 열자마자 모든 쪽 읽기, 진행 표시, 쪽 구분 줄
- [x] 화면에서 고르고 복사, TXT 받기(CRLF, BOM)
- [x] 글자가 없으면 스캔본 안내
- [x] 쪽마다 글자 수 세기 (리뷰 지적 반영)
- [x] 한·영 문구, 사용법·FAQ
- [x] E2E (한글 CMap 포함)
- [x] 휴대폰(390) 화면 캡처 확인 (PR #31)
- [x] `status: 'live'`
- [x] 스캔 PDF FAQ가 OCR을 "아직 없습니다"라고 하던 것을 OCR 도구 안내로 고침 (2026-10-16)
- [ ] 가이드 글 없음
- [ ] 표·여러 단의 배치를 살리지 않는다

## 4. 검증

### 자동 테스트

`tests/e2e/pdf-light-tools.spec.ts` (암호 해제·암호 걸기·쪽 번호와 같은 파일)

- 글자 추출: `three-pages.pdf`를 열면 글자 칸이 `--- 1쪽 ---\nPage 1`로 시작하고, `three-pages.txt`의 내용이
  정확히 `--- 1쪽 ---\r\nPage 1\r\n\r\n--- 2쪽 ---…`. "다른 파일"로 `korean.pdf`를 열면 `안녕하세요 한글 PDF`
- 같은 파일의 로컬 처리 테스트는 암호 걸기 도구로 확인한다. 이 도구만의 `expectLocalOnly` 테스트는 없다

### 직접 확인

- 2026-10-14 (PR #31): 휴대폰(390) 화면 캡처로 배치 확인

### 히스토리

- [history.md](./history.md): PR·커밋·리뷰 지적과 처리
