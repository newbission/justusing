# PDF 글자 인식 (`pdf/ocr`)

- 주소: `/pdf/ocr/` (영어 `/en/pdf/ocr/`)
- 상태: dev 병합 (2026-10-16, PR #56), 배포 대기
- 관련 문서: [히스토리](./history.md), [글꼴·데이터 보관](../../foundations/fonts-and-data/README.md),
  [PDF 공통](../../foundations/pdf-common/README.md), [격리 frame](../../foundations/frame-isolation/README.md),
  [글자 추출](../pdf-extract-text/README.md)
- 가이드: `src/content/guides/{ko,en}/ocr-pdf.md`

## 1. 어떤 기능인지

- 스캔하거나 사진으로 만든 PDF의 그림 속 글자를 읽어, 원래 쪽 위에 **보이지 않는 글자**를 겹쳐 넣는다.
  쪽 모습은 그대로이고 글자 찾기·복사·소리 내어 읽기가 된다.
- 입력: PDF 한 개 (암호 PDF는 암호를 넣어 연다)
- 고르는 것
  - 인식할 언어: 한국어·영어 (체크 상자, 하나 이상). 한국어 화면 기본 한국어+영어, 영어 화면 기본 영어
  - "글자가 이미 있는 쪽은 건너뛰기" (기본 켜짐)
- 출력
  - "PDF 다운로드": `원래이름_글자인식.pdf` (영어 `_ocr.pdf`)
  - "TXT 다운로드": `원래이름_글자인식.txt`. 여러 쪽이면 `--- 1쪽 ---` 구분 줄, CRLF, UTF-8 BOM
- 처음 쓸 때 인식 데이터를 받아야 한다 (받기 전에 크기를 밝히고 묻는다)

| 받는 것       | 파일                                      | 크기     |
| ------------- | ----------------------------------------- | -------- |
| 인식 엔진     | `/data/ocr/tesseract-core-simd-lstm.wasm` | 약 2.9MB |
| 한국어 데이터 | `/data/ocr/kor.traineddata.gz`            | 약 1.6MB |
| 영어 데이터   | `/data/ocr/eng.traineddata.gz`            | 약 3.0MB |

- 한계 (FAQ와 같음)
  - 흐리거나 기울어진 스캔, 손글씨, 아주 작은 글자, 표·도장이 겹친 곳은 틀릴 수 있다. 틀린 글자는 화면에 보이지 않는다
  - 쪽당 몇 초씩 걸린다. 휴대폰은 더 느리고 메모리가 모자라면 멈출 수 있다
  - 데이터는 이 브라우저에만 보관된다. 다른 브라우저·기기·시크릿 창은 다시 받아야 하고, 브라우저 데이터를 지우면 사라진다
  - 건너뛰기: 본문 글자(공백 뺌)가 50자 이상인 쪽만 건너뛴다. 쪽 번호·워터마크만 글자인 스캔 쪽은 다시 읽는다

## 2. 어떻게 만드는지

### 파일

| 파일                              | 역할                                                                                |
| --------------------------------- | ----------------------------------------------------------------------------------- |
| `src/tools/pdf/ocr/meta.ts`       | 이름·설명·아이콘, 묶음 `convert`, 관련 도구(extract-text, compress)                 |
| `src/tools/pdf/ocr/content.ts`    | 사용법·FAQ (한·영)                                                                  |
| `src/tools/pdf/ocr/messages.ts`   | 화면 문구                                                                           |
| `src/tools/pdf/ocr/Frame.astro`   | 격리 frame 페이지                                                                   |
| `src/tools/pdf/ocr/App.svelte`    | 화면: 언어·건너뛰기, 데이터 받기 칸, 실행·다운로드                                  |
| `src/lib/ocr/ocr.ts`              | 데이터 목록(`ocrFiles`, `OCR_CONSENT = 'ocr'`), 워커 풀 `OcrPool`                   |
| `src/lib/ocr/ocr.worker.ts`       | Tesseract(WebAssembly) 실행. 쪽 그림 → 글자 + 투명 글자층 PDF                       |
| `src/lib/ocr/catalog.json`        | 데이터 경로·크기·SHA-256 (빌드 때 만든다)                                           |
| `src/lib/ocr/tesseract-core.d.ts` | 엔진 모듈 타입                                                                      |
| `scripts/copy-ocr-data.mjs`       | `predev`·`prebuild`에서 node_modules → `public/data/ocr/` 복사, `catalog.json` 쓰기 |
| `src/frame/data.ts`               | `dataStatus()`·`loadData()`: 바깥 보관소에 묻고 받은 바이트를 SHA-256·크기로 확인   |
| `src/lib/data-store.ts`           | 바깥 페이지 보관소 (Cache API, `data-consent`)                                      |
| `src/lib/pdf/render-image.ts`     | `renderPageBitmap()`: 쪽을 300 DPI 그림으로 (PDF를 이미지로와 같이 씀)              |
| `src/lib/pdf/text-layer.ts`       | `addTextLayers()`: 글자층을 원래 쪽 위에 겹친다                                     |
| `src/lib/pdf/modify.ts`(+워커)    | `{ kind: 'text-layer', layers }` 작업으로 위를 부른다                               |

### 데이터 준비 (빌드)

- 패키지: `tesseract.js-core` 6.1.2(SIMD LSTM 엔진), `@tesseract.js-data/kor`·`eng` 1.0.0의 `4.0.0_best_int`
  (`tessdata_best` 정수판). 모두 Apache-2.0. 허가서는 `public/data/ocr/LICENSE.txt`로 복사
- `public/data/ocr/`는 커밋하지 않는다 (`.gitignore`). 설치한 버전과 같은 파일이어야 해서 dev/build 전에 복사한다
- 주소에 `?v=<SHA-256 앞 12자리>`를 붙여(`versioned`) 내용이 바뀌면 예전 보관본을 쓰지 않는다

### 처리 흐름

1. 고른 언어가 바뀔 때마다 `dataStatus(files, 'ocr')`로 보관본을 확인
   - 다 있으면 `ready`, 없으면 `missing`(전에 받은 적 있으면 "지워졌습니다" 안내, 남은 공간이 크기의 2배 미만이면 공간 경고)
   - **보관본이 없으면 스스로 받지 않는다** (와이파이인지 알 수 없다)
2. "데이터 받기 (크기)" → `loadData()` → 진행 %(최대 99) → `ready`. 받는 동안 언어 선택은 잠근다
3. "글자 인식" → `canUse('pdf/ocr')`
4. 건너뛰기가 켜져 있으면 쪽마다 `getTextContent()`로 글자 수를 세어(`TEXT_PAGE_MIN = 50`) 읽을 쪽을 고른다.
   읽을 쪽이 없으면 "모든 쪽에 이미 글자가 있습니다" 안내
5. `loadData()`로 확인된 바이트를 받아 `OcrPool.create()`
   - 워커 수: `min(CPU − 1, 3, 쪽 수)`, `deviceMemory`가 4 이하면 1개
   - 워커마다 엔진·언어 데이터 복사본을 `init`으로 넘긴다. 워커는 gzip을 풀어 가상 파일에 쓰고 `TessBaseAPI.Init(..., OEM_LSTM_ONLY)`
6. `pool.run()`: 워커가 쪽을 하나씩 가져간다
   - 쪽 그리기는 화면 스레드에서 줄을 세워 **한 번에 한 쪽씩** `renderPageBitmap(page, 300)`
   - bitmap을 워커로 넘기면 `Recognize` → `GetUTF8Text()` + `TessPDFRenderer(textOnly)`로 글자만 든 한 쪽 PDF
7. `modifyPdf(source, { kind: 'text-layer', layers })`: 쪽마다 `embedPdf` → `isolateContent` → 보이는 영역 크기로 늘리고
   쪽 회전만큼 돌려 `drawPage`
8. 결과: PDF와 읽은 글자(화면 칸 + TXT)

### 결정과 이유

- **Tesseract SIMD + `tessdata_best` 정수판**: 서버 없이 브라우저에서 한국어를 읽을 수 있는 공개 엔진. 정수판은 LSTM 전용이라 `OEM_LSTM_ONLY`.
- **데이터는 바깥 페이지가 보관**: 격리 frame은 저장소를 못 쓰고 브라우저 캐시도 방문마다 비워진다.
  바깥 페이지에는 광고 스크립트가 있어서 frame은 **SHA-256과 크기가 맞는 바이트만** 쓴다. 자세한 것은 [글꼴·데이터 보관](../../foundations/fonts-and-data/README.md).
- **워커는 아무 데서도 받지 않는다**: `createTesseract({ wasmBinary })`로 엔진을 직접 준다. frame CSP도 바깥 연결을 막는다.
- **워커 3개까지**: 엔진 하나가 언어 데이터 포함 100MB 안팎을 쓴다. 메모리가 적은 기기는 1개.
- **쪽 그리기는 화면에서, 줄 세워 한 쪽씩**: pdf.js 화면 그리기는 프레임마다 쉬며 잘게 나눠 그리고, 그림 해독은 pdf.js 워커가 한다.
  워커에서 그리려면 PDF를 한 번 더 열어야 해서(메모리 두 배) 큰 PDF에서 더 위험하다. 대신 여러 인식 워커가 동시에 부탁해도
  300 DPI 그리기가 겹치지 않게 했다 (Codex 지적 반영).
- **Tesseract가 만든 글자층 PDF를 그대로 겹친다**: 글자 자리 계산을 엔진에 맡긴다. 글자층은 화면에 보이는 모습(회전·보이는 영역 반영)대로
  그린 그림에서 나왔으므로, 겹칠 때 보이는 영역에 맞춰 늘리고 쪽 회전만큼 거꾸로 돌린다.
- **건너뛰기 기준 50자**: 처음에는 글자가 하나라도 있으면 건너뛰어, 쪽 번호만 글자인 스캔 쪽을 읽지 않았다 (Codex 지적).
- **워커가 죽으면 기다리지 않는다**: 메모리가 모자라 워커가 죽으면 메시지가 오지 않으므로 `error` 이벤트를 실패로 본다.

### 주의할 점

- 엔진·언어 데이터를 바꾸면(패키지 버전 올림) `catalog.json`이 바뀐다. 개인정보처리방침의 "브라우저에 저장하는 것"과 FAQ·가이드의 크기를 같이 확인한다.
- 데이터를 받는 동안 언어를 바꾸지 못하게 잠근다. 진행 콜백도 지금 고른 파일 묶음(`files === wanted`)일 때만 상태를 바꾼다.
- `OcrPool`은 실패해도 `finally`에서 `dispose()`한다. 새 경로를 더할 때 워커가 남지 않게 한다.
- 결과 서명은 언어·건너뛰기만 본다. 다른 파일을 열면 `pdf !== source`로 버린다.
- Safari는 로컬에서 frame CSP가 배포 도메인만 허용해 확인할 수 없다 (모든 도구 공통). 배포 뒤 실제 주소에서 확인한다.

## 3. 구현 체크리스트

- [x] 엔진·한국어·영어 데이터 복사 스크립트와 `catalog.json`(크기·SHA-256)
- [x] 받기 전 크기 안내·동의, 보관본 재사용, 지워지면 다시 묻기, 공간 부족 경고
- [x] 인식 워커 풀(최대 3, 메모리 적으면 1), 쪽 그리기 줄 세우기
- [x] 투명 글자층 겹치기 (회전·보이는 영역 반영)
- [x] 글자 있는 쪽 건너뛰기 (50자 기준)
- [x] PDF·TXT 받기, 화면에서 읽은 글자 보기
- [x] 한·영 문구, 사용법·FAQ, 가이드(`ocr-pdf`)
- [x] E2E (로컬 처리 약속 포함)
- [x] 데스크톱·390px 화면 캡처 확인 (PR #56)
- [x] `status: 'live'` (dev)
- [ ] 배포(`dev` → `main`) 뒤 실제 주소에서 Safari 확인
- [x] 영어 FAQ의 데이터 크기를 실제(엔진 2.9MB + 영어 3.0MB ≈ 6MB)와 맞춤 (2026-10-16)
- [x] 글자 추출 도구 FAQ가 이 도구를 안내하도록 고침 (2026-10-16)
- [ ] 한국어·영어 말고 다른 언어는 없다
- [ ] 진행 중에 그만두는 버튼이 없다 (다른 파일을 열면 결과만 버린다)

## 4. 검증

### 자동 테스트

`tests/e2e/pdf-ocr.spec.ts` (테스트 안에서 스캔본 PDF를 만든다: 1쪽 스캔 그림 + 쪽 번호 글자 `- 1 -`,
2쪽 눕혀 저장하고 `/Rotate 90`으로 세운 스캔 그림, 3쪽 글자만 있는 쪽)

- 스캔본 인식
  - 데이터를 받기 전에는 "글자 인식" 버튼이 꺼져 있고, "데이터 받기 (n.nMB)" 버튼이 크기를 보여 준다
  - 받으면 "글자 인식 데이터가 준비되었습니다." → 인식 → "2쪽에서 글자" (3쪽은 건너뜀)
  - `scan_글자인식.pdf`: 3쪽, 1·2쪽에서 "다람쥐"·"quick"를 찾는다. 화면 기준으로 한글 줄이 영어 줄보다 위,
    왼쪽 30% 안, 위쪽 절반 안 (회전한 쪽 포함)
  - 3쪽 글자는 원래 글자 그대로 (두 겹이 아님)
  - TXT에 `--- 1쪽 ---`와 "다람쥐"
  - 요청은 우리 사이트로만 (`expectLocalOnly`)
- 보관
  - 한 번 받은 뒤 다시 열면 바로 준비되고 `/data/ocr/` 요청이 없다
  - Cache(`justusing-data-v1`)를 지우고 열면 "전에 받은 데이터가 브라우저에서 지워졌습니다." 안내, 버튼 꺼짐, 몰래 받지 않음

### 직접 확인

- 2026-10-15 (PR #56): 데스크톱·390px 화면 캡처 확인
- Safari: 아직 (배포 뒤 확인)

### 히스토리

- [history.md](./history.md): PR·커밋·리뷰 지적과 처리
