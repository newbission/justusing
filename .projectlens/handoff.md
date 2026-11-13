# 점검 후 개선 인계

2026-11-05 · 브랜치 `codex/fix-audit-recovery` · 시작 HEAD `71bf4aa5` · 미커밋 변경.

## 목표와 기준

사용자가 앞선 점검 보고서 뒤 “부족한 부분 개선해보자”라고 요청했다. 워커 복구 두 결함, 같은 패턴의 PDF/ZIP 공통 처리, 접근성/포맷 검사, 호환 보안 업데이트와 WebKit smoke를 개선했다. 범위와 수용 기준은 [spec.md](spec.md), canonical 문서는 state.json documents 목록에 있다. 실행 허가와 최종 제품 인수는 구별해 baseline.accepted=false를 유지했다.

## 완료

- `src/lib/worker-client.ts`: 실패한 워커 시작을 보관하지 않고 실행/메시지 오류에서 대기 요청을 끝내며 다음 실행에서 새 워커를 만든다. 동기 전송 실패도 정리한다.
- 적용: `src/lib/pdf/{assemble,modify,text-pdf,images-to-pdf}.ts`, `src/lib/zip.ts`. 파일·설정·요청 ID·진행률·작업 오류 해석·ZIP 전송을 유지한다.
- PDF 합치기/이미지 PDF의 파일 행에 이름 있는 group을 부여해 Svelte 경고 2개를 없앴다.
- prettierignore에서 Claude 작업트리 및 생성 증거/보고서를 제외했다. 다른 작업트리는 수정하지 않았다.
- package-lock.json의 호환 보안 업데이트. 감사 결과 8건(높음 2/보통 3/낮음 3) → 낮음 3건.
- WebKit smoke 3개와 CI 브라우저 설치, 복구 E2E 12개를 추가했다. 배포 CSP·sandbox는 그대로다.
- 관련 PDF/frame README·수동 히스토리 요약, process, merge/from-image README와 ProjectLens 명세/증거/보고서를 갱신했다.

## 실행과 결과

- 수정 전 회귀: 조립 워커 다운로드/실행 오류 테스트 2개 실패 → 증거 `evidence/1793862287909995000-921ac187.log`.
- `npm ci`: 잠금 파일로 설치 성공.
- `npm run build`, `npm run check`, `npm run format:check`: 통과. 타입/Svelte 오류·경고 0개. clipboard의 기존 폐기 예정 API hint 1개는 대체 복사 경로라 유지.
- `npm audit --audit-level=moderate`: 종료 0. 낮음 3건은 남아 있다.
- `PLAYWRIGHT_CHANNEL=chrome E2E_PORT=8890 npx playwright test tests/e2e/worker-recovery.spec.ts --project=chromium --workers=2 --output=test-results/recovery`: 12개 통과.
- `PLAYWRIGHT_CHANNEL=chrome E2E_PORT=8910 npm run test:e2e -- --project=chromium --workers=4 --output=test-results/chromium`: 481개 통과, 7개 건너뜀(꺼진 광고 차단 안내); 성능 예산·로컬 처리 검사를 포함한다.
- `E2E_PORT=8910 npx playwright test --project=webkit-smoke --workers=1 --output=test-results/webkit`: 3개 통과. Chromium의 서버를 공유해 실행했다.
- 모바일 390×844: 첫 요청 실패 후 같은 파일/90도 설정으로 재실행해 다운로드 결과 확인. `evidence/rotation-mobile-{error,recovered}.png`를 실제로 보고 C-VISUAL에 기록했다. 사용자 인수는 아니다.
- ProjectLens docs: 등록 파일/관계 누락 없음. report: scoped_check_result=verified. gate: 모든 검사 pass, 제품 전체 기준에 대한 사용자 인수 기록 없음만 남는다.

## 실패 분류와 한계

C-RECOVERY 최초 실패는 구현 결함이며 수정 후 증거가 있다. C-WEBKIT 첫 최종 시도는 동일 저장소에서 Wrangler dev 두 개를 동시에 시작해 발생한 SQLite `SQLITE_BUSY_RECOVERY` 환경 실패였다. 브라우저 검사가 시작되지 않았고, 서버 하나를 공유해 재실행하자 통과했다. 기본 npm test:e2e도 서버 하나를 공유한다. 실패 증거는 보존했다.

