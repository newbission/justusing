import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: `${process.cwd()}/tests/e2e`,
  testMatch: ['**/home-value.spec.ts','**/home-motion-review.spec.ts'],
  reporter: 'list',
  workers: 1,
  use: {browserName:'webkit',baseURL:'http://localhost:8862',viewport:{width:390,height:844}},
  outputDir: `${process.cwd()}/test-results/home-reference-webkit`,
});
