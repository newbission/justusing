/**
 * 빌드 결과(dist/)에 GitHub Pages용 CNAME 파일을 만든다.
 * 도메인을 public/CNAME에 따로 적지 않고 site.config.ts 한 곳에서만 관리하기 위함.
 */
import { writeFile } from 'node:fs/promises';
import type { AstroIntegration } from 'astro';

export function cname(domain: string): AstroIntegration {
  return {
    name: 'cname',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        await writeFile(new URL('CNAME', dir), `${domain}\n`);
      },
    },
  };
}
