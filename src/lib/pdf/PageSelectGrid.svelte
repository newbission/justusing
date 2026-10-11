<!--
  페이지 고르기 격자. 썸네일을 누르면 선택되고 다시 누르면 풀린다 (나누기의 '고른 페이지만').
  selected를 주지 않으면 보기 전용이다 (범위 모드에서 어느 쪽이 어느 파일로 가는지 표시).
-->
<script lang="ts">
  import Thumbnail from './Thumbnail.svelte';
  import type { PDFDocumentProxy } from './pdfjs';

  interface Props {
    doc: PDFDocumentProxy;
    /** 페이지마다 선택 여부 (index 0 = 1쪽). 주지 않으면 보기 전용 */
    selected?: boolean[];
    /** 페이지 아래에 붙일 작은 표시 (예: '파일 2'). 없으면 표시하지 않는다 */
    note?: (index: number) => string | undefined;
    /** 썸네일 한 변(px) */
    size?: number;
  }

  let { doc, selected = $bindable(), note, size = 96 }: Props = $props();

  const indices = $derived(Array.from({ length: doc.numPages }, (_, i) => i));

  const pageCache = new Map<number, ReturnType<PDFDocumentProxy['getPage']>>();
  function load(index: number) {
    let promise = pageCache.get(index);
    if (!promise) pageCache.set(index, (promise = doc.getPage(index + 1)));
    return promise;
  }
</script>

<ol class="grid" aria-label="페이지">
  {#each indices as index (index)}
    {@const text = note?.(index)}
    <li>
      {#if selected}
        <button
          type="button"
          class="card"
          class:selected={selected[index]}
          aria-pressed={selected[index]}
          aria-label="{index + 1}쪽"
          onclick={() => (selected[index] = !selected[index])}
        >
          {#await load(index) then page}
            <Thumbnail {page} {size} />
          {/await}
          <span class="number">{index + 1}</span>
          {#if selected[index]}<span class="check" aria-hidden="true">✓</span>{/if}
        </button>
      {:else}
        <div class="card" role="img" aria-label="{index + 1}쪽{text ? `, ${text}` : ''}">
          {#await load(index) then page}
            <Thumbnail {page} {size} />
          {/await}
          <span class="number">{index + 1}</span>
        </div>
      {/if}
      {#if text}<span class="note" aria-hidden="true">{text}</span>{/if}
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
  li {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .card {
    position: relative;
    display: block;
    padding: 6px;
    border: 2px solid transparent;
    border-radius: var(--radius);
    background: transparent;
  }
  button.card {
    cursor: pointer;
    transition:
      background-color 0.12s,
      border-color 0.12s;
  }
  button.card:hover {
    background: var(--color-hover);
  }
  button.card.selected {
    border-color: var(--color-accent);
    background: var(--color-accent-soft);
  }
  .number {
    position: absolute;
    top: 6px;
    left: 6px;
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
  .check {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--color-accent);
    color: var(--color-bg);
    font-size: 13px;
    line-height: 22px;
    text-align: center;
  }
  .note {
    color: var(--color-accent);
    font-size: 12px;
    font-weight: 600;
  }
</style>
