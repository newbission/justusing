# 홈 개편 배포 검증 — 2026-11-13

사용자 요청 “우선 커밋했어? 배포까지 해놔”에 따른 현재 홈 변경의 커밋·리뷰·CI·운영 배포다. 기준은 home-local-first-plan.md와 기존 홈/모션 명세다. 관리자 대시보드나 새 도구 기능은 추가하지 않았다.

## 커밋과 배포

- 구현·자산·폰트·테스트·명세를 8개 커밋(c8a25a74 → 24f39909)으로 나눠 원격 기능 브랜치에 반영했다.
- [기능 PR #162](https://github.com/newbission/justusing/pull/162): 현재 head 24f39909에 대한 Codex 주요 문제 없음 답변 확인. CI 529개 통과, 꺼진 광고 안내 7개 제외 후 rebase merge로 dev에 반영했다.
- [배포 PR #163](https://github.com/newbission/justusing/pull/163): 동일 소스의 CI 529개 통과/7개 제외 후 squash merge. 운영 커밋은 `2cbe6d23f596d6db66802300b2f45e3636e88bfb`이다.
- Cloudflare Workers Builds 성공. 사이트 주소는 src/site.config.ts의 siteUrl이 기준이다. 별도 Wrangler 로그인·배포 설정 변경은 하지 않았다.
- [동기화 PR #164](https://github.com/newbission/justusing/pull/164): main을 dev로 되돌리는 저장소 필수 절차. 최종 결과는 아래 후속 기록에 남긴다.

## 운영 확인과 검사 실패의 분류

HTTP 확인은 한국어·영어 홈 200/text-html, 새 H1과 로컬 안내→기능 소개 순서, 각 홈의 Astro 참조 자산 12개/11개 전부 200이다. 근거: [HTTP 결과](../evidence/home-production-http.txt).

실제 운영 도메인에 Chromium·모바일 WebKit으로 홈 탐색·실제 사진 처리/다운로드·장면 재생·재진입·수동 제어·320px 두 테마를 검사했다. 기존 E2E 46개 중 43개 통과, 3개 실패이며 전체 통과로 바꿔 기록하지 않았다. [첫 실행](../evidence/home-production-e2e.log), [원래 조건 재검사](../evidence/home-production-recheck.log).

1. 도구 진입의 파일 입력 대기가 기본 5초를 넘어 종료됐다. 첫 실패는 한국어 가리기, 영어 배경 제거였고 재검사 때는 다른 도구에서도 발생했다. 네트워크/기기 대기에 민감한 검사 조건이다. 운영 전용 진단에서 조건은 그대로 두고 준비 대기만 30초까지 허용하자 두 언어의 4개 도구 모두 준비됐다. 실측 한국어 4,982/2,961/4,996/5,006ms, 영어 3,927/4,510/4,447/3,988ms. 이 검사는 입력 첨부까지이며 8개 도구의 처리 완료를 의미하지 않는다. 기존 home.spec의 실제 사진 처리/다운로드는 두 언어·두 엔진에서 통과했다.
2. WebKit 움직임 줄이기에서 getAnimations()를 즉시 읽으면 초기 스타일의 CSSTransition 10개를 포함했다. 장면 키프레임 재생이 아니며 global.css의 reduce 규칙은 transition-duration 0.01ms다. 각 장면에서 media=true/playback=idle을 확인하고 짧은 스타일 전환이 끝난 뒤 animation count=0을 검증했다. 두 언어 모두 통과했다. 런타임 소스나 보안 정책을 바꾸지 않았다.

운영 전용 진단 4개 모두 통과(1.3분), 별도 WebKit 확인 2개도 통과. [진단 로그](../evidence/home-production-probe.log), [WebKit 로그](../evidence/home-production-webkit-probe.log). 재현용 임시 설정/검사도 evidence의 home-production-probe.*.txt에 보존했다. 이를 원래 E2E 46개 전체 통과라고 합산하지 않는다.

실제 IAB에서 운영 홈의 390×844 모바일·데스크톱을 확인했다. [모바일](../evidence/home-production-mobile.png), [데스크톱](../evidence/home-production-desktop.png). 사용자의 실제 휴대폰·네이티브 Safari 인수는 아니다.

## 범위와 남은 항목

현재 제품 구현 8개 커밋은 운영에 반영됐다. 배포 뒤 생성한 이 보고서·스크린샷·자동 히스토리는 별도 운영 기록이며 현재 운영 커밋의 내용과 구분한다. 다음 테스트 개선 때 운영 진입 대기 시간과 WebKit 초기 전환에 대한 폴링을 정식 E2E에 반영할 수 있다. 현재 요청에 추가 기능 변경은 없다.

ProjectLens의 예전 소스 지문 검사는 커밋/문서 변경 때문에 stale이며 제품 전체 인수 기록도 없다. 배포 검증의 근거는 위 exact-head GitHub CI와 운영 관찰이다. 기계 보고서의 전체 gate를 제품 완료로 해석하지 않는다.

## 최종 동기화·기록

동기화 PR #164도 CI 529통과/7설정상제외 후 2026-11-13 09:45:54 UTC에 merge commit `848049c56b3ae60ab252ebd5f188ea32854bd286`으로 반영했다. 원격 main이 dev의 조상이고 두 브랜치의 소스 트리는 동일함을 확인했다. [배포 상태](../evidence/home-deployment-state.txt), [세 CI의 요약](../evidence/home-deployment-ci-summary.txt).

배포 후 기록은 `docs/home-deployment-record` 브랜치의 문서·증거 전용 커밋으로 보존한다. 이 기록을 위해 앱을 다시 배포하지 않는다. 운영 소스와 보안 정책의 추가 변경은 없다. 요청한 앱 커밋·리뷰·배포·동기화·운영 확인에 남은 필수 작업은 없다.
