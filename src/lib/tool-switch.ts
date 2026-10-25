/**
 * 결과를 다음 도구로 넘긴 뒤 바깥 페이지를 그 도구 페이지로 바꾼다 (docs/foundations/tool-chaining). 바깥 페이지에서 돈다.
 *
 * 도구 칸(격리 frame)은 이미 다음 도구 화면이다. 바깥이 받은 것은 'tool-change' 신호(도구 ID)뿐이고 파일은 모른다.
 * - 다음 도구 페이지(우리 공개 페이지)를 받아 [data-swap] 구역(머리·쓰임새와 사용법·FAQ·관련 글),
 *   <head>의 제목·설명·주소·언어판, 머리글의 언어 바꾸기 링크·메뉴의 '지금 페이지' 표시, 도구 칸 이름을 맞춘다
 * - 도구 칸과 광고 칸은 DOM에서 옮기지 않는다 (iframe을 옮기면 다시 불러와 넘긴 파일을 잃고, 광고는 다시 그려진다)
 * - 바꾸는 동안 도구 칸이 화면에서 움직이지 않게 위쪽 높이가 달라진 만큼 같은 순간에 스크롤한다 (CLS)
 * - pushState로 주소를 바꾼다. 뒤로·앞으로 가기로 경로가 달라지면 그 주소를 새로 연다 (넘긴 파일은 남지 않는다)
 *
 * ToolFrame이 신호를 받을 때만 이 모듈을 받는다 (도구 페이지 첫 화면 무게에 들지 않는다).
 */
import { localeOf, localizePath } from '../i18n/locales';

/** 지금 화면에 그려 둔 페이지의 경로 */
let shown = location.pathname;
/** 신호가 겹쳐 와도 차례로 바꾼다 */
let queue: Promise<void> = Promise.resolve();

addEventListener('popstate', () => {
  // 같은 페이지 안의 # 이동은 경로가 같아 그대로 둔다
  if (location.pathname !== shown) location.reload();
});

/** 신호로 받은 도구 페이지로 바꾼다. 받지 못하면 바깥은 그대로 둔다 (도구 칸은 이미 다음 도구로 바뀌어 있다) */
export function switchPage(frame: HTMLIFrameElement, tool: string): Promise<void> {
  queue = queue.then(() => swap(frame, tool)).catch(() => {});
  return queue;
}

/** 같은 순서로 놓인 요소들의 속성을 다음 페이지 것으로 맞춘다 (메뉴처럼 모든 페이지에서 모양이 같은 곳) */
function syncAttributes(next: Document, selector: string, names: string[]) {
  const mine = document.querySelectorAll(selector);
  const theirs = next.querySelectorAll(selector);
  if (mine.length !== theirs.length) return;
  mine.forEach((element, i) => {
    for (const name of names) {
      const value = theirs[i]!.getAttribute(name);
      if (value === null) element.removeAttribute(name);
      else element.setAttribute(name, value);
    }
  });
}

function syncHead(next: Document) {
  document.title = next.title;
  for (const meta of next.head.querySelectorAll('meta[name], meta[property]')) {
    const key = meta.hasAttribute('name') ? 'name' : 'property';
    const selector = `meta[${key}="${CSS.escape(meta.getAttribute(key)!)}"]`;
    document.head
      .querySelector(selector)
      ?.setAttribute('content', meta.getAttribute('content') ?? '');
  }
  for (const link of next.head.querySelectorAll('link[rel=canonical], link[rel=alternate]')) {
    const hreflang = link.getAttribute('hreflang');
    const selector = hreflang
      ? `link[rel=alternate][hreflang="${CSS.escape(hreflang)}"]`
      : 'link[rel=canonical]';
    document.head.querySelector(selector)?.setAttribute('href', link.getAttribute('href') ?? '');
  }
}

async function swap(frame: HTMLIFrameElement, tool: string) {
  const path = localizePath(`/${tool}/`, localeOf(location.pathname));
  if (path === shown) return;
  const response = await fetch(path);
  if (!response.ok) return;
  // <style>은 빼고 읽는다. 바꿀 글만 옮겨 오므로 필요 없고, 읽기만 해도 이 페이지 CSP로 검사해 위반으로 알린다 (GuideDialog와 같다)
  const html = (await response.text()).replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, '');
  const next = new DOMParser().parseFromString(html, 'text/html');
  const nextFrame = next.querySelector<HTMLIFrameElement>('iframe[data-tool-frame]');
  const area = frame.closest<HTMLElement>('[data-tool-area]');
  if (!nextFrame || !area || frame.dataset.src === nextFrame.dataset.src) return;

  const before = area.getBoundingClientRect().top;
  for (const region of document.querySelectorAll<HTMLElement>('[data-swap]')) {
    const replacement = next.querySelector(`[data-swap="${CSS.escape(region.dataset.swap!)}"]`);
    if (!replacement) continue;
    // 구역 안의 스크립트는 이 페이지에 이미 있다 (모든 도구 페이지가 같은 부품을 쓴다). 두 번 돌지 않게 뺀다
    for (const script of replacement.querySelectorAll('script:not([type="application/ld+json"])')) {
      script.remove();
    }
    region.replaceWith(document.importNode(replacement, true));
  }
  // 구역 밖의 구조화 데이터(도구 설명)
  const data = (doc: Document) =>
    [...doc.querySelectorAll('script[type="application/ld+json"]')].filter(
      (script) => !script.closest('[data-swap]'),
    );
  const [mine, theirs] = [data(document), data(next)];
  if (mine.length === theirs.length)
    mine.forEach((s, i) => (s.textContent = theirs[i]!.textContent));

  syncHead(next);
  // 머리글: 언어 바꾸기 링크, 펼침 메뉴·휴대폰 메뉴의 '지금 페이지' 표시
  syncAttributes(next, '.site-header a', ['href', 'aria-current']);
  syncAttributes(next, '.site-header button', ['data-current']);
  syncAttributes(next, '.site-header details', ['open']);
  area.setAttribute(
    'aria-label',
    next.querySelector('[data-tool-area]')?.getAttribute('aria-label') ?? '',
  );
  frame.title = nextFrame.title;
  frame.dataset.src = nextFrame.dataset.src;

  history.pushState(null, '', path);
  shown = path;
  // 위쪽(머리) 높이가 달라진 만큼 바로 스크롤해 도구 칸을 그 자리에 둔다
  const moved = area.getBoundingClientRect().top - before;
  if (moved !== 0) scrollBy({ top: moved, behavior: 'instant' });
}
