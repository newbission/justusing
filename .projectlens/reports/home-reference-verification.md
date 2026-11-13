# 홈 상단 개편 검증 결과

쓴 날 2026-11-14. 기획/구현과 별도인 verification 에이전트가 초기 사실 감사, 실제 렌더/기능/접근성 검증과 독립 E2E를 작성했다. 마지막 색상 수정 뒤 에이전트 실행 한도에 걸렸으므로 root가 남겨진 독립 스크립트와 영구 E2E를 실행해 최종 반영을 확인했다. 마지막 확인을 독립 에이전트의 새 검증으로 주장하지 않는다.

## 중요한 지적

1. 자료 박스 공용 guide-note CSS가 padding과 제목 크기를 덮음: root와 구현자가 실제 렌더에서 발견, 독립 검증자가 재확인. 공용 클래스를 제거하고 안내 전용 스타일로 수정했다. 최종12접근성 조합에서 padding>=16px/본문14px 확인.
2. 밝은 accent-soft 배경 위 muted 본문 대비4.00:1: 독립 검증자가 측정해 필수 수정 요청. .proof-outside와.home-data-note p를color-text 토큰으로 수정. root 최종12조합에서 해당 본문 대비light13.02:1/dark11.81:1 확인. 영구E2E는 두테마의전경과조상배경을실제로합성해4.5이상을확인한다.

## 실행 및 실제 관찰

- 독립 에이전트: 초기 사실 감사/검증계획, 한영×1280/390/320×두테마×normal/reduced/noJS 36렌더 통과, WebKit18회귀통과(35.5초), 새바로가기키보드→실제JPG처리/다운로드2개통과. 이 실행은 최종색수정 직전이며 로그를 보존했다.
- root 최종색수정 빌드: 같은36렌더를render-review.mjs로재실행, 12접근성조합을accessibility-review.mjs로재실행해모두통과. CSP/pageerror/가로넘침0, 홈에서큰도구자산수신없음, H1하나/첫화면CTA/도식글씨최소12px. 키보드초점·링크높이>=24px·안내여백/본문크기확인. 전체접근성전항목에대한인증은아님.
- root IAB 실제관찰: KO1280 light/390light의H1·CTA·정적도식·원리/수정된자료안내·사진연결, EN908dark/320dark의위계·줄바꿈·시작점을직접확인하고viewport복원. 기획담당의12조합리뷰도필수수정없음.
- root 최종타깃E2E: Chromium75개통과/광고안내설정상7개제외(2.5분). 한영홈/새바로가기실제처리·파일명이름비전송/Blob다운로드/opaque격리/첫노출단회자동·수동/감소모션/JS없음/전체사이트CSP/폰트/성능/광고경계포함. C-REFERENCE-E2E 1794607270399424000-69e0f296.
- 최종포맷·타입·프로덕션build268pages·diff통과. C-REFERENCE-QUALITY 1794586823726900000-66e6817c. 두 자동체크fingerprint c001849a116e8d5ba920930589f9902359220214c5260765231504c4b4d36b8d.
- 최종성능: KO HTML21.5KB/CSS10.2KB/폰트102.8KB/그림98KB/11요청; EN20.2/10.2/36/98KB/10요청. 첫뷰포트에서먼저내려오는lazy그림의수는레이아웃에따라달라질수있으며170KB/18요청기존상한내다. 새런타임JS/의존성/모델없음, 상한상향없음.

## 근거

- ../evidence/home-reference/independent/{initial-*,interrupted-*,webkit-e2e.log,direct-shortcut-e2e.log}: 독립 에이전트 초기/최종색수정전 실행·경합기록.
- ../evidence/home-reference/independent/root-final-render.log 및 chromium-render-review.json/스크린샷: root최종36렌더.
- ../evidence/home-reference/independent/root-final-accessibility.log 및 accessibility-review.json: root최종12접근성.
- ../evidence/home-reference-review/final/: 별도기획담당12조합·사진·장면관찰.
- ../evidence/home-reference-{baseline,final}-perf.txt: 전후실측. 처음최종측정시8852세션서버종료로연결거부, 같은dist서버재시작뒤정상재측정. 환경실패는home-reference-perf-environment.txt.

검사범위 안의 필수 지적은 모두 반영·확인했다. 실제사용자 이해도 측정/사용자 인수/네이티브Safari 인수를 받았다고 주장하지 않는다. 운영 배포 뒤 확인은 범위 보고서에 추가한다.
