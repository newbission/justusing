/**
 * '예시로 따라 하기': 견본 파일을 넣고 사용법을 한 단계씩 보여 주며, 단계에서 누를 곳만 밝게 비춘다.
 *
 * - 도구 페이지의 '예시로 따라 하기'가 창(TourButton.astro)을 띄우고, 그 안에 이 도구 화면을 하나 더 연다
 *   (주소 #tour=1). 따라 하기는 그 화면에서만 돌고, 창을 닫으면 견본과 함께 사라진다. 원래 도구 화면은 그대로다.
 * - 단계 글은 frame 페이지에 빌드 때 넣어 둔 것(body의 data-tour, 그 도구의 사용법)만 쓴다.
 *   바깥 페이지에는 광고 스크립트도 있으므로 바깥에서 받은 글을 도구 화면에 띄우지 않는다.
 * - 누를 곳: 단계 글에 따옴표로 적힌 버튼 이름("PDF 나누기")과 같은 버튼·고르기, 또는 단계 글에 이름이 나오는
 *   고르기 묶음(예: '줄이는 정도'). 버튼 이름이 없는 단계는 작업 영역(목록·쪽 격자·쪽 화면)을 비춘다.
 *   도구마다 따로 적을 것이 없다. 나중에 나타나는 버튼(다운로드 등)도 그때 비춘다.
 * - 첫 단계(파일 고르기)는 견본을 넣은 것으로 대신한다.
 */
import { pick } from './locale';
import { FRAME_MESSAGES } from './messages';
import { deliverFiles, onFilesArrived } from './drop';
import { loadSamples } from './samples';

const TARGET = 'tour-target';
const t = pick(FRAME_MESSAGES).tour;

/** 따라 하기 창 안에서 열린 도구 화면인지 (주소 #tour=1) */
export const isTourFrame =
  typeof location !== 'undefined' &&
  new URLSearchParams(location.hash.slice(1)).get('tour') === '1';

