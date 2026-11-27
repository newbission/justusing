/**
 * 도구 화면(App)을 frame의 #app에 띄운다. 모든 도구의 Frame.astro가 부른다.
 *
 * 결과를 다음 도구로 넘길 때(src/frame/chain.ts)는 같은 문서에서 다음 도구의 Frame.astro 스크립트를 불러온다.
 * 그때는 바로 띄우지 않고 App만 받아 둔다. 다음 도구 코드를 다 받은 뒤에 앞 화면을 내리고 띄우려는 것이다
 * (받다가 실패하면 앞 화면이 그대로 남는다).
 *
 * 모든 도구 첫 화면에 실리므로 띄우기만 여기 두고, 화면 바꾸기는 넘길 때 받는 chain.ts가 한다.
 */
import { mount, type Component } from 'svelte';

/** 넘기기(chain.ts)와 같이 쓰는 상태 */
export const tools = {
  /** 넘기는 중에 받은 도구 화면 (도구 ID → App). 한 번 받은 스크립트는 다시 실행되지 않아서 기억해 둔다 */
  apps: new Map<string, Component>(),
  /** 이 문서를 열 때 띄운 App (그 도구 ID는 frame 주소에 있다, src/frame/tool.ts) */
  first: undefined as Component | undefined,
  /** 지금 띄운 화면 */
  shown: undefined as Record<string, unknown> | undefined,
  /** 다음 도구 스크립트를 불러오는 중이면 그 도구 ID */
  loading: undefined as string | undefined,
};

/** Frame.astro: 처음 열린 도구면 띄우고, 넘기는 중에 불렸으면 App만 받아 둔다 */
export function startTool(App: Component) {
  if (tools.loading) {
    tools.apps.set(tools.loading, App);
    return;
  }
  tools.first = App;
  tools.shown = mount(App, { target: document.getElementById('app')! });
}
