# PDF 문서 정보 고치기 (`pdf/metadata`)

쓴 날 2026-10-16 · 고친 날 2026-10-17

- 주소: `/pdf/metadata/` (영어 `/en/pdf/metadata/`)
- 상태: live (2026-10-17 배포, PR #61)
- 관련 문서: [히스토리](./history.md), [PDF 공통](../../foundations/pdf-common/README.md),
  [압축](../pdf-compress/README.md)(`removeUnused`를 같이 씀), [가리기](../pdf-redact/README.md)(FAQ가 가리킴)

## 1. 어떤 기능인지

- PDF의 제목·작성자·주제·키워드를 고치거나, 작성자 이름·사용한 프로그램·날짜처럼 파일에 숨은 정보를 모두 지운다.
- 입력: PDF 한 개 (암호 PDF는 `SinglePdfTool`에서 암호를 받아 연다)
- 출력: `<원래이름>_정보.pdf` (영어 화면 `_info`)
- 할 수 있는 것
  - 고칠 칸: 제목, 작성자, 주제, 키워드(쉼표로 구분). 칸을 비우면 그 정보를 지운다
  - 읽기만 하는 칸("파일에 적힌 다른 정보"): 만든 프로그램, PDF로 만든 프로그램, 만든 날짜, 고친 날짜
  - "문서 정보 모두 지우기 (만든 프로그램·날짜까지)": 켜면 칸이 잠기고 숨은 정보를 파일 전체에서 지운다
- **하지 않는 것·한계** (화면·FAQ와 같다)
  - 쪽 내용은 바꾸지 않는다. 본문의 이름·번호는 "PDF 가리기"를 권한다
  - 저장하면 XMP를 지운다. XMP에만 있던 저작권 정보와 PDF/A 표시도 함께 지워진다 (보관용 PDF/A는 원본을 남기라고 안내)
  - 암호 PDF를 저장하면 암호와 인쇄·복사 제한이 풀린다. 화면(`encryptedNote`)과 FAQ에 밝히고 "PDF 암호 걸기"를 권한다
  - 전자 서명이 있는 PDF는 저장하면 서명이 깨진다. 아직 화면에 알리지 않는다 (아래 체크리스트)

## 2. 어떻게 만드는지

### 파일

| 파일                                         | 역할                                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------- |
| `src/tools/pdf/metadata/meta.ts`             | 이름·설명·아이콘, 묶음 `security`, 관련 도구(암호 걸기·해제)                    |
| `src/tools/pdf/metadata/content.ts`          | 사용법·FAQ (한·영)                                                              |
| `src/tools/pdf/metadata/messages.ts`         | 화면 문구 (한·영)                                                               |
| `src/tools/pdf/metadata/App.svelte`          | 화면. pdf.js `getMetadata()`로 읽고 날짜를 이 기기 시각으로 보여 준다           |
| `src/lib/pdf/modify.ts`                      | 작업 종류 `metadata`(`info`, `clear`)와 `DocumentInfo` 타입                     |
| `src/lib/pdf/modify.worker.ts`               | `setDocumentInfo()`: Info 적기, XMP 끊기, 모두 지우기, `/ID` 새로 만들기        |
| `src/lib/pdf/remove-unused.ts`               | 문서에서 닿지 않는 객체 지우기(`removeUnused`). 압축 워커에서 옮겨 와 같이 쓴다 |
| `src/lib/pdf/compress.worker.ts`             | `removeUnused`를 공통 모듈에서 불러오게 바꿈 (동작 그대로)                      |
| `src/content/guides/{ko,en}/pdf-metadata.md` | 가이드 글                                                                       |

### 처리 흐름

1. 파일 고르기 → `readInfo()`가 pdf.js `getMetadata()`로 Info와 XMP를 읽는다
   - 고칠 칸: Info 값, 없으면 XMP(`dc:title`, `dc:creator`, `dc:description`, `pdf:keywords`, 그다음 `dc:subject` 목록을 쉼표로)
   - 읽기 전용 칸: Info 값, 없으면 XMP(`xmp:creatortool`, `pdf:producer`, `xmp:createdate`, `xmp:modifydate`)
     (pdf.js는 XMP 이름을 소문자로 준다)
   - `EncryptFilterName`이 있으면 암호 안내를 보여 준다 (열 암호 없이 제한만 걸린 PDF 포함)
2. "저장" → `canUse('pdf/metadata')` 확인 → `modifyPdf({ kind: 'metadata', info, clear })`
3. 워커가 이 작업만 `updateMetadata: false`로 연다 (pdf-lib가 열 때 만든 프로그램·고친 날짜를 자기 것으로 바꾸지 않게)
4. `setDocumentInfo()`
   - 늘: 카탈로그의 `/Metadata`(XMP) 참조를 끊는다
   - 보통 저장: 칸 값을 Info에 적고(빈 칸은 그 키를 지움), 고친 날짜를 지금으로 적는다
   - 모두 지우기: 아래 "모두 지우기가 지우는 것"
   - 끝으로 `removeUnused()`: 참조를 끊은 XMP·정보 값, 고친 기록에 남은 옛 XMP처럼 닿지 않는 객체를 모두 지운다
5. 저장 → "다운로드"

### 모두 지우기가 지우는 것

모든 간접 객체와 그 안에 바로 들어 있는 사전·배열까지 들어가 지운다 (`strip`).

| 자리                                           | 지우는 것                                                                                                |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Info 사전                                      | 모든 키 (사용자 정의 키 `/Company` 등 포함)                                                              |
| 어디에나                                       | `/Metadata`(XMP), `/PieceInfo`(앱 데이터), `/LastModified`, `/SpiderInfo`(웹에서 받은 기록)              |
| 첨부 파일 `/Params`                            | `/CreationDate`, `/ModDate`, `/Mac`                                                                      |
| 주석(`/Subtype`과 `/Rect`가 있는 사전)         | `/M`, `/CreationDate`, `/NM`, 그리고 Widget이 아니면 `/T`(작성자). 입력 칸 이름인 Widget `/T`는 남긴다   |
| 기사 흐름 `/Thread`                            | 정보 사전 `/I`의 모든 키                                                                                 |
| 전자 서명 사전(`/Type /Sig` 또는 `/ByteRange`) | `/Name`, `/M`, `/Location`, `/Reason`, `/ContactInfo`, `/Prop_Build`, `/Prop_AuthTime`, `/Prop_AuthType` |
| 트레일러 `/ID`                                 | 지우지 않고 무작위 16바이트로 새로 만든다 (보기 프로그램이 쓰는 값이라)                                  |

### 날짜 보여 주기

- PDF 날짜(`D:YYYYMMDDHHmmSS+HH'mm'`): 시간대(Z, ±HH'mm')까지 읽어 이 기기 시각으로 바꾼다. 시간대가 없으면 기기 시각으로 본다
- 시각이 없는 PDF 날짜와 날짜만 있는 XMP 값(`YYYY`, `YYYY-MM`, `YYYY-MM-DD`)은 적힌 만큼만(연도·연월·날짜) 보여 준다.
  XMP 날짜만 있는 값은 현지 날짜로 만든다 (`new Date('2025-05-06')`은 세계 표준시 자정이라 서쪽 나라에서 전날이 된다)

### 결정과 이유

- **보통 저장에서도 XMP를 지운다.** 보기 프로그램이 XMP를 먼저 읽어 예전 제목·작성자가 계속 보이는 문제가 더 흔하고,
  워커에서 XMP(XML)를 안전하게 고칠 수단이 없다. 리뷰에서 "일반 편집에서는 지우지 말라"는 지적이 있었지만 이대로 두고,
  XMP에만 있던 저작권·PDF/A 표시가 지워진다는 것을 FAQ에 밝혔다. XMP에만 있던 제목 등은 칸에 읽어 와 Info로 옮긴다.
- **XMP 객체를 바로 지우지 않고 참조만 끊은 뒤 `removeUnused()`로 지운다.** 바로 지우면 쪽 등이 같이 쓰는 XMP까지 지워진다.
  닿지 않는 객체만 지우면 같이 쓰는 것은 남고, 고친 기록에 남은 옛 XMP는 함께 지워진다.
- **숨은 정보는 규격에서 자리를 모두 찾아 한 번에 지운다** (`12a49a2`). 지적이 올 때마다 한 곳씩 더하다가 바꿨다.
- **`/ID`는 새로 만든다.** 원래 식별자가 원본과 결과를 이어 줄 수 있다.

### 주의할 점

- `updateMetadata: false`는 이 작업에만 준다. 다른 고치기 작업은 pdf-lib 기본(만든 프로그램·고친 날짜를 바꿈)을 따른다.
- 주석의 `/T`는 Widget(입력 칸)에서는 칸 이름이다. 지우면 양식이 깨진다.
- FAQ가 "PDF 가리기"를 가리키므로 PR #58을 이 PR보다 먼저 병합한다 (리뷰 답글에서 정함).

## 3. 구현 체크리스트

- [x] 폴더(`meta.ts`·`content.ts`·`Frame.astro`·`App.svelte`·`messages.ts`)와 레지스트리 등록
- [x] Info와 XMP에서 읽기 (XMP에만 있는 값, `dc:subject` 키워드), 날짜·시간대·축약 날짜 보여 주기
- [x] 보통 저장: Info 적기, XMP 지우기, 닿지 않는 객체 지우기
- [x] 모두 지우기: 위 표의 모든 자리, `/ID` 새로 만들기
- [x] 암호가 풀린다는 안내 (화면·FAQ)
- [x] 한·영 문구, 사용법·FAQ, 가이드 글 (`pdf-metadata.md`)
- [x] E2E (로컬 처리 약속 `expectLocalOnly` 포함)
- [x] 전자 서명이 있으면 저장하면 서명이 무효가 된다고 알리기 (`isSigned`, 저장하는 도구 모두 `saves`)
- [x] 보이기 층(OCG) `/Usage /CreatorInfo`의 만든 프로그램 정보 지우기
- [x] dev 병합(PR #61), 배포 (2026-10-17)

## 4. 검증

### 자동 테스트

- `tests/e2e/pdf-metadata.spec.ts` (브랜치에만 있음)
  - 제목·작성자를 바꾸고 비운 칸은 지운다 (`expectLocalOnly`)
  - 모두 지우기: 만든 프로그램·날짜·사용자 정의 항목, 카탈로그·쪽·안에 든 사전·고친 기록의 옛 XMP, PieceInfo,
    원래 `/ID`, 쪽의 고친 시각, 주석 작성자·`/NM`, 기사 흐름 정보, 서명 사전(서명한 사람·이유·시각), 첨부 파일 날짜,
    웹 기록이 결과 바이트에 남지 않고, 입력 칸(`field_keep`)은 남는다
  - 서울 시간대에서 시간대가 적힌 날짜를 이 기기 시각으로 보여 준다
  - Info에 없고 XMP에만 있는 제목·작성자 등을 칸에 채운다
  - 제목만 바꿀 때 쪽과 같이 쓰는 XMP 객체는 지우지 않는다
  - 암호 PDF에는 암호가 풀린다는 안내를 보이고, 암호 없는 PDF에는 보이지 않는다
  - 로스앤젤레스 시간대에서: 날짜만 적힌 XMP 날짜는 그날 그대로, 축약된 PDF 날짜는 적힌 만큼만 보여 준다

### 직접 확인

- 브라우저별(Safari·휴대폰) 확인 기록은 아직 없다

### 히스토리

- [history.md](./history.md): PR·커밋·리뷰 지적과 처리
