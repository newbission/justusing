# 홈 상단 재기획·구현·배포

쓴 날 2026-11-14 · 고친 날 2026-11-19 · 상태: 운영 배포·main/dev 동기화 완료

## 범위와 기준

사용자 요청: 실제 운영 사이트8~12개를 데스크톱·모바일로 직접 조사하고, 서로 다른2~3구성안을 비교해 홈 상단을 새로 판단한다. 기획·구현·검증을 별도 에이전트로 나눈다. 중요한 미정 결정이 없으면 자율 진행하며 검증·독립리뷰 뒤 커밋·PR·운영배포·브랜치동기화까지 완료한다. 이는 구현/배포 권한이며 최종 사용자 시각 인수와 구별한다.

기획 planning, 구현 implementation, 독립검증 verification, 통합/최종실행 root. 요구/체크 R-HOME-REFERENCE, C-REFERENCE-*.

## 보존한 기존 상태

작업 시작 브랜치 docs/home-value-deployment-record, HEAD a373bf14, 깨끗한 작업트리. 별도 tool-chaining 작업트리는 수정하지 않는다. 원격 fetch 뒤 origin/dev ed286eeb에서 feat/home-reference-redesign을 만들고 기존 운영배포 증거 커밋 a373bf14를98dc6a04로 cherry-pick해 보존했다. 운영사이트는 site.config.ts의 siteUrl에서 확인했고, 실제 IAB 첫 화면에서3질문→H1→장황한 소개 흐름을 관찰했다. 기존 사진비교의 실제수치, 대표4장면과 각장면 첫노출1회자동/이후수동은 보존대상.

## 개편 전 성능

프로덕션 빌드 성공. Node24.13.0, 로컬Chrome, Wrangler8852, scripts/perf/measure.mjs로1280×800 첫화면 측정(저장소 성능예산과 같은 gzip분류; 글꼴은WOFF2원본 기준).

| 언어 | HTML | CSS | 글꼴 | 그림 | 요청 |
| --- | ---: | ---: | ---: | ---: | ---: |
| KO |21.7KB|10.2KB|103.2KB|98.0KB|11|
| EN |20.4KB|10.2KB|36.0KB|62.9KB|8|

근거: ../evidence/home-reference-baseline-perf.txt. 새 런타임JS/큰라이브러리/모델수신 없이 기존 홈 상한을 먼저 유지한다.

## 검증 및 배포

최종 실행 뒤 아래에 실제 결과를 기록한다. 이전 범위의 pass는 역사적 기록이며 현재소스 검증으로 간주하지 않는다. 전체프로젝트 baseline 인수는 별개로 남겨 둔다.

## 구현 및 중요한 지적의 반영

선정 B안을 적용했다. 3질문/3열과 반복 무료 소개를 제거하고 효용+기기 내 파일 처리의 H1, 구체 작업 예·무료 조건·대표4개 실제 도구 링크와 정적 경계 도식을 함께 배치했다. 아래 두 원리 설명과 읽히는 자료 수신 안내 다음에 실제 사진 결과와 기존4장면/도구목록이 이어진다. 자료는 공개 엔진·모델·언어 자료이고, 큰 묶음만 용량과 받기 선택을 안내한다. 사용자 파일 흐름과 별도 앱 설치를 구별한다.

- 기획 결과: [10개 운영사이트 직접조사와 선택](./home-research.md), [세안 와이어](../home-reference-wireframes.html), [독립 기획 리뷰](./home-reference-planning-review.md).
- root/구현자 시각 점검에서 자료 박스의 공용 guide-note 스타일 충돌로 padding이0/제목이커지는 문제를 발견해 독립 스타일로 수정했다.
- 독립 검증에서 밝은 accent-soft 배경 위 muted 본문 대비4.00:1을 확인했다. .proof-outside와자료안내본문을기존 color-text토큰으로 바꾸고 실제색/조상배경합성대비>=4.5를검사하는영구E2E를추가했다. 특정토큰색을기대값으로복사하지않는다.
- 실제 사진576.7KB→99.5KB, 대표4장면과 첫노출1회자동/이후수동, 광고위치/간격, 격리sandbox/CSP/Worker/처리다운로드경로는보존한다.
- 새 런타임JS/의존성/이미지/모델요청없음. 본문글꼴을새한영문구로재생성했고성능예산을올리지않았다.

