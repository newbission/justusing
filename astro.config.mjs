// @ts-check
import { defineConfig } from 'astro/config';

import svelte from '@astrojs/svelte';
import { siteConfig, siteUrl } from './src/site.config.ts';
import { cname } from './src/integrations/cname.ts';

// https://astro.build/config
export default defineConfig({
  site: siteUrl,
  // GitHub Pages는 /pdf/merge 를 /pdf/merge/ 로 리다이렉트하므로 처음부터 끝 슬래시로 통일
  trailingSlash: 'always',
  integrations: [svelte(), cname(siteConfig.domain)],
});
