# 홈 사진 견본

사진: Patrick Pahlke, [Aloe in Terrakotta](https://unsplash.com/photos/green-plant-in-brown-clay-pot-6PkcqHAFsZA), 2021-03-27.
[Unsplash License](https://unsplash.com/license)는 다운로드·수정·상업적 사용·재배포를 허용한다 (2026-11-12 확인).

`scripts/home/aloe.jpg`는 이 사진의 1400px 판이다. 외부 이미지 서버를 방문자 브라우저에서 호출하지 않는다.
`src/assets/home/`의 이미지는 이 원본과 우리 도구(`/image/target-size/`, 100KB)의 실제 저장 결과를 화면용 WebP로 축소한 것이다.
`result.json`의 수치는 WebP 썸네일 크기가 아니라 처리한 원본 JPG·결과 JPG의 실제 바이트 수다. 화면에 견본 수치임을 밝힌다.

다시 만들기:

```sh
npm run build
npm run preview
# 다른 터미널에서
PLAYWRIGHT_CHANNEL=chrome node scripts/home/make-preview.mjs
```

결과 JPG는 `.cache/home-refresh/result.jpg`에 남는다. 사진·수치를 바꾸면 홈 E2E와 성능 예산을 다시 확인한다.

## 실제 전후 결과 재료 (2026-11-13)

추가 사진도 Unsplash License로 사용한다. 다음 사진의 원본은 개발 재료로만 두고 방문자에게는 축소한 결과 이미지만 직접 호스팅한다.

- `coast.jpg`: Erik Esly, [The Rumps 해안 풍경](https://unsplash.com/photos/coastal-cliffs-over-sea-xYbl6lHASw8), 2026-10-03. 1200px 판.
- `flowers.jpg`: Yana Hurska, [꽃병에 꽂힌 노란 꽃](https://unsplash.com/photos/a-vase-with-yellow-flowers-PpAEAT6jEnw), 2022-10-05. 1200px 판.

`make-showcase.mjs`는 실제 빌드된 도구를 Playwright로 열어 결과를 저장한다. 배경 제거 PNG의 투명도, 정사각형 크기, 가로 이어 붙인 크기, PDF 쪽 수를 확인한다. PDF 가리기는 가상의 정보가 든 견본을 처리하고 `render-showcase-pdfs.py`가 가린 글자가 결과에서 검색되지 않는지 확인한다. 영어판은 영어 견본 문서로 따로 만든다.

가로 이어 붙이기는 같은 해안 사진을 3개로 나눈 견본을 옆으로 잇는 예시다. 사진을 PDF로 만든 결과는 화분·꽃·해안 사진 3장이 들어간 실제 3쪽 PDF다. 이전 `compose-showcase.mjs`의 정적 합성본은 앞 두 쪽을 보여 주었고, 현재 홈에서는 사용하지 않는다. PDF 합치기는 보고서4쪽+부록2쪽=6쪽 결과의 첫 쪽을 보여 준다. `compose-showcase.mjs`는 실제 입력·결과를 축소하고 배치할 뿐 처리 결과를 새로 그리지 않는다. 그림 안 글자는 원래 문서의 내용이고, 제목·설명·입출력 꼬리표는 한영 HTML로 둔다.

PyMuPDF를 설치한 Python을 `HOME_PREVIEW_PYTHON`으로 지정할 수 있다. 기본은 로컬 `.cache/home-refresh/font-env/bin/python`이다.

```sh
PLAYWRIGHT_CHANNEL=chrome node scripts/home/make-showcase.mjs
node scripts/home/compose-showcase.mjs
```

원시 결과는 `.cache/home-showcase/raw/`, 이전 정적 합성 WebP와 검증한 메타데이터는 `src/assets/home/showcase/`에 남긴다.

## 주요 작업 4개의 동작 장면

홈은 이미지→PDF, 배경 제거, PDF 합치기, PDF 가리기를 큰 장면으로 보여 준다. `make-scene-assets.mjs`는 위의 원시 입력·결과를 sprite WebP로 축소할 뿐 결과를 새로 그리거나 개인정보 가리기를 추가하지 않는다.

```sh
# make-showcase.mjs로 원시 결과를 만든 다음
node scripts/home/make-scene-assets.mjs
```

화면용 sprite는 `src/assets/home/scenes/`에 둔다. 이미지→PDF는 실제 결과의 세 쪽을 하나의 PDF 뷰어 안에서 전환한다. 합치기는 4쪽 보고서+2쪽 부록을 나타내며, 가리기는 실제 전후 문서의 같은 부분을 확대해 보여 준다. 그림 속 글자는 실제 견본 문서 내용이다.

이미지에는 고정 크기와 지연 로딩을 지정한다. 홈의 작은 상태 코드와 CSS는 각 장면이 처음 화면에 절반 이상 보이면 4.8초 한 번만 과정을 재현하며 실제 파일 처리나 처리시간을 의미하지 않는다. 이미 재생 중인 장면이 있으면 새 장면은 보이는 동안 대기하고, 앞 장면이 끝나면 자동으로 한 번 시작한다. 화면 밖으로 나가도 시작한 단회 재생은 끝까지 진행한다. 재진입으로 다시 자동 재생하지 않으며 이후에는 버튼으로 정지·재개·다시 재생한다. 수동 조작은 그 장면의 자동 재생 기회를 소비하며, 다른 장면을 수동으로 시작하면 실행 중인 장면은 정지한다. 페이지를 새로 열면 최초 노출 기록도 초기화한다. 숨겨진 탭에서는 자동 재생을 시작하지 않는다. 움직임 줄이기 또는 JS가 꺼진 경우에도 완결된 입력·결과를 볼 수 있다. 모델·워커·도구 전용 라이브러리는 홈에서 받지 않는다.