## 검사 과정의 실패·중간 결과 구분

초기기획캡처에서Squoosh의내부스크롤을window스크롤로잘못해다음영역이같았으나, 실제소개/보안영역까지이동해추가캡처했다. PairDrop정보선택자도실제link로고쳐확인했다. 원인과보완캡처는조사보고서에남겼다.

병렬시각확인중재build로영어390px에서일시응답실패, WebKit noJS DOM0실패가있었다. 서버복귀/고정빌드에서재실행해통과한결과와구별한다. 초기root타깃E2E는74통과/7설정상제외(2.7분)였지만그중대비수정이들어가sourcefingerprint변경을감지해harness가fail로기록했다(1794586646902261000-9c0c0d6e). 이기록을최종pass로재분류하거나삭제하지않으며, 최종동결소스의새실행결과로판정한다.

최종품질검사 C-REFERENCE-QUALITY: 포맷/type/build/diff모두통과(1794586823726900000-66e6817c, fingerprint c001849a116e8d5ba920930589f9902359220214c5260765231504c4b4d36b8d). 타입0error/0warning, 기존폐기예정API hints4건. 빌드268pages/CSP해시정상. libheif/Tesseract의기존Node모듈외부화안내는이번홈변경과무관하다.

최종타깃 C-REFERENCE-E2E는75개통과/광고안내설정상7개제외(2.5분), 근거1794607270399424000-69e0f296. C-REFERENCE-VISUAL/RESEARCH도같은c001849a...지문에서통과기록. [검증결과와지적반영](./home-reference-verification.md)에독립에이전트실행/한도/마지막root재검증을구별했다. root최종36렌더와12접근성통과, 색상수정본문대비light13.02/dark11.81.

최종전송실측은KO HTML21.5/CSS10.2/글꼴102.8/그림98KB11요청, EN20.2/10.2/36/98KB10요청. 기존홈CSS10.5KB/그림170KB/18요청상한을유지한다. 같은lazy그림이라도새상단배치에따라첫화면에받는범위가달라지므로언어간그림요청수를기능동일성으로일치시키지않는다.

현재로컬구현·기획리뷰·필수접근성수정·회귀완료. 다음은소규모커밋→현재head Codex리뷰+CI의기능PR→dev rebase→main squash+배포→main을dev로merge→운영확인이다.

## PR 리뷰 보완

PR #168의head3eabcb72 리뷰에서기획와이어HTML의CSS시스템색(GrayText/Canvas/CanvasText/ButtonFace)도색토큰규칙을따르라는지적1건을받았다. 같은파일의모든색지정을찾아src/styles/tokens.css를직접불러오고공통변수로바꿨다. 문서기본head구조도명시했다. 운영앱소스변경없음.

wireframe-token-review.mjs가리뷰대상옛커밋의직접색지정을재현하고수정본토큰사용을검사하며,실제Chrome두테마에서3안렌더/오류없음을확인했다. 최초검증에서prettier가나눈title태그때문에스타일시트link치환이빠진것을잡았고head를명시해수정했다. 최종light배경rgb246/246/244·글자30/30/30, dark배경21/21/21·글자228/228/225로공통토큰과일치했다. 로그/두테마캡처는evidence/home-reference/wireframe-token-*에보존했다. 수정커밋현재head로Codex재리뷰와CI를다시받는다.

## 최종 독립 검토 보완

[후속 독립 검토](./home-reference-final-independent-review.md)가 실제로 마감되어 있음을 재개 시 확인했다. 독립 담당은 마지막 두 스타일과 자료 박스 여백, 한영 바로가기의 실제 처리·다운로드 및 격리, 두 테마 대비 회귀 3개(3.5초), 최종 4개 렌더를 재확인해 배포 차단 지적이 없다고 기록했다. 앞선 root 대행 이력은 역사적 기록으로 보존하며 후속 독립 결과와 구별한다.

## 운영 배포 — 2026-11-19 재개