낮음 3건은 deepmerge와 Astro Svelte/Vite 의존 경로다. npm이 제안하는 강제 수정은 @astrojs/svelte 0.1.2로 다운그레이드라 적용하지 않았다. 실제 Safari/아이폰, WebKit 전체 도구, 실제 광고 동작은 검증하지 않았다. pdf.js/압축/OCR/그 밖의 이미지 워커의 별도 생명주기는 이번 적용 범위가 아니다.

## 현재 작업과 다음 행동

요청 범위의 구현·검증·보고 완료. 상세 보고서: [reports/improvements.md](reports/improvements.md). 커밋·PR·배포는 하지 않았다.

다음 정확한 행동: 변경 diff를 검토하고 저장소 규칙에 맞게 작은 단위로 커밋/PR을 만든다. 필요할 때 `npm run build` 후 `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`로 두 브라우저 구성을 한 서버에서 재검증한다. 배포 단계에서는 실제 Safari/아이폰 확인을 별도로 수행한다. 남은 낮음 의존성은 호환 업스트림 패치가 나올 때 갱신한다.

## 커밋·배포 후속 요청 (2026-11-05)

사용자가 “커밋 및 배포 진행해”라고 승인했다. CLAUDE.md와 process 규칙에 따라 코드·테스트·문서를 14개 커밋으로 나누고 원격 dev 82054564 위로 rebase했다. 날짜 충돌 두 곳은 원격의 기능 설명을 보존하고 2026-11-05 수정 날짜를 적용했다. PR #159를 dev 대상으로 만들었고, 초기 head ae5445a에 Codex의 주요 문제 없음 응답이 왔다. 새 head는 반드시 다시 리뷰받는다.

최신 통합본에서 npm ci·빌드·타입·포맷·README 목록 검사가 통과했다. 전체 실행에서는 Chromium 506개 통과/7개 설정상 제외였으나 WebKit 3개가 Chrome 채널 상속으로 시작 실패했다. 이는 테스트 설정 결함이다. 채널을 Chromium 프로젝트로 옮긴 뒤 PLAYWRIGHT_CHANNEL=chrome을 유지한 WebKit 3개가 통과했다. 복구 12개와 두 프로젝트를 함께 실행하는 추가 검증 및 최신 CI를 진행한다. 과거 보고서의 481/3 통과 기록은 통합 전의 역사적 증거다.

다음: 최신 PR head의 Codex 리뷰·CI 통과 → rebase merge로 dev 반영 → dev→main PR의 CI 통과 후 squash merge → 즉시 main→dev PR을 merge commit으로 반영 → Cloudflare Workers Builds 성공과 실제 사이트의 새 자산·파일 처리 확인. 배포 설정은 이미 연결되어 있어 새 수동 설정은 하지 않는다.

추가 재검증: PLAYWRIGHT_CHANNEL=chrome을 유지한 단일 E2E 실행에서 복구 12개 + WebKit 3개 = 15개가 통과했다. 증거는 evidence/browser-channel-recovery.log. 전체 통합 E2E의 Chromium 506개 통과와 별개로 채널 상속 결함을 재현하고 고친 증거다.

## 홈 화면 개편 (2026-11-12 시작, 2026-11-13 재개)

사용자가 사진과 실제 결과가 보이는 홈페이지 개편을 맡겼다. `origin/dev` c6071ea7에서 `codex/home-refresh`를 만들었고 기존 제품 변경은 없던 상태였다. 계획·기준은 `.projectlens/home-refresh.md`이며, 관리자 대시보드는 추가하지 않는다.

구현: 한영 홈의 짧은 소개와 직접 진입, 실제 사진 처리 전후(576,710→99,486바이트), 대표 도구 6개, 전체 42개 도구의 한 줄 요약·카테고리 이동, 간결한 안전 안내와 가이드 링크. 사진은 Patrick Pahlke/Unsplash License로 직접 호스팅하고 실제 도구로 만든 결과이며 생성 스크립트와 출처를 `scripts/home/`에 남겼다. 새 런타임 JS·통계·격리 정책 변경은 없다. 홈 이미지 예산만 실제 사진 2장에 맞춰 64KB로 설정했다.

검증 중 발견한 변경 전 영어 제목/홈 애니메이션 기대값과 대표 링크 중복 선택을 수정했다. 홈이 짧아지면서 글꼴 조각이 흩어져 PDF 합치기 수신량이 상한 155KB를 넘는 문제는 카테고리 목록 글자도 core에 묶어 해결했다(156.2→127.4KB). 실패 증거는 보존했다.

