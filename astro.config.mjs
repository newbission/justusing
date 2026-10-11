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
});