/** 단계 글에서 따옴표 안의 버튼 이름들 */
function quoted(step: string): string[] {
  return [...step.matchAll(/["“]([^"”]+)["”]/g)].map((match) => match[1]!.trim());
}

const visible = (element: HTMLElement) => element.offsetParent !== null;

/** 단계에서 누를 곳 */
function findTargets(step: string): HTMLElement[] {
  const found: HTMLElement[] = [];
  const add = (element: HTMLElement) => {
    // 붙은 고르기 버튼은 묶음이 테두리를 잘라 내므로 묶음 전체를 비춘다
    const target = element.closest<HTMLElement>('[role="radiogroup"]') ?? element;
    if (!found.includes(target)) found.push(target);
  };
  const names = quoted(step);
  for (const element of document.querySelectorAll<HTMLElement>(
    '#frame-root button, #frame-root label, #frame-root a',
  )) {
    if (!visible(element)) continue;
    const label = element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    if (
      names.some(
        (name) =>
          label === name ||
          // 버튼 이름 뒤에 바뀌는 말이 붙는다 ("모두 받기 (ZIP, 2장)", "데이터 받기 (7MB)")
          label.startsWith(`${name} `) ||
          // 고르기(라디오)는 긴 이름과 짧은 이름이 한 label 안에 붙어 있어 앞부분으로 맞춘다
          (element.tagName === 'LABEL' && label.startsWith(name)),
      )
    ) {
      add(element);
    }
  }
  // 따옴표 이름으로 못 찾았으면, 이름이 단계 글에 나오는 고르기 묶음 ("줄이는 정도를 고릅니다")
  if (found.length > 0) return found;
  for (const group of document.querySelectorAll<HTMLElement>(
    '#frame-root [role="radiogroup"][aria-label], #frame-root [role="group"][aria-label]',
  )) {
    const name = group.getAttribute('aria-label')!.trim();
    if (name.length >= 2 && step.includes(name) && visible(group)) add(group);
  }
  // 버튼 이름이 없는 단계("목록에서 순서를 확인합니다", "쪽 위에서 끌어 그립니다")는 작업 영역(목록·쪽 격자·쪽 화면)을 비춘다.
  // 이름이 있는데 못 찾았으면 아직 나타나지 않은 버튼(다운로드 등)이라 비추지 않고 기다린다
  if (found.length === 0 && names.length === 0) {
    const area = workArea();
    if (area) found.push(area);
  }
  return found;
}

/** 도구 화면에서 가장 넓은 스크롤 영역 (목록·쪽 격자·쪽 화면) */
function workArea(): HTMLElement | undefined {
  let best: HTMLElement | undefined;
  let bestArea = 0;
  for (const node of document.querySelectorAll<HTMLElement>('#frame-root *')) {
    if (!/(auto|scroll)/.test(getComputedStyle(node).overflowY) || !visible(node)) continue;
    const rect = node.getBoundingClientRect();
    if (rect.width * rect.height > bestArea) {
      best = node;
      bestArea = rect.width * rect.height;
    }
  }
  return best;
}

/** 비출 곳이 보이게 가장 가까운 스크롤 영역만 움직인다 (scrollIntoView는 바깥 페이지까지 스크롤한다) */
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

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

export function setupFrameTour() {
  const steps: string[] = JSON.parse(document.body.dataset.tour ?? '[]');
  if (!isTourFrame || steps.length === 0) return;

  let index = -1;
  /** 견본을 받는 중. 그사이 사용자가 파일을 넣으면 늦게 온 견본을 버린다 */
  let loading = false;
  let run = 0;
  let marked: HTMLElement[] = [];

  // 누를 곳 둘레를 빼고 어둡게 덮는 막 (밝은 구멍의 그림자가 나머지를 덮는다). 누르는 것은 막지 않는다
  const spot = element('div', 'tour-spot');
  spot.hidden = true;
  const spotNumber = element('span', 'tour-spot-number');
  spot.append(spotNumber);

  const card = element('div', 'frame-tour');
  card.hidden = true;
  card.setAttribute('role', 'region');
  card.setAttribute('aria-label', t.region);
  const head = element('div', 'tour-head');
  const number = element('span', 'tour-number');
  const count = element('span', 'tour-count');
  head.append(number, count);
  const text = element('p');
  text.setAttribute('aria-live', 'polite');
  const actions = element('div', 'tour-actions');
  const button = (label: string, onclick: () => void, primary = false) => {
    const node = element('button', primary ? 'primary' : undefined);
    node.type = 'button';
    node.textContent = label;
    node.addEventListener('click', onclick);
    return node;
  };
  const previous = button(t.previous, () => show(index - 1));
  const next = button(t.next, () => (index < steps.length - 1 ? show(index + 1) : finish()), true);
  const retry = button(t.retry, () => void start(), true);
  retry.hidden = true;
  actions.append(previous, next, retry);
  card.append(head, text, actions);
  document.body.append(spot, card);

  function unmark() {
    for (const node of marked) node.classList.remove(TARGET);
    marked = [];
  }

  function mark() {
    // 첫 단계(파일 고르기)는 견본으로 대신해 비출 곳이 없다
    const targets = index <= 0 ? [] : findTargets(steps[index]!);
    if (targets.length !== marked.length || targets.some((node, i) => node !== marked[i])) {
      unmark();
      marked = targets;
      for (const node of marked) node.classList.add(TARGET);
      if (marked[0]) reveal(marked[0]);
    }
    place();
  }

  /** 막의 밝은 구멍을 누를 곳들을 모두 감싸는 자리로 옮긴다 */
  function place() {
    const rects = marked.filter(visible).map((node) => node.getBoundingClientRect());
    if (rects.length === 0) {
      spot.hidden = true;
      return;
    }
    // 둘레를 조금 띄우되 화면 밖으로 나가지 않게 한다 (번호가 잘린다)
    const pad = 6;
    const edge = 2;
    const left = Math.max(edge, Math.min(...rects.map((rect) => rect.left)) - pad);
    const top = Math.max(14, Math.min(...rects.map((rect) => rect.top)) - pad);
    const right = Math.min(innerWidth - edge, Math.max(...rects.map((rect) => rect.right)) + pad);
    const bottom = Math.min(
      innerHeight - edge,
      Math.max(...rects.map((rect) => rect.bottom)) + pad,
    );
    // 스크립트에서 element.style을 바꾸는 것은 CSP가 막지 않는다 (HTML style 속성만 막는다)
    spot.style.left = `${left}px`;
    spot.style.top = `${top}px`;
    spot.style.width = `${right - left}px`;
    spot.style.height = `${bottom - top}px`;
    spot.hidden = false;
  }

  function show(at: number) {
    index = Math.max(0, Math.min(steps.length - 1, at));
    number.textContent = String(index + 1);
    spotNumber.textContent = String(index + 1);
    count.textContent = t.count(index + 1, steps.length);
    text.textContent = index === 0 ? t.sampleLoaded : steps[index]!;
    previous.disabled = index === 0;
    next.textContent = index === steps.length - 1 ? t.finish : t.next;
    mark();
  }

  /** 마치기: 창을 닫아 달라고 바깥에 알린다 (내용 없는 신호) */
  function finish() {
    if (parent !== window) parent.postMessage({ type: 'tour-end' }, '*');
  }

  /** 도구 화면에 이 글자가 몇 번 나오는지 */
  function countOf(name: string): number {
    return (document.getElementById('frame-root')!.textContent ?? '').split(name).length - 1;
  }

  /** 도구 화면에 글자가 더 나타날 때까지 잠깐 기다린다 */
  async function shown(name: string, before: number): Promise<boolean> {
    for (let waited = 0; waited < 3000; waited += 100) {
      if (countOf(name) > before) return true;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return false;
  }

  /** 견본을 넣지 못했을 때: 단계 이동 대신 다시 받기만 둔다 */
  function failure(message: string) {
    index = -1;
    number.textContent = '!';
    count.textContent = '';
    text.textContent = message;
    previous.hidden = true;
    next.hidden = true;
    retry.hidden = false;
    card.hidden = false;
    document.documentElement.classList.add('touring');
  }

  async function start() {
    if (loading) return;
    loading = true;
    const current = ++run;
    let files: File[];
    try {
      files = await loadSamples();
    } catch {
      if (current === run) {
        loading = false;
        failure(t.failed);
      }
      return;
    }
    if (current !== run) return;
    loading = false;
    // 도구 화면은 놓인 파일과 같은 길(onFrameFiles)로 견본을 받는다
    const before = countOf(files[0]!.name);
    deliverFiles(files);
    // 도구가 받았는지 본다. 모든 도구가 넣은 파일 이름을 보여 준다
    if (!(await shown(files[0]!.name, before))) {
      failure(t.notAccepted);
      return;
    }
    previous.hidden = false;
    next.hidden = false;
    retry.hidden = true;
    card.hidden = false;
    document.documentElement.classList.add('touring');
    // 누를 곳이 나중에 나타나거나(다운로드) 바뀌면 다시 비춘다
    let queued = false;
    new MutationObserver(() => {
      if (queued || index < 0) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        mark();
      });
    }).observe(document.getElementById('frame-root')!, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    // 스크롤·크기가 바뀌면 막의 구멍도 따라간다
    addEventListener('resize', place);
    addEventListener('scroll', place, true);
    show(0);
  }

  // 견본을 받는 사이 사용자가 파일을 넣으면(놓기·고르기) 늦게 온 견본을 버린다
  const cancelLoading = () => {
    if (!loading) return;
    loading = false;
    run++;
  };
  onFilesArrived(cancelLoading);
  addEventListener(
    'change',
    (event) => {
      if (event.target instanceof HTMLInputElement && event.target.type === 'file') cancelLoading();
    },
    true,
  );

  // 도구 화면이 파일을 받을 준비를 마친 뒤 시작한다 (도구는 이 스크립트 다음에 붙는다)
  if (document.readyState === 'complete') requestAnimationFrame(() => void start());
  else addEventListener('load', () => requestAnimationFrame(() => void start()), { once: true });
}
