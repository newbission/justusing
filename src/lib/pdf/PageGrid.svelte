<!--
  PDF 한 파일의 페이지 격자. 번호 붙은 썸네일로 보여주고 순서 바꾸기·제외를 한다.
  합치기(파일마다 펼친 페이지)와 정리 도구가 함께 쓴다.

  pages 배열을 그대로 고친다 (순서 = 결과 순서, excluded = 결과에서 뺌).
  번호는 결과에 들어가는 페이지만 1부터 센다. 원래 몇 쪽이었는지는 썸네일 이름으로 알려 준다.
-->
<script module lang="ts">
  export interface GridPage {
    /** 원본 안의 페이지 순번 (0부터) */
    index: number;
    excluded: boolean;
  }
</script>

<script lang="ts">
  import { pick } from '../../frame/locale';
  import { FRAME_MESSAGES } from '../../frame/messages';

  const t = pick(FRAME_MESSAGES);
  import { tick } from 'svelte';
  import { flip } from 'svelte/animate';
  import Thumbnail from './Thumbnail.svelte';
  import type { PDFDocumentProxy } from './pdfjs';

  interface Props {
    doc: PDFDocumentProxy;
    pages: GridPage[];
    /** 스크린리더용 파일 이름 */
    label: string;
    /** 썸네일 한 변(px) */
    size?: number;
  }

  let { doc, pages = $bindable(), label, size = 96 }: Props = $props();

  const MOVE_MS = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 200;

  /** 결과에 들어가는 페이지의 새 번호 (제외된 페이지는 undefined) */
  const numbers = $derived.by(() => {
    let n = 0;
    return pages.map((page) => (page.excluded ? undefined : ++n));
  });

  /** 그 페이지의 pdf.js 객체. 같은 페이지는 pdf.js가 캐시하므로 여러 번 불러도 가볍다. */
  const pageCache = new Map<number, ReturnType<PDFDocumentProxy['getPage']>>();
  function load(index: number) {
    let promise = pageCache.get(index);
    if (!promise) pageCache.set(index, (promise = doc.getPage(index + 1)));
    return promise;
  }

  let grid: HTMLOListElement;

  // 끌어서 순서 바꾸기. 끄는 카드와 놓일 자리(0 = 맨 앞, pages.length = 맨 뒤).
  // 격자는 합치기 목록 줄 안에도 들어가므로 끌기 신호가 바깥 목록으로 퍼지지 않게 막는다.
  let dragIndex: number | undefined = $state();
  let dropAt: number | undefined = $state();

  function dragOver(event: DragEvent, position: number) {
    if (dragIndex === undefined) return; // 파일 끌기는 frame 전체가 받는다
    event.preventDefault();
    event.stopPropagation();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    dropAt = event.clientX < rect.left + rect.width / 2 ? position : position + 1;
  }

  function drop(event: DragEvent) {
    if (dragIndex === undefined || dropAt === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    const from = pages.findIndex((page) => page.index === dragIndex);
    const to = dropAt > from ? dropAt - 1 : dropAt;
    pages.splice(to, 0, ...pages.splice(from, 1));
    dragEnd();
  }

  function dragEnd() {
    dragIndex = undefined;
    dropAt = undefined;
  }

  async function move(page: GridPage, delta: -1 | 1) {
    const from = pages.indexOf(page);
    const to = from + delta;
    if (to < 0 || to >= pages.length) return;
    pages.splice(to, 0, ...pages.splice(from, 1));
    // 옮긴 카드의 같은 버튼(끝에 닿아 꺼졌으면 반대 버튼)에 포커스를 다시 맞춘다
    await tick();
    const card = grid.querySelector(`[data-page-index="${page.index}"]`);
    const same = card?.querySelector<HTMLButtonElement>(`[data-page-move="${delta}"]`);
    const other = card?.querySelector<HTMLButtonElement>(`[data-page-move="${-delta}"]`);
    (same && !same.disabled ? same : other)?.focus();
  }
</script>

<ol class="grid" bind:this={grid} aria-label={t.pages.gridLabel(label)}>
  {#each pages as page, position (page.index)}
    <li
      class="card"
      class:excluded={page.excluded}
      class:dragging={dragIndex === page.index}
      class:drop-before={dropAt === position}
      class:drop-after={dropAt === pages.length && position === pages.length - 1}
      draggable="true"
      ondragstart={(event) => {
        event.stopPropagation();
        dragIndex = page.index;
        event.dataTransfer!.effectAllowed = 'move';
        event.dataTransfer!.setData('text/plain', '');
      }}
      ondragover={(event) => dragOver(event, position)}
      ondrop={drop}
      ondragend={(event) => {
        event.stopPropagation();
        dragEnd();
      }}
      data-page-index={page.index}
      animate:flip={{ duration: MOVE_MS }}
      aria-label="{t.pages.original(page.index + 1)}, {page.excluded
        ? t.pages.excluded
        : t.pages.position(numbers[position] ?? 0)}"
    >
      <div class="thumb" style:width="{size}px" style:height="{size}px">
        {#await load(page.index) then proxy}
          <Thumbnail page={proxy} {size} />
        {/await}
        <span class="number" aria-hidden="true">{numbers[position] ?? t.pages.exclude}</span>
      </div>
      <div class="tools">
        <button
          type="button"
          data-page-move="-1"
          disabled={position === 0}
          onclick={() => move(page, -1)}
          aria-label={t.pages.earlier(page.index + 1)}>◀</button
        >
        <button
          type="button"
          class="toggle"
          aria-pressed={page.excluded}
          onclick={() => (page.excluded = !page.excluded)}
          aria-label={t.pages.toggle(page.index + 1, page.excluded)}
          >{page.excluded ? t.pages.restore : t.pages.exclude}</button
        >
        <button
          type="button"
          data-page-move="1"
          disabled={position === pages.length - 1}
          onclick={() => move(page, 1)}
          aria-label={t.pages.later(page.index + 1)}>▶</button
        >
      </div>
    </li>
  {/each}
</ol>

<style>
  .grid {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 6px;
    border-radius: var(--radius);
    transition: background-color 0.12s;
  }
  .card[draggable='true'] {
    cursor: grab;
  }
  .card.dragging {
    opacity: 0.4;
  }
  /* 놓일 자리 표시 (크기가 바뀌지 않도록 그림자로) */
  .card.drop-before {
    box-shadow: inset 3px 0 0 var(--color-accent);
  }
  .card.drop-after {
    box-shadow: inset -3px 0 0 var(--color-accent);
  }
  .card:hover,
  .card:focus-within {
    background: var(--color-hover);
  }
  .thumb {
    position: relative;
  }
  /* 결과 순서 번호 (제외된 페이지는 '제외') */
  .number {
    position: absolute;
    top: 0;
    left: 0;
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    border-radius: 11px;
    background: var(--color-text);
    color: var(--color-bg);
    font-size: 12px;
    font-weight: 600;
    line-height: 22px;
    text-align: center;
  }
  /* 제외된 페이지: 흐리게 + 사선. 지우지 않으므로 '복구'로 되돌릴 수 있다 */
  .excluded .thumb {
    opacity: 0.35;
  }
  .excluded .thumb::after {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to top right,
      transparent calc(50% - 1px),
      var(--color-text) 50%,
      transparent calc(50% + 1px)
    );
    content: '';
  }
  .excluded .number {
    background: var(--color-muted);
  }

  .tools {
    display: flex;
    gap: 4px;
  }
  button {
    height: 26px;
    min-width: 26px;
    padding: 0 6px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius);
    background: var(--color-surface);
    font-size: 12px;
    cursor: pointer;
    transition:
      background-color 0.12s,
      border-color 0.12s;
  }
  button:hover:not(:disabled) {
    border-color: var(--color-muted);
    background: var(--color-hover);
  }
  button:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .toggle[aria-pressed='true'] {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }
</style>
