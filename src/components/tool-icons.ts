/**
 * 도구 아이콘을 페이지마다 한 번만 그리기 위한 목록.
 *
 * 머리글 펼침 메뉴·휴대폰 메뉴·도구 목록 카드에 같은 아이콘이 페이지마다 두세 번씩, 모두 200개 가까이 나온다.
 * 아이콘 모양(path)을 문서 앞 `<symbol>`에 한 번만 적고(`ToolIconSprite`), 각 자리에서는 `<use>`로 가리킨다
 * (`ToolIcon`). 같은 모양의 아이콘은 symbol 하나를 같이 쓴다.
 */
import { tools } from '../tools/registry';

const ids = new Map<string, string>();
for (const tool of tools) {
  const key = tool.icon.join('\n');
  if (!ids.has(key)) ids.set(key, `ti-${ids.size}`);
}

/** 문서 앞에 한 번 그리는 아이콘 모양 */
export const iconSymbols = [...ids].map(([key, id]) => ({ id, paths: key.split('\n') }));

/** 아이콘 모양의 symbol id. 레지스트리에 없는 모양이면 undefined (그 자리에 직접 그린다) */
export function iconSymbolId(paths: string[]): string | undefined {
  return ids.get(paths.join('\n'));
}
