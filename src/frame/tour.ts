/**
 * '따라 하기': 견본 파일을 넣고 사용법을 한 단계씩 보여 주며, 단계에 적힌 버튼을 도구 화면에서 짚어 준다.
 *
 * - 바깥 페이지의 '따라 하기' 버튼이 내용 없는 신호 { type: 'tour-start' }만 보낸다 (ToolHelp.astro).
 *   단계 글은 frame 페이지에 빌드 때 넣어 둔 것(body의 data-tour, 그 도구의 사용법)만 쓴다.
 *   바깥 페이지에는 광고 스크립트도 있으므로 바깥이 보낸 글을 도구 화면에 띄우지 않는다.
 * - 단계 글에 따옴표로 적힌 버튼 이름("PDF 나누기")과 글자가 같은 버튼·고르기를 찾아 테두리로 짚는다.
 *   도구마다 따로 적을 것이 없다. 버튼이 나중에 나타나면(다운로드 등) 그때 짚는다.
 * - 첫 단계(파일 고르기)는 견본을 넣은 것으로 대신한다.
 * - 저절로 시작하지 않는다 (저절로 뜨는 안내는 광고 심사의 '과도한 팝업' 위험).
 */
import { pick } from './locale';
import { FRAME_MESSAGES } from './messages';
import { deliverFiles } from './drop';
import { loadSamples } from './samples';

const TARGET = 'tour-target';
const t = pick(FRAME_MESSAGES).tour;

/** 단계 글에서 따옴표 안의 버튼 이름들 */
function quoted(step: string): string[] {
  return [...step.matchAll(/["“]([^"”]+)["”]/g)].map((match) => match[1]!.trim());
}

/** 화면에 보이는 버튼·고르기 중 글자가 이름과 같은 것 (휴대폰의 짧은 이름은 단계 글에 따로 적혀 있다) */
function findTargets(names: string[]): HTMLElement[] {
  if (names.length === 0) return [];
  const found: HTMLElement[] = [];
  for (const element of document.querySelectorAll<HTMLElement>(
    '#frame-root button, #frame-root label, #frame-root a',
  )) {
    if (element.closest('.frame-tour')) continue;
    if (element.offsetParent === null) continue;
    const label = element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    // 고르기(라디오)는 긴 이름과 짧은 이름이 한 label 안에 있어 앞부분으로 맞춘다
    if (
      names.some(
        (name) => label === name || (element.tagName === 'LABEL' && label.startsWith(name)),
      )
    ) {
      // 붙은 고르기 버튼은 묶음이 테두리를 잘라 내므로 묶음 전체를 짚는다
      const target = element.closest<HTMLElement>('[role="radiogroup"]') ?? element;
      if (!found.includes(target)) found.push(target);
    }
  }
  return found;
}

/** 짚은 것이 보이게 가장 가까운 스크롤 영역만 움직인다 (scrollIntoView는 바깥 페이지까지 스크롤한다) */
function reveal(element: HTMLElement) {
  for (let box = element.parentElement; box; box = box.parentElement) {
    const style = getComputedStyle(box);
    if (!/(auto|scroll)/.test(style.overflowY) || box.scrollHeight <= box.clientHeight) continue;
    const top = element.getBoundingClientRect().top - box.getBoundingClientRect().top;
    if (top < 0 || top > box.clientHeight - element.offsetHeight) {
      box.scrollTop += top - box.clientHeight / 3;
    }
    return;
  }
}

export function setupFrameTour() {
  const steps: string[] = JSON.parse(document.body.dataset.tour ?? '[]');
  if (steps.length === 0) return;

  let index = -1;
  /** 견본을 받는 중이거나 따라 하는 중이면 다시 시작하지 않는다 (견본이 두 번 들어간다) */
  let busy = false;
  let observer: MutationObserver | undefined;
  let marked: HTMLElement[] = [];

  const panel = document.createElement('div');
  panel.className = 'frame-tour';
  panel.hidden = true;
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', t.region);
  const count = document.createElement('strong');
  const text = document.createElement('p');
  text.setAttribute('aria-live', 'polite');
  const actions = document.createElement('div');
  const button = (label: string, onclick: () => void, primary = false) => {
    const element = document.createElement('button');
    element.type = 'button';
    element.textContent = label;
    if (primary) element.className = 'primary';
    element.addEventListener('click', onclick);
    return element;
  };
  const previous = button(t.previous, () => show(index - 1));
  const retry = button(t.retry, () => void start(), true);
  retry.hidden = true;
  const next = button(t.next, () => (index < steps.length - 1 ? show(index + 1) : stop()), true);
  actions.append(previous, next, retry, button(t.close, stop));
  panel.append(count, text, actions);
  document.body.append(panel);

  function unmark() {
    for (const element of marked) element.classList.remove(TARGET);
    marked = [];
  }

  function mark() {
    // 첫 단계(파일 고르기)는 견본으로 대신해 짚을 것이 없다
    const targets = index === 0 ? [] : findTargets(quoted(steps[index]!));
    if (targets.length === marked.length && targets.every((element, i) => element === marked[i]))
      return;
    unmark();
    marked = targets;
    for (const element of marked) element.classList.add(TARGET);
    if (marked[0]) reveal(marked[0]);
  }

  function show(next: number) {
    index = Math.max(0, Math.min(steps.length - 1, next));
    count.textContent = t.count(index + 1, steps.length);
    text.textContent = index === 0 ? t.sampleLoaded : steps[index]!;
    previous.disabled = index === 0;
    nextButton(index === steps.length - 1);
    mark();
  }

  function nextButton(last: boolean) {
    next.textContent = last ? t.finish : t.next;
  }

  /** 견본을 받지 못했을 때: 단계 이동 대신 다시 받기만 둔다 */
  function failed(on: boolean) {
    previous.hidden = on;
    next.hidden = on;
    retry.hidden = !on;
  }

  function stop() {
    busy = false;
    observer?.disconnect();
    observer = undefined;
    unmark();
    panel.hidden = true;
    document.documentElement.classList.remove('touring');
  }

  async function start() {
    if (busy) return;
    busy = true;
    let files: File[];
    try {
      files = await loadSamples();
    } catch {
      busy = false;
      index = -1;
      count.textContent = '';
      text.textContent = t.failed;
      failed(true);
      panel.hidden = false;
      document.documentElement.classList.add('touring');
      return;
    }
    failed(false);
    // 도구 화면은 놓인 파일과 같은 길(onFrameFiles)로 견본을 받는다
    deliverFiles(files);
    panel.hidden = false;
    document.documentElement.classList.add('touring');
    // 버튼이 나중에 나타나거나(다운로드) 바뀌면 다시 짚는다
    observer?.disconnect();
    let queued = false;
    observer = new MutationObserver(() => {
      if (queued || index < 0) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        if (!panel.hidden) mark();
      });
    });
    observer.observe(document.getElementById('frame-root')!, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    // 첫 단계(파일 고르기)는 견본을 넣었다는 말로 대신한다
    show(0);
  }

  addEventListener('message', (event) => {
    if (event.source !== parent || event.data?.type !== 'tour-start') return;
    void start();
  });
  // 바깥 페이지는 이 신호를 받은 뒤에야 시작 신호를 보낸다 (그전에 누른 것은 바깥이 들고 있다)
  if (parent !== window) parent.postMessage({ type: 'tour-ready' }, '*');
}
