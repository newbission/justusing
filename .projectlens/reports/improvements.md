# Project report

Generated UTC: 2026-11-05T07:16:55Z

- Mode: fix
- Scope: 점검 후 워커 복구·접근성·검사 범위·호환 보안 업데이트·WebKit smoke
- Source fingerprint: facb332443014a041af07980245f41d7da5533c898641f7a27926128438a339e
- Selected checks: verified
- Whole-project structural gate: not passed

Selected check verification is not mode completion or whole-product acceptance. Review findings and unverified areas still require assessment.

## Check evidence

- C-BUILD: pass; artifact: .projectlens/evidence/1793862650794701000-c7a6a4a4.log
- C-TYPES: pass; artifact: .projectlens/evidence/1793862650795371000-a6afba1c.log
- C-FORMAT: pass; artifact: .projectlens/evidence/1793862650796436000-1bb2edd9.log
- C-DEPS: pass; artifact: .projectlens/evidence/1793862650787996000-0fd4b31a.log
- C-RECOVERY: pass; artifact: .projectlens/evidence/1793862676857862000-7400918d.log
- C-WEBKIT: pass; artifact: .projectlens/evidence/1793862724935833000-f7030439.log
- C-VISUAL: pass; artifact: .projectlens/evidence/rotation-mobile-recovered.png
- C-SYSTEM: pass; artifact: .projectlens/evidence/1793862698220447000-7c5895ef.log

## Consolidated review findings

No persisted independent review results. This does not establish absence of defects.

## Whole-project gate problems

- Planning baseline has no recorded acceptance source

## Interpretation and next actions

Mechanical snapshot only. The agent must add inspected scope/exclusions, actual review coverage, ranked findings, changes, limitations, and next actions before delivering this report.


## 에이전트 종합 보고

2026-11-05 · `codex/fix-audit-recovery` · HEAD `71bf4aa5` + 현재 미커밋 변경. 근거 fingerprint: `facb332443014a041af07980245f41d7da5533c898641f7a27926128438a339e`.

### 결과와 범위

앞선 점검에서 재현한 두 결함을 고쳤다. 첫 워커 스크립트 요청 실패를 보관하던 Promise와, 워커 실행 오류를 받지 않던 요청 대기가 원인이었다. 조립 한 곳만 고치지 않고 같은 패턴인 PDF 수정·글자 넣기·이미지 PDF·ZIP까지 공통 요청 관리자(`src/lib/worker-client.ts`)를 적용했다.

- 다운로드 실패 뒤 같은 파일/설정에서 다시 실행하면 새 요청으로 결과를 만든다.
- 워커 `error`/`messageerror`는 해당 워커를 끝내고 대기 요청을 모두 실패로 끝낸다. 다음 실행에서 새로 만든다. 동기 postMessage 실패도 대기 요청을 정리한다.
- 진행률, 요청 ID별 응답, 작업 오류와 없는 글자 오류, ZIP의 버퍼 전송은 유지한다. 자동 재실행이나 임의 시간제한은 추가하지 않는다.
- PDF 합치기/이미지를 PDF로의 파일 행을 이름 있는 group으로 표시해 Svelte 접근성 경고 2개를 없앴다. 기존 ↑↓ 버튼은 유지했다.
- 포맷 검사에서 다른 Claude 작업트리와 생성 증거/보고서를 제외했다. 다른 작업트리 파일은 고치지 않았다.
- npm audit 호환 업데이트를 잠금 파일에 반영했다. package.json의 범위와 고정된 처리 엔진 버전은 바꾸지 않았다.
- WebKit smoke를 기본 E2E 및 CI에 포함했다. 배포 출처의 요청을 로컬 빌드로 중계하며, 제품의 sandbox/CSP는 넓히지 않았다.

### 실제 검증