타입·포맷·프로덕션 빌드는 통과했다. 관련 E2E의 마지막 통합 실행은 `.cache/home-refresh/e2e-complete.log`와 C-HOME 기록을 확인한다. 실제 브라우저의 데스크톱·390×844 모바일과 두 테마를 확인했고 최종 라이트 화면은 `.projectlens/evidence/home-{desktop,mobile}-light.png`에 있다. 성능 실측은 `evidence/home-performance.log`. 새 빌드 뒤 기존 IAB 탭이 반응하지 않아 새 탭으로 다시 확인했고 새 탭에서는 테마 전환이 정상 동작했다.

로컬 미리보기: `http://127.0.0.1:4322/` (Wrangler 서버). 커밋·PR·배포는 하지 않았다. 다음 정확한 행동은 마지막 E2E 통과를 확인하고 scoped report를 기록해 화면과 함께 사용자에게 전달하는 것이다. 전체 도구 E2E 재실행·실제 아이폰·실광고 검증은 이번 범위에 포함하지 않는다.

### 홈 개편 최종 확인 (2026-11-13)

C-HOME: Chromium55 + WebKit smoke3 = 58개 통과, 꺼진 광고 안내7개 제외(2.6분). C-HOME-QUALITY: 포맷·타입·프로덕션 빌드 통과. 두 검사 모두 현재 fingerprint로 pass이고 scoped report는 verified다. 상세 결과는 `reports/home-refresh.md`, 기계 스냅샷은 `reports/1794497024111498000-528de6c4.{md,json}`. 문서 인덱스 문제 없음. 사용자에게 로컬 화면을 전달할 준비를 마쳤고 필수 구현·검증 작업은 남지 않았다. 커밋·PR·배포는 하지 않았다. 다음 선택 작업은 시각 피드백 반영 또는 저장소 절차에 따른 커밋·리뷰·배포다.

## 대표 기능 시각 예시 확장 완료 (2026-11-13)

사용자가 사진 줄이기 예시를 마음에 들어 하며 대표 기능을 선별해 같은 식으로 보여 달라고 요청했다. 기존 첫 화면을 유지하고 아이콘 빠른 링크를 실제 결과6개(배경 제거·사진 자르기·사진 PDF·PDF 합치기·가로 잇기·영구 가리기)로 바꿨다. 한영·PC2열/모바일1열과 도구 연결, `#examples` 바로 이동을 제공한다. 파일 처리·격리·광고 정책은 바꾸지 않았다.

실제 도구 생성 스크립트와 PyMuPDF 검증·렌더링, 전후 배치 스크립트를 `scripts/home/`에 추가했다. 새 해안/꽃 사진은 허가·출처를 기록해 직접 호스팅한다. 생성 시 이미지 크기·투명도·PDF 쪽 수와 가린 글자가 결과에 없는지 확인했다. 사진 예시6개를 더해 이미지 예산을170KB, 요청18회로 조정했다(실측 그림143.5KB/총15요청, 별도JS 없음). 최초 공개 자산명 photos가 개인정보 테스트 기준 파일 이름과 겹치는 문제는 album으로 바꾸고 검사 기준을 유지했다.

C-SHOWCASE-QUALITY: 포맷·타입·빌드 통과. C-SHOWCASE: Chromium61+WebKit smoke3=64개 통과, 꺼진 광고 안내7개 제외. 문서 인덱스와 diff 검사 통과. 결과는 `reports/home-showcase.md`와 `reports/1794498984531251000-d4da9dfe.{md,json}`. 실제 브라우저·테일스케일에서 새 화면을 확인했고 예시 전체 캡처는 `evidence/home-showcase-gallery.webp`, 모바일은 `home-showcase-mobile-{en,ko-dark}.png`다. 기존 미리보기 서버4322와 테일스케일 HTTP4323은 계속 제공 중이다. 사용자 폰의 실제 접속은 대신 확인하지 않았다.

요청한 구현·검증·미리보기 반영은 완료했다. 커밋·PR·정식 공개 배포는 하지 않았다. 다음 선택 작업은 디자인 피드백 반영 또는 저장소 규칙에 따른 커밋·리뷰·배포다.

## 주요 동작 장면 재구성 (2026-11-13 진행)

