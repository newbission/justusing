/**
 * 이 도구 화면(격리 frame)에서 지금 돌고 있는 도구의 ID ('image/crop').
 *
 * 처음에는 frame 주소(/<카테고리>/<이름>/frame/)에서 읽는다. 결과를 다음 도구로 넘기면(src/frame/chain.ts)
 * 같은 문서에서 화면만 바뀌고 주소는 그대로라, 바뀐 도구를 여기에 적어 둔다 (견본·넘길 도구 목록이 이것을 본다).
 */
import { withoutLocale } from '../i18n/locales';

function fromAddress(): string {
  if (typeof location === 'undefined') return '';
  const [category, name] = withoutLocale(location.pathname).split('/').filter(Boolean);
  return category && name ? `${category}/${name}` : '';
}

let current = fromAddress();

export function currentTool(): string {
  return current;
}

export function setCurrentTool(id: string) {
  current = id;
}