- 수정 전: 조립 워커의 다운로드 실패/실행 오류 테스트 2개가 기존 코드에서 실패했다. `.projectlens/evidence/1793862287909995000-921ac187.log`에 보존했다.
- 수정 후 복구 E2E: 다섯 경로 × 두 실패 + 조립의 합성 messageerror/동기 전송 오류 = 12개. 결과 PDF/ZIP을 직접 열어 페이지 수·회전 각도 등을 검사했다. 증거: `.projectlens/evidence/1793862676857862000-7400918d.log`.
- WebKit smoke 3개: opaque frame과 바깥 DOM 격리, connect-src 위반 이벤트, 회전 PDF 각도, 변환 JPG 형식/크기, 한글 PDF의 실제 렌더링과 스타일. 증거: `.projectlens/evidence/1793862724935833000-f7030439.log`.
- Chromium 전체 E2E는 **481개 통과, 7개 건너뜀(광고 차단 안내가 설정상 꺼짐)**, WebKit smoke는 **3개 통과**다. 성능 예산도 통과했다. 상세 결과는 위 검사 스냅샷 및 `.projectlens/evidence/1793862698220447000-7c5895ef.log`에 있다. 파일 유출 방지 검사도 기존 공통 fixture로 모든 E2E 종료 때 실행했다.
- npm ci 후 빌드, 타입, 전체 포맷, `npm audit --audit-level=moderate`를 실행했다. Svelte 오류/경고 0개이며 clipboard의 기존 deprecated API hint는 대체 복사 경로를 위해 유지한다.
- 390×844 모바일에서 첫 요청 실패 → 활성 실행 버튼 → 같은 파일/설정으로 재실행 → 다운로드 결과를 확인했다. `.projectlens/evidence/rotation-mobile-error.png`, `.projectlens/evidence/rotation-mobile-recovered.png`는 에이전트의 실제 관찰이고 사용자 인수는 아니다.

### 실패 분류와 한계

- C-RECOVERY 최초 실패: 구현 결함. 실제 조립 워커의 첫 다운로드 차단/실행 예외로 재현한 뒤 수정했다.
- C-WEBKIT 최초 최종 검증 시도: 환경 실패. 별도 Wrangler 서버 두 개의 동시 시작에서 SQLite SQLITE_BUSY_RECOVERY로 브라우저 검사가 시작되지 않았다. Chromium 검사가 띄운 서버를 공유하자 3개가 통과했다. 단일 `npm run test:e2e`도 기본적으로 서버 하나를 공유한다. 실패 증거를 지우지 않았다.
- npm 감사는 높음 2/보통 3/낮음 3에서 낮음 3(deepmerge와 두 의존 경로)으로 줄었다. 남은 수정 제안은 @astrojs/svelte 0.1.2로 강제 다운그레이드라 적용하지 않았다. 업스트림 호환 패치가 나오면 갱신할 항목이다. 감사 기준을 moderate로 명시했으며 낮음 항목이 없어진 것으로 주장하지 않는다.
- 이번 WebKit 검증은 Playwright smoke다. 실제 Safari/아이폰, WebKit의 모든 도구, 실제 광고·외부 서비스는 검증하지 않았다.
- pdf.js/압축/OCR/그 밖의 이미지 워커 생명주기는 이번 공통 요청 관리자 적용 범위가 아니다.
- 제품 전체 기준 및 사용자 인수는 이번 요청에서 새로 확정하지 않았다. baseline.accepted=false를 유지하므로 전체 제품 gate와 이번 수정 범위 검사의 완료를 구분한다. 문서 등록은 유효하지만 새 명세는 에이전트 작성 초안이다.

### 변경 파일과 다음 행동

소스: `src/lib/worker-client.ts`, PDF 요청 모듈 4개, `src/lib/zip.ts`, PDF 파일 행 2개. 검증: `worker-recovery.spec.ts`, `webkit-smoke.spec.ts`, Playwright/CI 설정, prettierignore. 의존성: package-lock.json. 문서: PDF/frame 공통 README와 수동 히스토리 요약, process README, merge/from-image README, ProjectLens 상태·명세·증거·인계.

배포·커밋·PR·외부 서비스 변경은 하지 않았다. 다음 행동은 변경 diff를 검토해 작은 단위로 커밋/PR을 만드는 것이다. 이후 실제 Safari/아이폰 확인과 남은 낮음 의존성의 호환 패치 추적은 별도 검증으로 남긴다.
