# 글꼴과 도구 데이터 보관 (fonts-and-data)

쓴 날 2026-10-16 · 고친 날 2026-10-16

- 쓰는 곳: 글꼴 — PDF 워터마크·머리말·꼬리말·편집·양식 채우기 / 데이터 보관 — 글꼴 + PDF 글자 인식(OCR)
- 상태: live (글꼴 기반은 2026-10-15 만들고 PR #47로 dev 병합, 2026-10-16)
- 관련 문서: [히스토리](./history.md), [격리 frame](../frame-isolation/README.md),
  [PDF 공통](../pdf-common/README.md) (글자를 PDF에 넣는 워커), [OCR 도구](../../features/pdf-ocr/README.md),
  [`CLAUDE.md`](../../../CLAUDE.md)의 "도구 데이터 보관"·"글꼴" 절

## 1. 어떤 기반인지

PDF에 한글을 넣거나 스캔본 글자를 읽으려면 큰 공개 파일(한글 글꼴, OCR 엔진·언어 데이터)이 필요하다.
이 기반은 두 가지를 맡는다.

- **한글 글꼴 직접 호스팅**: OFL 글꼴 8종을 글자를 덜어 내 WOFF2로 만들어 우리 사이트에 둔다
  (CDN에서 받지 않는다). 도구 화면의 글꼴 목록(`FontPicker`)에서 고르고, 내 글꼴을 올릴 수도 있다
- **큰 데이터 받기·보관**: 받기 전에 크기를 밝히고 사용자가 "받기"를 눌러야 받는다. 받은 것은 바깥 페이지가
  브라우저 저장소(Cache API)에 보관해 다음 방문에 다시 받지 않는다. frame은 받은 바이트를 **빌드 때 적어 둔
  SHA-256·크기로 확인한 뒤에만** 쓴다

사용자 파일은 이 경로로 오가지 않는다. 오가는 것은 우리 사이트의 공개 파일(`/data/...`)과 그 경로뿐이다.

| 묶음                                | 파일                                                       | 크기                                   |
| ----------------------------------- | ---------------------------------------------------------- | -------------------------------------- |
| 글꼴 8종 (보통·굵게, 일부는 보통만) | `public/data/fonts/<id>-<굵기>.woff2`                      | 모두 합쳐 약 7.6MB, 글꼴마다 0.1~2.4MB |
| OCR 엔진                            | `public/data/ocr/tesseract-core-simd-lstm.wasm`            | 약 2.9MB                               |
| OCR 언어 데이터                     | `public/data/ocr/kor.traineddata.gz`, `eng.traineddata.gz` | 약 1.6MB, 3.0MB                        |

## 2. 어떻게 만드는지

### 파일

| 파일                                          | 역할                                                                                                                                                      |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/fonts/build_fonts.py`                | 글꼴 만들기 (직접 돌리고 결과를 커밋). 원본 받기 → 굵기 고정 → 글자 덜기 → 이름 바꾸기 → WOFF2 → 미리보기 SVG·허가서·목록                                 |
| `public/data/fonts/`                          | 만든 WOFF2, `previews/<id>.<언어>.svg`, `licenses/<id>.txt` (커밋함)                                                                                      |
| `src/lib/fonts/catalog.json`                  | 스크립트가 쓰는 파일 목록: 굵기·경로·크기·SHA-256·한글 음절 수                                                                                            |
| `src/lib/fonts/catalog.ts`                    | 화면 이름(한·영)·원본 이름(`source`)·분류(`kind`)를 붙인 `FONTS`, `fontConsent()`, `fontPreview()`                                                        |
| `src/lib/fonts/FontPicker.svelte`             | 글꼴 고르기 화면 (받기·진행률·받음·지워짐·내 글꼴 올리기)                                                                                                 |
| `scripts/copy-ocr-data.mjs`                   | dev/build 전에 node_modules의 OCR 엔진·언어 데이터를 `public/data/ocr/`로 복사하고 `src/lib/ocr/catalog.json`을 쓴다 (`public/data/ocr/`는 커밋하지 않음) |
| `src/lib/data-store.ts`                       | **바깥 페이지**의 보관소 `serveData(frame)`. Cache API(`justusing-data-v1`)와 `localStorage`의 `data-consent`                                             |
| `src/components/ToolFrame.astro`              | 도구 iframe을 띄우면서 `serveData(frame)`을 켠다                                                                                                          |
| `src/frame/data.ts`                           | **frame 쪽** `dataStatus()`·`loadData()`. 받은 바이트를 크기·SHA-256으로 확인, 다르면 `DataIntegrityError`                                                |
| `src/frame/messages.ts`의 `fonts`             | 글꼴 목록 문구 (한·영)                                                                                                                                    |
| `src/pages/privacy.astro`, `en/privacy.astro` | "브라우저에 저장하는 것"에 이 보관을 밝힌다                                                                                                               |

### 처리 흐름 (frame ↔ 바깥 페이지)

1. 화면이 뜨면 frame이 묶음마다 `dataStatus(files, consent)`를 부른다 → 바깥에 `data-status` 메시지
2. 바깥은 Cache API에서 보관 여부, `data-consent`에서 전에 받기로 했는지, `navigator.storage.estimate()`로
   남은 공간을 알려 준다
3. frame이 상태를 보여 준다
   - 다 보관됨 → "받음" (글꼴은 목록 순서대로 첫 보관 글꼴을 저절로 고른다. 사용자가 아직 아무것도 안 골랐을 때만)
   - 보관 안 됨 + 전에 받은 적 없음 → 크기와 "받기" 버튼
   - 보관 안 됨 + 전에 받은 적 있음 → "전에 받은 … 브라우저에서 지워졌습니다" (조용히 다시 받지 않는다)
   - 남은 공간이 크기의 2배보다 작으면 "저장 공간이 부족해 보관하지 못할 수 있습니다"
4. 사용자가 "받기"를 누르면 `loadData(files, consent, onProgress)` → 바깥에 `data-get`(경로 + 기대 SHA-256)
5. 바깥은 동의를 기록하고 `navigator.storage.persist()`를 부탁한 뒤, 보관본의 해시가 맞으면 그대로, 아니면
   지우고 새로 받는다. 받는 동안 `data-progress`를 보내고, **해시가 맞는 것만** 보관한다
6. 바깥이 `data-files`로 바이트를 넘긴다(transfer). frame은 크기·SHA-256을 다시 확인하고 맞을 때만 쓴다

- 바깥 보관소는 그 iframe(`event.source === frame.contentWindow`)이 보낸 메시지만 받고, 경로는 `/data/`로
  시작하고 `..`가 없는 것만 받는다
- 글꼴 경로에는 `?v=<SHA-256 앞 12자>`를 붙인다(`catalog.ts`). 글꼴이 바뀌면 주소가 바뀌어 예전 보관본을 쓰지 않는다
- 동의 이름: 글꼴은 글꼴마다 `font:<id>`, OCR은 `ocr` (`src/lib/ocr/ocr.ts`의 `OCR_CONSENT`)
- 도구 화면을 바깥 페이지 없이 따로 열면(개발 중) 보관 없이 바로 받고, 확인은 똑같이 한다

### 글꼴 만들기 (`build_fonts.py`)

```sh
pip3 install fonttools brotli
python3 scripts/fonts/build_fonts.py
```

- 원본: Google Fonts 저장소의 **고정 커밋**, Pretendard는 `node_modules/pretendard`. 받은 원본은 `.cache/fonts/`
- 가변 글꼴(Noto)은 `wght` 400·700으로 고정한다
- 남기는 글자: 영문·숫자·문장부호, 라틴 기호, 일반 문장부호·몇몇 기호(₩, € 등), 한글 호환 자모, **한글 음절 11,172자**,
  전각 문자. 한자는 뺀다
- WOFF2는 `transform_tables=set()`로 **글리프 변환을 끈다**
- 미리보기 SVG는 글자를 도형으로 바꿔 그려 글꼴을 받지 않아도 보인다. 5줄 고정(한글 문장, 영어 대문자·소문자 문장,
  숫자, 특수문자), 영어판은 영어 줄이 먼저

| id               | 화면 이름 (한 / 영)        | 파일 안의 이름     | 원본 (출처로 표시)                                                |
| ---------------- | -------------------------- | ------------------ | ----------------------------------------------------------------- |
| `pretendard`     | 모던 고딕 / Modern Gothic  | JUS Modern Gothic  | Pretendard                                                        |
| `noto-sans-kr`   | 본고딕 (Noto Sans KR)      | Noto Sans KR       | —                                                                 |
| `noto-serif-kr`  | 본명조 (Noto Serif KR)     | Noto Serif KR      | —                                                                 |
| `nanum-gothic`   | 기본 고딕 / Basic Gothic   | JUS Basic Gothic   | Nanum Gothic                                                      |
| `nanum-myeongjo` | 기본 명조 / Basic Myeongjo | JUS Basic Myeongjo | Nanum Myeongjo                                                    |
| `nanum-pen`      | 펜 손글씨 / Pen Script     | JUS Pen Script     | Nanum Pen Script                                                  |
| `gowun-dodum`    | 고운돋움                   | Gowun Dodum        | —                                                                 |
| `black-han-sans` | 검은고딕                   | Black Han Sans     | — (원본에 한글 2,581자만 있어 "한글 2,581자만 있어…"를 보여 준다) |

### 결정과 이유

- **바깥 페이지가 보관한다**: 격리 frame은 출처가 `null`이라 저장소를 못 쓰고, 브라우저 캐시도 방문마다
  비워진다(2026-10-15 크롬에서 확인). 그래서 같은 출처인 바깥 페이지가 Cache API에 둔다
- **frame이 해시를 확인한다**: 바깥 페이지에는 광고 스크립트가 함께 돈다. 바깥이 넘긴 바이트를 믿지 않고
  빌드 때 적어 둔 크기·SHA-256과 맞을 때만 쓴다
- **바깥도 해시가 맞는 것만 보관한다** (리뷰 지적, `bb426fe`): 처음에는 받은 것을 먼저 보관해서, 한 번 잘못 받으면
  "다시 받기"를 눌러도 손상된 보관본만 돌아왔다
- **받기 전에 묻고 크기를 밝힌다**: 와이파이인지 알 수 없다. 보관본이 지워졌으면 조용히 다시 받지 않고 다시 묻는다.
  그래서 "받기로 한 적"을 `data-consent`에 따로 적는다
- **예약 글꼴 이름**: 글자를 덜어 낸 글꼴은 OFL의 '고친 판'이다. 허가서에 Reserved Font Name이 있는
  Pretendard·Nanum은 그 이름을 쓸 수 없어(OFL 3항) 파일 안 이름(name 표 1·2·3·4·6, CFF 이름)과 화면 이름을
  우리 이름으로 바꾸고, 원본 이름은 "원본 글꼴: …"로 출처만 밝힌다 (리뷰 P1, `ff35b01`·`24fb643`)
- **글리프 변환 끄기**: 켜면 PDF에 글꼴을 넣는 fontkit이 `loca` 표를 찾지 못해 실패한다
- **OCR 데이터는 커밋하지 않는다**: 설치한 패키지 버전과 같은 파일이어야 해서 dev/build 전에 복사하고, 목록만 쓴다
- **내 글꼴**: 브라우저 `FontFace`로 읽을 수 있는지만 확인하고 그 페이지에서만 쓴다(보관하지 않음).
  올릴 때마다 다른 id(`upload-N`)를 붙여 도구가 이전 결과를 버리게 한다

### 주의할 점

- 글꼴을 더하면 `build_fonts.py`의 `FONTS`와 `catalog.ts`의 `NAMES`를 **함께** 고친다 (없으면 `catalog.ts`가 오류를 던진다).
  허가서의 예약 글꼴 이름을 먼저 확인한다
- 보관하는 것을 바꾸면(새 묶음, 저장 위치) 개인정보처리방침 두 언어판과 시행일도 고친다
- `FontPicker`는 비동기 경쟁이 많았다(히스토리 참고). 고르기마다 번호(`picks`), 올리기마다 번호(`uploading`)를 두고
  **마지막 것만** `selected`·`uploaded`를 바꾼다. 이 규칙을 깨는 고침을 하지 않는다
- 캐시 이름(`justusing-data-v1`)을 바꾸면 모든 사용자의 보관본이 버려진다. E2E도 이 이름으로 보관소를 비운다
- 글자를 PDF에 넣는 일(fontkit, 쓴 글자만 넣기, 글꼴에 없는 글자 미리 알리기)은 [PDF 공통](../pdf-common/README.md)의
  `text-pdf` 워커가 한다

## 3. 구현 체크리스트

- [x] 글꼴 만드는 스크립트 (고정 커밋 원본, 한자 뺀 서브셋, WOFF2 변환 끔, 미리보기 SVG, 허가서, 목록)
- [x] 한글 글꼴 8종 커밋, 예약 이름 글꼴은 우리 이름으로
- [x] 글꼴 목록 화면: 크기·굵기 표시, 받기·진행률·받음·지워짐·실패·공간 부족, 원본 출처, 일부 한글만 있는 글꼴 안내
- [x] 내 글꼴 올리기 (TTF·OTF·WOFF, 보관 안 함)
- [x] 바깥 페이지 보관소 (Cache API, 동의 기록, `persist()`, 남은 공간)
- [x] frame에서 크기·SHA-256 확인, 바깥도 맞는 것만 보관
- [x] OCR 엔진·언어 데이터 복사와 목록, 같은 보관소 사용
- [x] 개인정보처리방침 "브라우저에 저장하는 것"에 밝힘
- [ ] 보관본을 화면에서 직접 지우는 기능은 없다 (브라우저 데이터 지우기로만 지운다)
- [ ] 시크릿 창 등 저장소를 못 쓰는 곳에서는 보관 없이 받기만 한다 (다음에 다시 받음)

## 4. 검증과 히스토리

### 자동 테스트

- `tests/e2e/pdf-watermark.spec.ts`
  - 글꼴을 받아 모든 쪽에 워터마크를 넣는다 (쓴 글자만 넣어 결과가 60KB보다 작다, 로컬 처리 확인)
  - 받은 글꼴은 다시 들어와도 받지 않고(글꼴 요청 0개), `caches.delete('justusing-data-v1')` 뒤에는 "지워졌습니다"를 보여 준다
  - 목록과 다른 글꼴 파일(바꿔치기)은 쓰지 않고, 정상 응답으로 다시 받으면 쓸 수 있다 (손상본을 보관하지 않음)
  - 내 글꼴(`tests/fixtures/abc.otf`, A·B·C만 있음)을 올려 쓰고, 글꼴에 없는 글자를 알린다. 다시 올리면 결과를 버린다
- `tests/e2e/pdf-ocr.spec.ts`
  - 받은 데이터는 다시 받지 않고, 보관본이 지워지면 몰래 받지 않고 다시 묻는다 (실행 버튼 꺼짐)

### 직접 확인

- 2026-10-15: 격리 frame에서 브라우저 캐시가 방문마다 비워지는 것을 크롬에서 확인 (이 구조를 만든 이유)

### 히스토리

- [history.md](./history.md): PR #47의 커밋과 리뷰 지적 12개(경쟁 상태, 손상본 보관, 예약 글꼴 이름)
