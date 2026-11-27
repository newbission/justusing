/**
 * 결과를 다음 도구로 넘긴 뒤 바깥 페이지를 그 도구 페이지로 바꾼다 (docs/foundations/tool-chaining). 바깥 페이지에서 돈다.
 *
 * 바깥은 공개 도구 페이지 주소와 전환 확인용 포트만 받는다. 먼저 글·제목을 준비하고,
 * frame이 새 도구를 띄웠다고 알려 주면 바꾼다. 파일은 frame 안에만 있다.
 * - 다음 도구 페이지(우리 공개 페이지)를 받아 [data-swap] 구역(머리·쓰임새와 사용법·FAQ·관련 글),
 *   <head>의 제목·설명·주소·언어판, 머리글의 언어 바꾸기 링크·메뉴의 '지금 페이지' 표시, 도구 칸 이름을 맞춘다
 * - 도구 칸과 광고 칸은 DOM에서 옮기지 않는다 (iframe을 옮기면 다시 불러와 넘긴 파일을 잃고, 광고는 다시 그려진다)
 * - 바꾸는 동안 도구 칸이 화면에서 움직이지 않게 위쪽 높이가 달라진 만큼 같은 순간에 스크롤한다 (CLS)
 * - pushState로 주소를 바꾼다. 뒤로·앞으로 가기로 경로가 달라지면 그 주소를 새로 연다 (넘긴 파일은 남지 않는다)
 *
 * ToolFrame이 신호를 받을 때만 이 모듈을 받는다 (도구 페이지 첫 화면 무게에 들지 않는다).
 */

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

export async function preparePage(frame: HTMLIFrameElement, path: string, port: MessagePort) {
  const request = new AbortController();
  let commit: (() => void) | undefined;
  port.onmessage = (event) => {
    port.close();
    request.abort();
    if (event.data === true) commit?.();
  };
  // frame이 기다리기를 그만두면 준비하던 응답을 버린다. 다른 시도는 새 포트로 온다.
  const response = await fetch(path, { signal: request.signal });
  if (!response.ok) throw new Error('다음 도구 페이지를 받지 못했습니다');
  // <style>은 빼고 읽는다. 바꿀 글만 옮겨 오므로 필요 없고, 읽기만 해도 이 페이지 CSP로 검사해 위반으로 알린다 (GuideDialog와 같다)
  const html = (await response.text()).replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, '');
  const next = new DOMParser().parseFromString(html, 'text/html');
  const nextFrame = next.querySelector<HTMLIFrameElement>('iframe[data-tool-frame]');
  const area = frame.closest<HTMLElement>('[data-tool-area]');
  if (!nextFrame || !area || nextFrame.dataset.src !== path + 'frame/')
    throw new Error('다음 도구 페이지의 도구 칸이 없습니다');

  const regions = [...document.querySelectorAll<HTMLElement>('[data-swap]')].map((region) => {
    const replacement = next.querySelector(`[data-swap="${CSS.escape(region.dataset.swap!)}"]`);
    if (!replacement) throw new Error('다음 도구 페이지의 설명이 없습니다');
    // 구역 안의 스크립트는 이 페이지에 이미 있다 (모든 도구 페이지가 같은 부품을 쓴다). 두 번 돌지 않게 뺀다
    for (const script of replacement.querySelectorAll('script:not([type="application/ld+json"])')) {
      script.remove();
    }
    return [region, document.importNode(replacement, true)] as const;
  });
  commit = () => {
    const before = area.getBoundingClientRect().top;
    for (const [region, replacement] of regions) region.replaceWith(replacement);
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
    // 위쪽(머리) 높이가 달라진 만큼 바로 스크롤해 도구 칸을 그 자리에 둔다
    const moved = area.getBoundingClientRect().top - before;
    if (moved !== 0) scrollBy({ top: moved, behavior: 'instant' });
  };
  port.postMessage(true);
}
