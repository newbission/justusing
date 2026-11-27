/**
 * 결과를 다음 도구로 넘긴다 (docs/foundations/tool-chaining). 같은 격리 frame 문서 안에서 화면만 바꾼다.
 *
 * - 파일은 이 문서의 메모리(File 객체)에서 다음 도구 화면으로 옮겨질 뿐, 어떤 메시지·주소·저장소에도 싣지 않는다.
 *   다음 도구는 놓은 파일처럼 받는다 (deliverFiles → onFrameFiles), 그래서 도구마다 받는 코드를 따로 두지 않는다
 * - 다음 도구 코드는 빌드가 적어 둔 목록(/_chain/<id>.json, src/integrations/tool-chain.ts)으로 불러온다.
 *   우리 사이트 파일이라 지금 frame CSP('self' + 사이트 주소)로 열린다. 실행 중에 <style>·인라인 스크립트는 만들지 않는다
 * - 다 받은 뒤에 앞 화면을 내린다. 받다가 실패하면 앞 화면이 그대로 남는다
 * - 바깥이 공개 도구 페이지를 준비한 뒤 두 화면을 바꾼다. 전환마다 새 포트로 준비·완료 여부만 주고받는다
 *
 * 이 모듈은 '다음 도구로' 메뉴(SendMenu)를 띄울 때 받는다 (도구 첫 화면 무게에 들지 않는다).
 * Svelte 기능은 모든 frame이 같이 받는 실행 코드에 들어가므로 이미 쓰는 것(mount·unmount·tick)만 쓴다.
 */
import { mount, tick, unmount, type Component } from 'svelte';
import { localizePath, type Locale } from '../i18n/locales';
import { deliverFiles } from './drop';
import { frameLocale } from './locale';
import { tools } from './mount';
import { firstTool, setCurrentTool } from './tool';

interface Manifest {
  /** 그 도구 frame 페이지가 부르는 모듈 스크립트 (순서대로) */
  scripts: string[];
  /** 스타일 파일 (인라인 <style>은 빌드가 파일로 뺐다) */
  styles: string[];
  /** frame 문서 제목 */
  title: Record<Locale, string>;
}

/** 우리 사이트의 빌드 파일만 (목록이 바뀌어도 다른 곳의 코드를 부르지 않게) */
const OWN_FILE = /^\/(_astro|_chain)\/[\w./-]+$/;

function isManifest(value: unknown): value is Manifest {
  const v = value as Manifest;
  const files = (list: unknown) =>
    Array.isArray(list) && list.every((item) => typeof item === 'string' && OWN_FILE.test(item));
  return (
    typeof v === 'object' &&
    v !== null &&
    files(v.scripts) &&
    files(v.styles) &&
    typeof v.title?.[frameLocale] === 'string'
  );
}

/** 개발 서버: 빌드 목록이 없어 그 도구 frame 페이지를 읽어 같은 것을 모은다 (격리·CSP가 꺼져 있다) */
async function devManifest(id: string): Promise<Manifest> {
  const response = await fetch(localizePath(`/${id}/frame/`, frameLocale));
  const html = await response.text();
  const page = new DOMParser().parseFromString(html, 'text/html');
  for (const style of page.querySelectorAll('head style')) {
    document.head.append(document.importNode(style, true));
  }
  return {
    scripts: [...page.querySelectorAll<HTMLScriptElement>('script[type=module][src]')].map(
      (script) => script.getAttribute('src')!,
    ),
    styles: [...page.querySelectorAll('link[rel=stylesheet]')].map((link) =>
      link.getAttribute('href')!,
    ),
    title: { [frameLocale]: page.title } as Record<Locale, string>,
  };
}

async function manifest(id: string): Promise<Manifest> {
  if (import.meta.env.DEV) return devManifest(id);
  const response = await fetch(`/_chain/${id}.json`);
  if (!response.ok) throw new Error(`넘기기 목록을 받지 못했습니다: ${response.status}`);
  const value: unknown = await response.json();
  if (!isManifest(value)) throw new Error('넘기기 목록의 모양이 다릅니다');
  return value;
}

/** 스타일 파일을 넣고 다 읽을 때까지 기다린다 (이미 있으면 그대로) */
const loadingStyles = new Map<string, Promise<void>>();

export function loadStyle(href: string): Promise<void> {
  const loading = loadingStyles.get(href);
  if (loading) return loading;
  const present = [...document.querySelectorAll('link[rel=stylesheet]')].some(
    (link) => link.getAttribute('href') === href,
  );
  if (present) return Promise.resolve();
  const ready = new Promise<void>((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.addEventListener('load', () => resolve());
    link.addEventListener('error', () => {
      link.remove();
      reject(new Error(`스타일을 받지 못했습니다: ${href}`));
    });
    document.head.append(link);
  }).finally(() => loadingStyles.delete(href));
  loadingStyles.set(href, ready);
  return ready;
}

