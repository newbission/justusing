// @ts-check
import { defineConfig } from 'astro/config';

import svelte from '@astrojs/svelte';
import { siteUrl } from './src/site.config.ts';
import { devPreview } from './src/integrations/dev-preview.ts';

// https://astro.build/config
export default defineConfig({
  site: siteUrl,
  // GitHub Pages는 /pdf/merge 를 /pdf/merge/ 로 리다이렉트하므로 처음부터 끝 슬래시로 통일
  trailingSlash: 'always',
  integrations: [svelte(), devPreview()],
  // 모든 페이지에 CSP <meta>를 넣는다. 페이지의 스크립트·스타일은 해시로 허용된다.
  // (개발 서버에서는 동작하지 않으므로 build + preview로 확인)
  security: { csp: true },
  // 가이드 글(마크다운)에 코드 색칠을 쓰지 않는다. 색칠(Shiki)은 inline style이라 CSP에 막힌다
  markdown: { syntaxHighlight: false },
  vite: {
    // 도구 화면은 출처 없는(sandbox) iframe 안에서 돈다. 거기서는 ES 모듈 워커를 만들 수 없어
    // 워커 파일을 클래식 스크립트(IIFE)로 번들하고 blob URL로 띄운다 (src/lib/worker.ts).
    worker: { format: 'iife' },
    // 출처 없는 iframe이 보내는 요청(Origin: null)도 로컬 미리보기 서버가 받도록 한다.
    // 실제 배포처인 GitHub Pages는 모든 파일에 Access-Control-Allow-Origin: * 을 보낸다.
    preview: { cors: { origin: true } },
  },
});
