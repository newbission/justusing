/**
 * 분류 페이지와 도구 페이지의 주소 목록 (getStaticPaths). 언어마다 같은 목록을 쓴다.
 * 한국어 페이지(src/pages/[category]/)와 영어 페이지(src/pages/en/[category]/)가 함께 쓴다.
 */
import { liveTools, visibleCategories } from './registry';

export function categoryPaths() {
  return visibleCategories.map((category) => ({ params: { category }, props: { category } }));
}

export function toolPaths() {
  return liveTools.map((tool) => {
    const [category, slug] = tool.id.split('/');
    return { params: { category, tool: slug }, props: { tool } };
  });
}
