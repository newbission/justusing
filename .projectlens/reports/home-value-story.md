# 홈 차별점 설명 확장

2026-11-13 / change / 범위: 홈의 도구 소개 앞에 사용자 고민·로컬 처리 구조·무료 범위·추가 자료 다운로드 안내를 연결한다. 새 파일 처리 기능·계정·대시보드·광고/보안 정책 변경은 제외한다.

## 바뀐 사용자 경험

설치의 번거로움, 한 번 쓰는 작업의 결제 부담, 파일 업로드 보안 고민을 첫 화면의 세 항목으로 읽는다. 로컬 처리 H1과 바로 시작 CTA에 이어, 처리 프로그램/자료를 사이트에서 기기로 받는 방향과 사용자 파일이 기기 안에서 선택→처리→저장되는 경계를 본다. 광고·통계와 도구 영역이 분리됨을 설명한 뒤 무료42개 도구/가입·별도 앱 설치 없음과 일부 자료 다운로드·모바일 데이터 소모·보관본 재수신 가능성을 안내한다. 그 아래 기존 사진/대표4개 장면/전체 도구 탐색이 이어진다.

`HomeValueStory.astro`를 추가하고 `HomeLocalFlow.astro`를 반응형 HTML 라벨·가벼운 SVG 아이콘으로 바꿨다. 한영 UI는 `ui.ts`, 도구 수/예시는 레지스트리를 사용한다. 기존 사진/대표장면·첫노출 단회 재생·광고 슬롯·iframe/sandbox/CSP·사용자 파일 처리는 바꾸지 않았다. 새 JS·이미지·모델 요청·의존성은 없다.

## 기획·검증 관찰

- 기획 담당이 실제 처리용 공개 자료 수신/무료 정책과 한영 카피를 검토했다. 첫 초안의 14px 회색 고민 목록은 주석처럼 보여 이번 요청의 공감 우선순위에 약하다고 지적했다. 16px/600/본문색·데스크톱3열·모바일3행으로 수정했고 최종 캡처3장에 추가 차단사항 없음 판정을 받았다.
- root가 실제 CUA의 KO390px/기본 데스크톱, EN320px의 밝고 어두운 테마에서 첫 CTA·자료 수신 방향·기기내3단계·무료/자료 안내를 확인했다. 도식 아이콘의 전역 SVG 표시 영향으로 생긴 정렬을 고쳤다. 실제 사용자 폰/네이티브 Safari 인수와 구별한다.
- 추가 다운로드를 앱 설치나 사용자 파일 업로드와 구별한다. 큰 OCR·배경 제거 자료의 용량 확인/선택으로 범위를 좁히며, 일반 코드까지 항상 동의를 묻거나 한 번만 받는다고 주장하지 않는다. 오프라인·완벽 보안·영구 무료 보장은 없다.
- 별도 검증 담당이 최종 소스·테스트와8개 실제 캡처를 읽기 전용으로 감사했다. 요청 순서/사실성/좁은 화면/정적 구성/보안 경계/최소 CSS 예산 조정에 차단 결함·필수 수정 요청이 없었다. 검증 담당은 빌드·테스트·Git·파일을 조작하지 않았고, 위 실행 결과는 root가 수행했다.

## 실행한 확인과 실패 기록

- 초기 타입 검사: 오류/경고0, 기존 hint4. 프로덕션 빌드 성공.
- 첫 선별 E2E:66개 중65통과. 정적 설명 추가 후 홈 CSS만 기존10KB 상한을 약0.2KB 넘었다. 옛 SVG/미사용/중복 CSS 제거 후에도 필요한 정적 설명 스타일이어서 **홈 CSS만10.5KB**로 조정하고 spec 주석과 문서에 이유를 남겼다. 최종 파일의 gzip 합계는 **10.1807KB**다. 다른 상한은 유지한다.
- C-VALUE-QUALITY: 포맷·타입·프로덕션 빌드·diff 검사 통과. 증거 [1794567619360178000-2dd7573e.log](../evidence/1794567619360178000-2dd7573e.log).
- WebKit: 소개/320·390px/두테마/JS 없음/기존 대표장면·단회 재생18개 통과(34.6초). 로컬 빌드의 홈 검사이며 실제 사용자 기기 확인은 아니다. [로그](../evidence/home-value-webkit.log), [설정](../evidence/home-value-webkit.config.ts.txt).
- CSP를 포함한 첫 최종 묶음:68개 중67통과. 사이트맵 전체 CSP 검사는 통과했으나, 별도 가이드 창 검사에서 PDF 합치기의 가이드 창이 열리지 않아 본문이 숨겨진 상태였다. 수정 없이 같은 검사를 단독 실행해 통과했다(1개/21.6초). 타이밍 문제의 정확한 원인을 확정하지 않았으며 원래 실패를 통과로 바꿔 기록하지 않았다. [실패 로그](../evidence/1794567661103649000-9b50d74d.log), [단독 재확인](../evidence/home-value-csp-recheck.log).
- C-VALUE-VISUAL: root의 실제 CUA 관찰과 기획 검토를 기록했다. [기준 캡처](../evidence/home-value-mobile-ko.png).

수정 없이 작업자2개로 실행한 최종 Chromium 묶음은 **68개 모두 통과(2.6분)**했다. 홈 소개·기존 실제 사진 처리/다운로드·대표 동작/단회 재생·한영·폰트·성능·사이트맵 전체와 별도 상호작용 CSP 검사까지 포함한다. [최종 로그](../evidence/1794567892509664000-0f536312.log). 이전 실패의 원인을 확정하거나 실패 기록을 지운 것이 아니다.