사용자는 이미지→PDF가 사진2장처럼 보이는 의미 오류와 동급 카드 나열을 지적하고 기획·구현·검증 에이전트의 역할분리를 명시했다. 기획 담당 /root/planning이 `home-motion-plan.md`에4개 장면과 한영 문구·수용기준을 작성했고, /root/implementation이 소스·실제 출력 sprite·제어 코드를 담당, /root/verification은 별도 edge E2E와 실제 raw 출력 확인을 담당한다. root는 문서/상태·CUA 시각 확인·통합 검증을 맡는다.

1차 실제 CUA 모바일390dark/영문light 및 데스크톱light에서 단일PDF3쪽과 장면 구조를 확인했다. 기획자는 실제 캡처를 따로 열어 구성·문구가 목표에 맞는다고 검토했다(`reports/home-motion-planning-review.md`). 독립검증자는 재개 때 두 장면 동시실행 결함을 찾아 구현자에게 수정요청했고 회귀를 추가했다. root는 합치기의 입력4쪽 라벨이 종이에 덮이는 문제를 찾아 수정요청, 기획자는 단계 글자를11px로 늘리도록 요청했다. 현재 마지막 시각 수정과 CSS기존10KB예산 최적화 후 최종build/freeze를 기다린다. 중간 E2E는 현재 최종품질의 증거로 재사용하지 않는다.

미리보기는 launchd transient job `com.justusing.home-preview`로 Wrangler4322를 실행하고 Tailscale4323이 중계한다. 다른 작업의 Serve포트는 건드리지 않았다. 최종build뒤 HTTP200/text-html/최신장면 확인이 필요하다. 공개 배포·커밋·PR은 하지 않는다. 다음 정확한 행동: 최종freeze신호→포맷/타입/build→관련 통합E2E→수정본 CUA 캡처/독립검증 최종결과→scoped report와 사용자 홈주소 전달.

### 주요 작업 장면 최종 검증 완료 (2026-11-13)

사용자 위임 범위의 구현·별도 기획/검증·미리보기 반영을 마쳤다. 구현 담당의 마지막 CSS감축은 장식효과/중복scope를 줄여 기존 상한10KB를 그대로 유지했다(10,096바이트). 입력보고서4쪽 라벨 가림과 단계11px 수정본을 실제 CUA390px에서 다시 확인했고 최종4장면 캡처는 `evidence/home-motion-gallery.webp`다. 영어모바일light 캡처와 한국어 최종합치기 캡처도 남겼다. 폰에서 열 홈은 기존 테일스케일 중계의 루트주소이며 #examples가 붙은 별도예시페이지로 안내하지 않는다. HTTP200/text-html/첨부헤더없음 및 실제 렌더 확인.

C-MOTION-QUALITY pass: 포맷·타입·프로덕션build·diff, 근거1794525119123770000-9e57cfee. C-MOTION-E2E pass: Chromium71+WebKit smoke3=74통과, 설정상 광고안내7제외(2.6분), 근거1794525154572099000-afc65ec3. C-MOTION-VISUAL pass: root 최종캡처/독립기획·검증결과, 근거1794525212659579000-ef7a9937. 세 검사는 같은 최신fingerprint다. 독립검증자의별도 Chromium10+mobileWebKit10도통과했고 실제 PDF3쪽/합친6쪽/가린3개검색어부재 확인. 최종보고서는 `reports/home-motion.md`, 기획리뷰는 `reports/home-motion-planning-review.md`.

전체 제품 인수는 받지 않았으며 이전 작업 검사는 stale이므로 전체 gate 완료라고 하지 않는다. 현재 변경 범위의 필수 작업은 남지 않았다. 커밋·PR·정식 공개 배포는 하지 않았다. 다음 정확한 행동은 사용자 시각 피드백 반영 또는 별도 요청 시 저장소 규칙에 따른 커밋/PR/배포이며, 추가 변경 없이는 통과한 검사를 반복하지 않는다.

## 소개와 전체 도구 목록 연결 완료 (2026-11-13)

사용자 후속 요청에 따라 추가 도구 소개 문구를 도구 모아보기 바로 앞에 배치했다. 기획 담당이 CSV·소리 추출을 예로 든 한영 문구를 정하고 구현 담당이 index/ui를 최소 변경했다. 새 CSS/JS/버튼/테스트는 없고 기존 광고 위치/48px 간격/42개 도구를 유지했다. 글꼴의 '펴'를 홈 core에 포함하도록 다시 생성했다. 독립 검증은 최종 HTML 순서/42개 고유 도구/aria-describedby와 CSS9.811KB를 확인했다.

