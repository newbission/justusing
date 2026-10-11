/**
 * 격리 frame 안에서 Web Worker를 띄운다.
 *
 * 도구 화면은 출처 없는(sandbox) iframe이라 new Worker('/x.js')가 막힌다.
 * 워커 스크립트를 받아 blob URL로 만든 뒤 클래식 워커로 띄우면 된다 (실험으로 확인).
 * 워커 파일은 Vite가 IIFE 한 파일로 번들한다 (astro.config.mjs의 worker.format).
 *
 * 사용: import url from './x.worker.ts?worker&url'; const worker = await createWorker(url);
 */
export async function createWorker(scriptUrl: string): Promise<Worker> {
  // 개발 서버는 워커를 번들하지 않고 ES 모듈로 내려준다. 개발 중에는 격리도 꺼져 있어
  // (ToolFrame 참고) 모듈 워커를 바로 띄울 수 있다.
  if (import.meta.env.DEV) return new Worker(scriptUrl, { type: 'module' });

  const response = await fetch(scriptUrl);
  if (!response.ok) throw new Error(`워커 스크립트를 불러오지 못했습니다: ${response.status}`);

  const blob = new Blob([await response.text()], { type: 'text/javascript' });
  // blob URL은 해제하지 않는다. 워커가 스크립트를 비동기로 읽기 때문에 바로 해제하면
  // 로드가 실패할 수 있고, 도구마다 워커는 몇 개뿐이라 남겨 둬도 문제가 없다.
  return new Worker(URL.createObjectURL(blob));
}
