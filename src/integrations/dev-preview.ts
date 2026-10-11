/**
 * 개발 서버(npm run dev)에서만 /_dev/layout/ 미리보기 페이지를 연다.
 * 배포 빌드에는 포함되지 않는다.
 */
import type { AstroIntegration } from 'astro';

export function devPreview(): AstroIntegration {
  return {
    name: 'dev-preview',
    hooks: {
      'astro:config:setup': ({ command, injectRoute }) => {
        if (command !== 'dev') return;
        injectRoute({ pattern: '/_dev/layout', entrypoint: './src/dev/LayoutPreview.astro' });
      },
    },
  };
}