C-DIRECTORY-HANDOFF: 포맷·타입·프로덕션 build·diff 및 기존 E2E28개 통과(14.6초). 증거1794525990919996000-b410ad32. root가 실제 CUA 한영390px/한국어 데스크톱으로 연결 구간을 확인했고 캡처는 evidence/home-directory-{mobile-ko,mobile-en,desktop}.png다. C-DIRECTORY-VISUAL은 같은 최신 지문에서 pass로 기록했다. 보고서는 reports/home-directory.md. 이번의 좁은 문구/배치 범위 검증이며 앞선 모션74개는 역사적 기록이다.

필수 구현·검증·미리보기 반영 완료. 커밋·PR·정식 공개 배포는 하지 않았다. 다음 정확한 행동은 사용자 피드백 반영 또는 별도 요청 시 저장소 절차로 커밋/배포다. 추가 변경 없이는 통과한 검사를 반복하지 않는다.

## 첫 화면 노출 자동재생 완료 (2026-11-13)

사용자가 대표 장면을 처음 볼 때1회 자동재생하고 이후 수동 재생으로 바꿔 달라고 요청했고 “이어서해줘”로 계속 진행을 지시했다. 기획 담당이 stage50%/수동우선/노출재진입무반복 정책을 정했고 구현 담당이 HomeShowcase의 단일 IntersectionObserver와 페이지 내 소비 상태를 적용했다. 별도 검증 담당이 기존 home-motion-review.spec.ts를 갱신했으며 최종 실행과 실제 CUA는 root가 맡았다. 새 CSS/폰트/의존성/스토리지/성능상향 없음, scripts/home/README와 사이트구조 문서도 갱신했다.

C-AUTOPLAY-QUALITY: format/type/build/diff pass, 증거1794542363187813000-2e6936aa. C-AUTOPLAY-E2E: Chromium46+mobileWebKit12=58개 모두 통과, 증거1794542436022479000-d3d47698. 첫 노출 전 대기→첫 자동→실제정지/재개→자연종료→재진입무반복→수동 재생과 기존 홈/성능/CSP/local-only를 확인했다. C-AUTOPLAY-VISUAL: root가 실제 Tailscale IAB390px에서 클릭 없이 자동 시작, 완료, 재진입 정지 유지, 다시재생 클릭 후 재생을 직접 확인. 캡처 evidence/home-autoplay-{first-visible,reentry}.png. 세 검사는 같은 최종 지문이다.

현재 범위의 필수 구현·검증·미리보기 반영 완료. 보고서는 reports/home-autoplay.md. 실제 사용자 폰 인수·커밋·PR·정식 공개 배포는 하지 않았다. 다음 정확한 행동은 사용자 시각 피드백 반영 또는 별도 요청 시 저장소 절차에 따른 커밋/배포다. 추가 소스 변경 없이 통과한 검사를 반복하지 않는다.

## 로컬 처리 우선 홈 완료 (2026-11-13)

사용자가 로컬에서 안전하게 파일을 다루는 차별점을1순위로 요청했다. 기획 담당의 home-local-first-plan.md에 따라 첫 H1/본문·도구선택과safety CTA·기기내3단계 정적 도식을 배치했다. 구현 담당이 HomeLocalFlow/index/ui/tagline과 기존home/i18n을 갱신했고, 기존 사진/4개장면·단회auto/42개탐색은 두번째흐름으로 보존했다. 중복 하단trust와죽는CSS제거,사진lazy전환. 기획·검증 담당이 캡처/사실성/위계를 따로 확인했으며320px SVG라벨크기 개선만 추가했다. 새의존성/런타임JS/상한상향/보안경계변경은 없다.

C-LOCAL-FIRST-QUALITY pass(포맷/type/build/diff), 증거1794543823938337000-446d09d8. C-LOCAL-FIRST-E2E pass(root Chromium65개/30.1초), 증거1794543910345073000-e58bdd4b. 독립 검증자가 같은 빌드로 mobileWebKit12개/30초도 통과해 관련총77개. 로그 evidence/home-local-first-webkit.log 보존. C-LOCAL-FIRST-VISUAL은 최종 KO390·desktop·EN320 두테마의 root확인/독립리뷰를 기록했다. 캡처 evidence/home-local-first-{mobile-ko,desktop,mobile-en-320-dark}.png. 세 등록 체크는 같은 최종 지문이다. 보고서 reports/home-local-first.md, 기획 리뷰 reports/home-local-first-planning-review.md.

