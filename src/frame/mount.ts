/**
 * 도구 화면(App)을 frame의 #app에 띄운다. 모든 도구의 Frame.astro가 부른다.
 *
 * 결과를 다음 도구로 넘길 때(src/frame/chain.ts)는 같은 문서에서 다음 도구의 Frame.astro 스크립트를 불러온다.
 * 그때는 바로 띄우지 않고 App만 받아 둔다. 다음 도구 코드를 다 받은 뒤에 앞 화면을 내리고 띄우려는 것이다
 * (받다가 실패하면 앞 화면이 그대로 남는다).
 */
import { flushSync, mount, unmount, type Component } from 'svelte';
import { currentTool } from './tool';

/** 이 문서에서 받은 도구 화면 (도구 ID → App). 한 번 받은 스크립트는 다시 실행되지 않아서 기억해 둔다 */
const apps = new Map<string, Component>();
let shown: Record<string, unknown> | undefined;
/** 다음 도구 스크립트를 불러오는 중이면 그 도구 ID */
let loading: string | undefined;

const root = () => document.getElementById('app')!;

/** Frame.astro: 처음 열린 도구면 띄우고, 넘기는 중에 불렸으면 App만 받아 둔다 */
export function startTool(App: Component) {
  if (loading) {
    apps.set(loading, App);
    return;
  }
  apps.set(currentTool(), App);
  shown = mount(App, { target: root() });
}

/** 도구 스크립트를 불러오고(load) 그 도구의 App을 돌려준다. 아직 띄우지 않는다 */
export async function loadTool(id: string, load: () => Promise<void>): Promise<Component> {
  if (!apps.has(id)) {
    loading = id;
    try {
      await load();
    } finally {
      loading = undefined;
    }
  }
  const App = apps.get(id);
  if (!App) throw new Error(`도구 화면을 받지 못했습니다: ${id}`);
  return App;
}

/** 지금 화면을 내리고(정리 코드가 워커·그림을 놓는다) App을 띄운다. 화면의 처음 효과(onMount)까지 마친다 */
export function showTool(App: Component) {
  if (shown) void unmount(shown);
  shown = mount(App, { target: root() });
  flushSync();
}
