# justusing 문서

쓴 날 2026-10-16 · 고친 날 2026-10-17

기능마다, 여러 기능이 같이 쓰는 기반마다 폴더가 하나씩 있다. 다른 세션(사람이든 에이전트든)이 이어서 일할 때
코드와 커밋을 처음부터 다시 읽지 않아도 되게 하는 것이 목적이다.

- 사이트 전체의 원칙·규칙·작업 방식은 저장소 맨 위 [`CLAUDE.md`](../CLAUDE.md), 리뷰 기준은 [`AGENTS.md`](../AGENTS.md)
- 여기에는 **무엇을, 왜, 어떻게 만들었고, 무엇이 틀렸다가 어떻게 고쳐졌는지**를 기능 단위로 적는다

## 폴더 하나의 구성

| 파일         | 내용                                                                                                                 |
| ------------ | -------------------------------------------------------------------------------------------------------------------- |
| `README.md`  | 1. 어떤 기능인지 · 2. 어떻게 만드는지(파일·흐름·결정과 이유·함정) · 3. 구현 체크리스트 · 4. 검증(테스트와 확인 방법) |
| `history.md` | 검증·오류·수정 히스토리. 위쪽 **요약**은 사람이 쓰고, 아래 **기록**(PR·커밋·리뷰 지적과 처리)은 스크립트가 만든다    |

새 폴더는 [`_template/`](./_template)을 복사해서 만든다.

## 문서를 고치는 때 (규칙)

- 기능을 만들거나 고치는 PR에서 **그 기능의 `README.md`를 같이 고친다** (동작·한계·파일·체크리스트가 바뀌면)
- 큰 오류를 고쳤거나 중요한 결정을 했으면 `history.md`의 **요약**에 한두 줄 더한다 (원인과 배운 점)
- PR을 병합한 뒤 기록을 새로 만든다: `node scripts/docs/history.mjs` (기록 부분만 바뀐다. `gh` 로그인 필요)
- 새 기능·기반 폴더를 만들면 `scripts/docs/history.mjs`의 `DOCS`에 커밋 영역과 PR 번호를 더한다

## 이름과 날짜 (2026-10-16)

- 파일·폴더 이름에 날짜나 순서 번호를 붙이지 않는다 (`inbox`, `pdf-redact`처럼 내용으로 짓는다)
- 날짜는 문서 안에 적는다: 문서 맨 위(쓴 날·고친 날)와, 결정·오류·확인 기록마다 `YYYY-MM-DD`
  - 맨 위는 제목 바로 아래 `쓴 날 YYYY-MM-DD · 고친 날 YYYY-MM-DD` 한 줄 (틀에 들어 있다). 문서를 고치면 고친 날을 바꾼다.
    `history.md`의 자동 기록 부분만 바뀐 때는 고친 날을 그대로 둔다

## inbox

[`inbox/`](./inbox)는 사용자에게 보여 줄 긴 글(검토 보고서, 조사 결과, 결정할 거리)을 두는 곳이다.
읽고 나서 남길 내용은 해당 기능·기반 문서로 옮기고 지운다. 안의 파일은 저장소에 올리지 않는다 (`README.md`만 올림).

## 기반 (foundations)

| 폴더                                                 | 내용                                                                                             |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [frame-isolation](./foundations/frame-isolation)     | 도구를 격리된 iframe에서 돌리는 구조, CSP, 워커 띄우기, 파일 놓기, 다운로드                      |
| [pdf-common](./foundations/pdf-common)               | PDF 도구 공통: pdf.js 열기·썸네일·쪽 그리기, pdf-lib 워커(조립·고치기·글자 넣기), 공통 화면 부품 |
| [image-common](./foundations/image-common)           | 이미지 도구 공통: 여러 장 목록 화면, 읽기·크기 바꾸기·저장 워커                                  |
| [fonts-and-data](./foundations/fonts-and-data)       | 한글 글꼴 직접 호스팅, 큰 데이터(글꼴·OCR) 받기 전 동의와 보관(Cache API)                        |
| [site-structure](./foundations/site-structure)       | 레지스트리·카테고리·허브, 레이아웃, 테마, 로고, 설정, 이용 권한(canUse)                          |
| [i18n](./foundations/i18n)                           | 한국어·영어 주소 규칙, 문구 위치, 처음 방문 언어 보내기                                          |
| [ads-and-analytics](./foundations/ads-and-analytics) | 광고 슬롯 규칙, AdSense, 광고 차단 안내, 방문 통계, 개인정보처리방침                             |
| [seo-and-guides](./foundations/seo-and-guides)       | 검색 등록·구조화 데이터·사이트맵, 가이드 글, 소개·약관 등 글 페이지                              |
| [process](./foundations/process)                     | 브랜치·커밋·PR·리뷰(Codex)·배포 흐름과 그동안 배운 점                                            |