요청 범위의 필수 구현·검증·Tailscale미리보기 반영 완료. 실제 사용자 폰 인수·커밋·PR·정식 공개 배포는 하지 않았다. 다음 정확한 행동은 사용자 피드백 반영 또는 별도 요청 시 저장소 절차로 커밋/배포다. 추가 변경이 없으면 통과한 검사를 반복하지 않는다.

## 홈 개편 커밋·배포 착수 (2026-11-13)

사용자가 “우선 커밋했어? 배포까지 해놔”로 현재 전체 홈 변경의 커밋·원격반영·배포를 명시 승인했다. 아직 미커밋 상태였음을 알렸고 저장소 절차로 진행한다. origin/dev는 작업 기준 c6071ea7과 같아 충돌이 없다. 독립 검증/구현 담당의 read-only 릴리스 감사에서 배포 차단 문제나 비밀키/개인 파일은 발견하지 못했다. 실제 견본/compact목록/대표장면/로컬흐름/홈조합/폰트/테스트/문서를 나눠 커밋하고 기능PR→dev(rebase, 현재head Codex리뷰+CI)→main(squash,CI)→main→dev반영→Cloudflare실배포/사이트확인을 수행한다. 기존 배포 연결은 이미 되어 있어 새 수동 설정을 하지 않는다. 로컬 Wrangler는 로그인하지 않았지만 GitHub 연동 Workers Builds가 현재 운영 배포 경로라 별도 로그인은 필요하지 않다.

## 홈 개편 운영 배포 확인 (2026-11-13)

사용자의 커밋·배포 요청을 진행했다. 구현 8개 커밋을 기능 PR #162로 보내 현재 head 24f39909의 Codex 주요 문제 없음 답변과 CI 529통과/7설정상제외를 확인한 뒤 rebase merge했다. 배포 PR #163도 CI 529통과/7제외 후 squash merge해 운영 커밋 2cbe6d23으로 배포했다. Cloudflare Workers Builds 성공, 한영 홈의 새 H1·참조 자산 HTTP200 확인. 실제 운영 홈 390×844·데스크톱 캡처는 evidence/home-production-{mobile,desktop}.png다.

운영 E2E 원본은 43통과/3실패였다. 후속 동일조건 실행과 진단으로 도구 입력 준비의 5초 대기 초과, WebKit 초기 CSSTransition 집계를 구별했다. 운영 전용 진단 4개는 모두 통과했고, 실제 사진 처리·다운로드는 원래 home.spec에서 두언어·두엔진 통과했다. 전체 원본 E2E를 통과로 고쳐 기록하지 않았다. 보고서 reports/home-deployment.md와 evidence/home-production-*.log 참조. 런타임 코드는 배포 뒤 수정하지 않았다. 실제 사용자 폰·네이티브 Safari 인수는 아니다.

병합 뒤 site-structure·fonts-and-data 자동 히스토리를 갱신했고 ProjectLens docs 관계 누락 없음. 기계 보고서1794562876198023000-2e6322d9는 등록 로컬 검사 ID 미선택으로 not_assessed이며 전체 제품 인수를 의미하지 않는다. 동기화 PR #164의 최종 CI·병합 결과와 기록 커밋은 아래에 추가한다.

### 배포 마감

#164 CI도529통과/7설정상제외 후 merge commit848049c5로 반영됐다. 배포 오케스트레이션 phase=complete, 원격main은dev의조상이며 두브랜치소스트리동일. 운영main은2cbe6d23. docs/home-deployment-record 브랜치에서 배포 뒤 문서·증거만 별도 커밋/원격 보존한다. 앱을 다시 배포하는 변경은 아니다. 현재 요청 범위의 필수 작업은 남지 않았다. 다음 정확한 행동은 사용자 피드백이나 새 작업이 있을 때 origin/dev에서 기능 브랜치를 만드는 것이다. 정식 E2E의 운영 대기/전환 폴링 개선은 다음 테스트 작업의 선택 항목이다.
