# 홈 재기획 독립 검증 계획

작성: 2026-11-14 · 역할: 구현과 분리된 검증 담당 · 상태: 초기 코드 감사, 최종 구현 전

## 확인한 구조와 주장 범위

| 방문자에게 설명할 사실 | 코드 근거 | 주의할 범위 |
| --- | --- | --- |
| 고른 파일 내용·이름은 서버에 보내지 않고 기기 안에서 처리한다 | `src/components/ToolFrame.astro`, `src/frame/FrameLayout.astro`, `src/frame/download.ts`, `tests/e2e/local-only.ts` | 사이트 리소스 수신과 바깥 광고·통계 연결은 있다. '외부 통신 없음'으로 넓히지 않는다 |
| 처리 프로그램과 공개 엔진·모델·언어 자료가 사이트에서 기기로 내려온다 | `src/lib/worker.ts`, `src/frame/data.ts`, `src/lib/data-store.ts`, `src/lib/ocr/`, `src/lib/face/` | 일반 코드·작은 HEIC 엔진 등의 수신까지 모두 사전 선택한다고 쓰지 않는다 |
| 파일 선택·미리보기·처리·결과 저장은 바깥 광고·통계와 격리된 도구 영역 안에서 이뤄진다 | ToolFrame의 `sandbox="allow-scripts allow-downloads"`(allow-same-origin 없음), FrameLayout의 `default-src 'none'` 및 자체 사이트 연결 목록 | '광고 자체가 없음', '완벽 보안', '보안 인증'은 근거 없음. 도식에서 기기 경계와 도구 경계를 구별한다 |
| 큰 공개 처리 자료는 용량을 알리고 받기를 선택한다 | `src/frame/data.ts`의 `missingData`, `src/lib/fonts/FontPicker.svelte`, `src/lib/ocr/OcrSetup.svelte`, `src/lib/data-store.ts` | 별도 앱 설치와 다르다. 모바일 데이터 사용 가능, 브라우저 보관본이 삭제되면 다시 받을 수 있다 |
| 보관하는 것은 공개 처리 자료다 | data-store의 `/data/` 경로 검증, 해시/크기 검증, Cache API와 data-consent 기록 | 사용자 파일 보관함으로 묘사하지 않는다. 모든 도구의 완전 오프라인 동작을 약속하지 않는다 |
| PDF·이미지·텍스트/CSV·동영상의 무료 도구를 제공한다 | registry의 liveTools, `src/lib/entitlement.ts`의 canUse | 수는 liveTools에서 계산한다. 가짜 이용자 수·후기·인증을 만들지 않는다 |

기준 문서: AGENTS.md, CLAUDE.md, site-structure/README.md, fonts-and-data/README.md, ads-and-analytics/README.md, handoff.md. 위 표의 소스와 기존 home/home-value/home-motion/site-font/CSP/perf/local-only 테스트를 직접 읽었다.

## 최종 검증 항목

1. 사실성과 이해도: 한영 제목·보조 설명·도식의 읽기 순서에서 무엇/왜/시작이 드러나는지 확인. 사이트→기기 자료 수신과 기기 내 사용자 파일 흐름, 광고·통계 분리, 다운로드 주의가 코드와 일치해야 한다. 세 질문/3열을 유지하도록 검증하지 않는다.
2. 실제 렌더: 한국어·영어 × desktop(1280 이상)·390·320 × light/dark. 첫 화면 CTA, 도식, 자료 안내, 사진 비교, 대표 장면, 도구 목록까지 캡처하고 가로 넘침·텍스트 잘림·대비·초점 표시를 확인한다. 감소 모션 및 JS 없는 정적 화면도 별도 확인한다.
3. 사용자 여정: 첫 CTA로 전체 도구 목록→실제 도구 진입, 키보드 Enter/Tab, 사진 용량 맞추기 실제 처리·Blob 다운로드. 대표4개 장면의 결과 의미·첫 노출 1회 자동/재진입 무반복/이후 수동/정지·재개/감소 모션을 기존 독립 테스트로 확인한다.
4. 격리·통신: 배포 빌드+Wrangler에서 검사. CSP 위반·콘솔 오류, 외부 자산·모델 선취, 파일 이름/내용이 URL·본문·제목·통계에 새지 않는지 확인한다. sandbox/CSP/Worker 경계를 넓히지 않았는지 diff 감사한다.
5. 접근성: H1 하나, 의미 있는 제목 구조, 링크·버튼 라벨, 정적 도식의 동등한 텍스트, 키보드와 초점, 충분한 터치 영역과 테마 대비를 확인한다. 장식 화살표는 보조기술에서 숨겨야 한다.
6. 성능: 기존 예산을 먼저 유지한다. 현재 홈 한도 HTML24KB/JS4KB/CSS10.5KB/폰트117KB/그림170KB/18요청, gzip 기준(폰트 원본). 큰 처리 라이브러리·/data·/vendor·워커가 홈에서 내려오면 실패. 실제 측정값을 남기고 상한 조정은 최적화 후 이유가 있을 때만 인정한다.
7. 회귀: format/type/build, 기존 home/home-value(새 의도에 맞게 갱신)/home-showcase/home-motion/i18n/site-font/perf/CSP, 실제 처리·다운로드. 모바일 WebKit도 최종 빌드에서 별도 확인한다.
8. 배포 후: 운영 한영200·자산200·새 제목과 도식/CTA/사진/대표장면 실제 렌더 확인, 주요 사용자 여정 재검사. CI/에이전트 관찰/실제 사용자 인수를 구별한다.

## 초기 위험 및 전달 사항

- 기존 home-value.spec.ts가 `.home-pains`와 고민→H1 DOM 순서를 강제한다. 새 구성에서는 사용자 요구(빠른 정체성·이유·시작, 정확한 흐름/안내)를 검사하도록 바꾸되 단순 삭제로 회귀를 숨기지 않는다.
- 기존 home.spec.ts는 모바일390에서 첫 CTA가 viewport 안에 있음을 검사한다. 개편 후에도 유효한 제품 기준이다.
- 홈 CSS는 종전 10.18KB 측정으로10.5KB에 가깝다. 같은 정보의 카드/중첩 경계를 더 쌓으면 밀도·성능 둘 다 나빠질 수 있다.
- 사이트 글꼴은 한글 서브셋이다. 카피 변경 뒤 build→폰트 재생성→build와 site-font 검사를 빠뜨리지 않는다.
- 개발 서버만으로 CSP·opaque frame 검증이 되지 않는다. 별도 검증 포트·브라우저 프로세스를 사용하여 root 작업과 충돌하지 않는다.

최종 보고에는 실행 명령, 코드 fingerprint/빌드 기준, 테스트 수·실패 원인·재검사, 캡처 경로, 중요 지적 반영 여부를 남긴다. 현재는 최종 구현 검증을 수행했다고 주장하지 않는다.
