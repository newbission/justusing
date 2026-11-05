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
