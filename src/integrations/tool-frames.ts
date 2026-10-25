/**
 * 도구 화면(격리 frame) 페이지를 도구마다 따로 만든다 (/<카테고리>/<이름>/frame/, 영어는 /en/...).
 *
 * 예전에는 한 라우트(`[category]/[tool]/frame.astro`)가 모든 도구의 Frame.astro를 불러서 Astro가
 * 모든 도구의 Svelte CSS를 모든 frame 페이지에 넣었다 (frame HTML 원본 약 77KB 중 50KB가 다른 도구 CSS).
 * 페이지 진입점이 도구의 Frame.astro 하나면 그 도구가 쓰는 CSS만 들어간다.
 */
import type { AstroIntegration } from 'astro';
import { LOCALES, localizePath } from '../i18n/locales';
import { liveTools } from '../tools/registry';

export function toolFrames(): AstroIntegration {
  return {
    name: 'tool-frames',
    hooks: {
      'astro:config:setup': ({ injectRoute }) => {
        for (const tool of liveTools) {
          for (const locale of LOCALES) {
            injectRoute({
              pattern: localizePath(`/${tool.id}/frame`, locale),
              entrypoint: `./src/tools/${tool.id}/Frame.astro`,
            });
          }
        }
      },
    },
  };
}