PR #169의 현재 head `ee937a9e`는 CI 538개 통과·광고 안내 설정상 7개 제외(11.0분)로 성공했다. 재개 시 같은 head와 원격 상태, 로컬 앱·테스트 트리 일치를 확인한 뒤 main에 squash 병합했다. 운영 SHA는 `9ae341f3c12ecb5779a14560a3670b34a6e1368d`다. 곧바로 main→dev PR #170을 만들었고 CI `44487388105/job135434143934`를 확인 중이다. 동기화 PR에는 저장소 규칙대로 Codex 리뷰를 추가 호출하지 않았다.

Cloudflare Workers Builds `61ba0382-75a6-4814-a9ca-075146a28b25`의 성공을 GitHub check-run에서 확인했다. 전환 직전 첫 HTTP 검사는 옛 H1을 감지했으며 `home-reference-production-before-deploy.log`로 보존했다. 빌드 성공 후 재검사에서 실제 운영 한영 HTML 200·text/html·첨부 헤더 없음, 새 H1·도식·소개 순서·대표 장면과 참조 자산 KO 12개/EN 11개 모두 200을 확인했다. 운영 버전과 로컬 src/tests 트리도 같다.

실제 운영 Chromium+WebKit **58개(1.5분) 모두 통과**했다. 범위는 한영 홈, 390·320px의 두 테마, JS 없는 화면, 전체 도구 42개, 새 바로가기의 키보드 진입, 실제 100KB JPG 처리와 Blob 다운로드, 파일명 요청·제목 미노출, opaque 격리, 안내 대비, 대표 장면의 첫 노출 단회 자동·이후 수동·정지/재개다. 근거는 `home-reference-production-e2e.log`와 `home-reference-production.config.ts.txt`다.

root는 실제 운영 IAB에서 KO1280 light/390 light의 첫 화면과 자료 안내·사진 연결, EN320 dark의 시작점과 줄바꿈을 직접 확인했다. 임시 viewport를 복원하고 한국어 밝은 운영 홈을 결과 탭으로 유지했다. 별도 운영 캡처는 `home-reference-production-ko-1280-light.png`, `ko-390-light.png`, `en-320-dark.png`, `mobile-detail.png`다. 실제 사용자 폰·네이티브 Safari 인수를 받았다고 주장하지 않는다.

운영 이후 증거와 해당 기반 history 갱신은 `docs/home-reference-deployment-record` 브랜치에 보존한다. 앱을 추가 변경하거나 두 번째 배포를 일으키는 수정은 없다. 동기화 PR #170도 CI 538개 통과·설정상 7개 제외(13.9분) 후 merge commit `50c6ba29dbabba2d80a7ea37bf5671b1d1056cc2`로 병합했다. main이 dev의 조상이며 두 파일 트리는 `413f8269277fefd34eda59a387c8110294c7e962`로 동일하다. 로컬 main/dev도 비강제 fast-forward로 원격과 맞췄다.


## 마감 판정

요청한 조사·재기획·구현·독립 검증·현재 커밋 Codex 리뷰·기능/배포/동기화 CI·운영 배포·운영 검증·원격과 로컬 브랜치 동기화를 완료했다. 기능/배포/동기화 CI는 각각 538개 통과·기존 광고 안내 설정상 7개 제외다. 운영 버전은 `9ae341f3`, dev는 `50c6ba29`이며 앱 코드와 전체 파일 트리가 같다.

변경 범위 검증과 배포 완료를 전체 프로젝트 사용자 인수와 혼동하지 않는다. ProjectLens의 이전 전체 프로젝트 baseline/체크는 역사적 상태로 남는다. 배포 뒤 문서·증거 브랜치에는 운영 코드 변경이 없으며 추가 배포하지 않는다. 필수 잔여 작업은 없고 다음 작업은 사용자 피드백 또는 새로운 요청이 있을 때 최신 origin/dev에서 시작한다.

최종 보고서 생성 중 ProjectLens가 evidence 루트의 운영 상태 JSON을 검사 기록으로 읽어 `time_ns` 누락 오류를 냈다. 운영 상태 파일을 이전 배포 기록과 같은 `.txt` 이름으로 옮기고 릴리스 체크를 새 경로로 다시 기록했다. 운영 상태 내용이나 앱 코드를 바꾸지 않은 기록 분류 수정이다.