## 기능 (features)

PDF

| 폴더                                                | 도구              | 상태 |
| --------------------------------------------------- | ----------------- | ---- |
| [pdf-view](./features/pdf-view)                     | PDF 보기          | live |
| [pdf-merge](./features/pdf-merge)                   | 합치기            | live |
| [pdf-split](./features/pdf-split)                   | 나누기            | live |
| [pdf-rotate](./features/pdf-rotate)                 | 회전              | live |
| [pdf-organize](./features/pdf-organize)             | 정리(순서·삭제)   | live |
| [pdf-n-up](./features/pdf-n-up)                     | 모아찍기          | live |
| [pdf-crop](./features/pdf-crop)                     | 자르기            | live |
| [pdf-to-image](./features/pdf-to-image)             | PDF를 이미지로    | live |
| [pdf-from-image](./features/pdf-from-image)         | 이미지를 PDF로    | live |
| [pdf-compress](./features/pdf-compress)             | 압축              | live |
| [pdf-ocr](./features/pdf-ocr)                       | 글자 인식(OCR)    | live |
| [pdf-extract-text](./features/pdf-extract-text)     | 글자 추출         | live |
| [pdf-page-numbers](./features/pdf-page-numbers)     | 쪽 번호           | live |
| [pdf-watermark](./features/pdf-watermark)           | 워터마크          | live |
| [pdf-header-footer](./features/pdf-header-footer)   | 머리말·꼬리말     | live |
| [pdf-add-image](./features/pdf-add-image)           | 이미지 넣기       | live |
| [pdf-sign](./features/pdf-sign)                     | 서명 넣기         | live |
| [pdf-edit](./features/pdf-edit)                     | 편집              | live |
| [pdf-fill-form](./features/pdf-fill-form)           | 양식 채우기       | live |
| [pdf-unlock](./features/pdf-unlock)                 | 암호 해제         | live |
| [pdf-protect](./features/pdf-protect)               | 암호 걸기         | live |
| [pdf-redact](./features/pdf-redact)                 | 가리기(영구 삭제) | live |
| [pdf-extract-images](./features/pdf-extract-images) | 사진 꺼내기       | live |
| [pdf-metadata](./features/pdf-metadata)             | 문서 정보         | live |

이미지

| 폴더                                                      | 도구             | 상태 |
| --------------------------------------------------------- | ---------------- | ---- |
| [image-compress](./features/image-compress)               | 이미지 압축      | live |
| [image-resize](./features/image-resize)                   | 크기 조절        | live |
| [image-convert](./features/image-convert)                 | 형식 변환        | live |
| [image-id-photo](./features/image-id-photo)               | 증명사진         | live |
| [image-remove-location](./features/image-remove-location) | 위치 정보 지우기 | live |
| [image-stitch](./features/image-stitch)                   | 이어 붙이기      | live |
| [image-crop](./features/image-crop)                       | 자르기·회전      | live |
| [image-mosaic](./features/image-mosaic)                   | 모자이크         | live |

텍스트·CSV

| 폴더                                              | 도구                 | 상태 |
| ------------------------------------------------- | -------------------- | ---- |
| [text-csv-encoding](./features/text-csv-encoding) | CSV 한글 깨짐 고치기 | live |