품질/E2E/시각 체크3개는 같은 최종 작업트리 지문 `c992f39716cf9d61128737b7e47b088b2feaaf688d427aff87c3205b47c5c0a7`에서 통과했다. [범위 보고서](1794568066147771000-b1436a80.md)는 scoped `verified`, whole project `false`다. 문서 관계 누락은 없다. 전체 프로젝트의 과거 계획 인수 미기록/다른 검사 stale 문제와 이번 좁은 범위의 검증을 구분한다.

커밋 뒤 지문은 달라지므로 위 로컬 체크는 구현 당시의 검증 기록이다. 아래 원격 CI가 실제 병합/배포 커밋을 검증한다.

## 화면 증거

- [첫 화면 데스크톱](../evidence/home-value-desktop.png)
- [원리·무료·데이터 안내 데스크톱](../evidence/home-value-how-desktop.png)
- [KO390 첫 화면](../evidence/home-value-mobile-ko.png), [처리 경계](../evidence/home-value-mobile-how.png), [데이터 안내](../evidence/home-value-mobile-data.png)
- [EN320 밝은 화면](../evidence/home-value-mobile-en-320.png), [어두운 화면](../evidence/home-value-mobile-en-320-dark.png), [어두운 도식](../evidence/home-value-mobile-how-en-320-dark.png)

## 커밋·리뷰·운영 배포

2026-11-13에 구현/글꼴/테스트/기획·검증 기록을4개 커밋으로 나눠 올렸다. 기능 PR [#165](https://github.com/newbission/justusing/pull/165)의 head `864f07a04939a19e02e8e7e34497f2ad135d6229`에 대해 Codex 리뷰가 완료됐고, **주요 문제 없음**을 [해당 커밋 수신증](https://github.com/newbission/justusing/pull/165#issuecomment-6851128249)으로 확인했다.

- [기능 CI](https://github.com/newbission/justusing/actions/runs/43414803920):535통과/7설정상제외 후 rebase merge, dev의 마지막 커밋 `77fbfa5572556dd63a62dbc24a767d62289b61f6`.
- [배포 PR #166](https://github.com/newbission/justusing/pull/166)의 [CI](https://github.com/newbission/justusing/actions/runs/43416963725)도535통과/7제외 후 squash merge. 운영 커밋은 `dff51b15514cca5c38e1936b139c726f5f08d712`.
- Cloudflare Workers Builds가2026-11-13 20:38경(KST) 성공했다. 공개 사이트는 [운영 홈](https://justus.ing/)과 [영어 홈](https://justus.ing/en/)이다.
- 즉시 만든 [main→dev 동기화 PR #167](https://github.com/newbission/justusing/pull/167)도 [CI](https://github.com/newbission/justusing/actions/runs/43418471086)535통과/7제외 후 merge commit `ed286eebb63d49071f139add8f728ffc0ef27334`로 반영했다. origin/main은 origin/dev의 조상이며 소스 트리는 같다. 구현 브랜치의 배포 전 소스 트리도 운영과 같다.

[배포 상태](../evidence/home-value-deployment-state.txt), [CI 요약](../evidence/home-value-deployment-ci-summary.txt). 보호 브랜치 직접 push나 관리자 우회는 사용하지 않았다.

## 배포 뒤 확인과 마감 — 2026-11-14

- 실제 한영 운영 URL이 HTML200이고 다운로드 첨부 응답이 아님을 확인했다. 고민→H1→방법→무료→자료 안내→기능 소개 순서와 각 문구가 반영됐으며 참조 Astro 자산12/11개가 모두200이다. [HTTP 결과](../evidence/home-value-production-http.txt).
- 실제 운영 도메인의 Chromium·WebKit 검사 **28개가 모두 통과(1.9분)**했다. 한영 소개·320/390px 두테마·JS 없음·전체 도구 탐색·직접 호스팅 사진과 실제 사진 처리/다운로드를 확인했다. 로컬 프록시가 아니다. [로그](../evidence/home-value-production-e2e.log), [설정](../evidence/home-value-production.config.ts.txt).
- 실제 IAB 운영 탭을 새로 고쳐 새 소개를 확인하고 데스크톱·390×844 화면을 캡처했다. 뷰포트는 원래대로 돌렸고 운영 탭을 결과로 남겼다. [운영 데스크톱](../evidence/home-value-production-desktop.png), [운영 모바일](../evidence/home-value-production-mobile.png). 실제 사용자 폰 인수와 구별한다.
- 병합 뒤 이력 생성기를 실행하고 이번 범위인 site-structure/fonts-and-data 이력만 갱신했다. 이 기록은 `docs/home-value-deployment-record`에 별도로 커밋/원격 보존한다. 운영 런타임을 바꾸거나 추가 배포하는 변경은 아니다.

이번 요청의 구현·검증·커밋·운영 배포·동기화·배포 뒤 확인은 완료됐다. 다음은 사용자 화면 피드백 또는 새 요청을 origin/dev 기반 기능 브랜치에서 진행한다. 전체 제품 인수 완료를 주장하지 않는다.

마감 [기계 보고서](1794585382647553000-0ff84ddf.md)는 로컬 검사 ID를 새로 선택하지 않아 `not_assessed`, 전체 제품은 `false`다. 위 실제 원격 CI/운영 검사 결과를 대신하거나 부정하는 값이 아니며, 커밋 후 오래된 로컬 검사를 현재 통과로 다시 기록하지 않았다. 마감 문서 관계 누락은 없다.