/** 바깥과 상관없이 frame 안에서 읽어 주는 알림 칸. 바꾸기 전부터 있어야 화면 읽기가 놓치지 않는다 */
let status: HTMLElement | undefined;

export function prepareStatus() {
  if (status) return;
  status = document.createElement('p');
  status.className = 'visually-hidden';
  status.setAttribute('role', 'status');
  document.body.append(status);
}

/**
 * 도구 스크립트를 불러와 그 도구의 App을 돌려준다. 아직 띄우지 않는다: 스크립트가 부르는 startTool이
 * 넘기는 중임을 보고 App만 넘긴다 (src/frame/mount.ts)
 */
// 진입 스크립트는 tools.loading으로 자신을 등록한다. 취소 뒤 새 요청이 와도 한 번에 하나만 실행한다.
let imports: Promise<void> = Promise.resolve();

async function loadApp(id: string, scripts: string[]): Promise<Component> {
  if (id === firstTool && tools.first) return tools.first;
  if (!tools.apps.has(id)) {
    tools.loading = id;
    try {
      for (const src of scripts) {
        // 이미 이 문서에 있는 스크립트(frame 틀 등)는 다시 부르지 않는다 (같은 주소면 어차피 한 번만 돈다)
        if (document.querySelector(`script[type=module][src="${src}"]`)) continue;
        await import(/* @vite-ignore */ src);
      }
    } finally {
      tools.loading = undefined;
    }
  }
  const App = tools.apps.get(id);
  if (!App) throw new Error(`도구 화면을 받지 못했습니다: ${id}`);
  return App;
}

/** 바깥의 제목·주소가 준비될 때까지 앞 도구를 유지한다. 포트에는 성공/실패만 싣는다. */
function prepareOuterPage(path: string, signal: AbortSignal): Promise<MessagePort> {
  signal.throwIfAborted();
  const { port1, port2 } = new MessageChannel();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', fail);
      port1.onmessage = null;
    };
    const fail = () => {
      cleanup();
      port1.postMessage(false);
      port1.close();
      reject(new Error('다음 도구 페이지를 준비하지 못했습니다'));
    };
    // 오래된 바깥 페이지나 응답이 끊긴 연결에서도 다시 시도할 수 있게 한다.
    const timer = setTimeout(fail, 20000);
    signal.addEventListener('abort', fail, { once: true });
    port1.onmessage = (event) => {
      if (event.data === true) {
        cleanup();
        resolve(port1);
      } else fail();
    };
    parent.postMessage({ type: 'tool-change', path }, '*', [port2]);
  });
}

/**
 * id 도구로 화면을 바꾸고 files를 넘긴다. announce는 바꾼 뒤 화면 읽기가 읽을 글.
 * 다음 도구를 불러오지 못하면 던지고, 그때 앞 화면은 그대로다
 */
export async function sendFiles(
  id: string,
  files: File[],
  announce: string,
  signal: AbortSignal,
): Promise<void> {
  prepareStatus();
  const { scripts, styles, title } = await manifest(id);
  await Promise.all(styles.map(loadStyle));
  const loading = imports.then(() => {
    signal.throwIfAborted();
    return loadApp(id, scripts);
  });
  imports = loading.then(
    () => {},
    () => {},
  );
  const App = await loading;
  // frame 주소를 단독으로 열었으면 바꿀 바깥 페이지가 없다.
  const outer =
    parent === window
      ? undefined
      : await prepareOuterPage(localizePath(`/${id}/`, frameLocale), signal);

  let sent = false;
  try {
    signal.throwIfAborted();
    // 앞 화면을 내리고(정리 코드가 워커·그림을 놓는다) 다음 도구를 띄운다
    setCurrentTool(id);
    if (tools.shown) void unmount(tools.shown);
    tools.shown = mount(App, { target: document.getElementById('app')! });
    document.title = title[frameLocale];
    // 새 화면의 처음 효과(onMount: 놓은 파일 받기)까지 마친 뒤 놓은 파일처럼 넘긴다
    await tick();
    deliverFiles(files);

    // 포커스를 새 도구 화면으로 (넘기기 버튼은 앞 화면과 함께 사라졌다)
    const root = document.getElementById('app');
    if (root) {
      root.tabIndex = -1;
      // 도구 화면 전체에 포커스 테두리를 그리지 않는다 (다음 Tab부터 그 안의 버튼에 그린다)
      root.style.outline = 'none';
      root.focus({ preventScroll: true });
    }
    status!.textContent = announce;
    sent = true;
  } finally {
    outer?.postMessage(sent);
    outer?.close();
  }
}
