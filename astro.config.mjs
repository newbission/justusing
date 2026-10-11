// @ts-check
import { defineConfig } from 'astro/config';

import svelte from '@astrojs/svelte';
import { siteUrl } from './src/site.config.ts';

// https://astro.build/config
export default defineConfig({
  site: siteUrl,
  integrations: [svelte()],
});
