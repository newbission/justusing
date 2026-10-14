<!--
  쪽마다 돌리는 격자. 썸네일을 다시 그리지 않고 CSS로 돌려서 가볍고, 누른 방향으로 돌아가는 모션이 보인다.

  rotations는 쪽마다 누적 각도다 (오른쪽 네 번 = 360). 270→0처럼 되돌아 도는 모션이 생기지 않게
  누적으로 두고, 실제 결과에는 360으로 나눈 나머지만 쓴다 (normalize).
-->
<script module lang="ts">
  /** 누적 각도를 0·90·180·270 중 하나로 */
  export function normalize(angle: number) {
    return ((angle % 360) + 360) % 360;
  }
</script>

<script lang="ts">
  import { pick } from '../../../frame/locale';
  import { MESSAGES } from './messages';

  const t = pick(MESSAGES);
  import Thumbnail from '../../../lib/pdf/Thumbnail.svelte';
  import type { PDFDocumentProxy } from '../../../lib/pdf/pdfjs';

  interface Props {
    doc: PDFDocumentProxy;
    /** 쪽마다 누적 회전 각도 (index 0 = 1쪽) */
    rotations: number[];
    /** 썸네일 한 변(px) */
    size?: number;
  }

  let { doc, rotations = $bindable(), size = 112 }: Props = $props();

  const indices = $derived(Array.from({ length: doc.numPages }, (_, i) => i));

  const pageCache = new Map<number, ReturnType<PDFDocumentProxy['getPage']>>();
  function load(index: number) {
    let promise = pageCache.get(index);
    if (!promise) pageCache.set(index, (promise = doc.getPage(index + 1)));
    return promise;
  }
</script>

<ol class="grid" aria-label={t.grid}>
  {#each indices as index (index)}
    {@const angle = normalize(rotations[index] ?? 0)}
    <li class="card" class:turned={angle !== 0}>
      <div class="frame" style:width="{size}px" style:height="{size}px">
        <div class="spin" style:transform="rotate({rotations[index] ?? 0}deg)">
          {#await load(index) then page}
            <Thumbnail {page} {size} />
          {/await}
        </div>
        <span class="number">{index + 1}</span>
        {#if angle !== 0}<span class="angle">{angle}°</span>{/if}
      </div>
      <div class="tools">
        <button
          type="button"
          onclick={() => (rotations[index] = (rotations[index] ?? 0) - 90)}
          aria-label={t.left(index + 1)}>↺</button
        >
        <button
          type="button"
          onclick={() => (rotations[index] = (rotations[index] ?? 0) + 90)}
          aria-label={t.right(index + 1)}>↻</button
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
    border: 2px solid transparent;
    border-radius: var(--radius);
    transition:
      background-color 0.12s,
      border-color 0.12s;
  }
  .card:hover,
  .card:focus-within {
    background: var(--color-hover);
  }
  /* 돌린 쪽은 포인트색 테두리로 표시 */
  .card.turned {
    border-color: var(--color-accent);
  }
  .frame {
    position: relative;
  }
  .spin {
    width: 100%;
    height: 100%;
    transition: transform 0.25s ease;
  }
  @media (prefers-reduced-motion: reduce) {
    .spin {
      transition: none;
    }
  }
  .number,
  .angle {
    position: absolute;
    top: 0;
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    border-radius: 11px;
    font-size: 12px;
    font-weight: 600;
    line-height: 22px;
    text-align: center;
  }
  .number {
    left: 0;
    background: var(--color-text);
    color: var(--color-bg);
  }
  .angle {
    right: 0;
    background: var(--color-accent);
    color: var(--color-bg);
  }
  .tools {
    display: flex;
    gap: 6px;
  }
  button {
    width: 36px;
    height: 30px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius);
    background: var(--color-surface);
    font-size: 16px;
    cursor: pointer;
    transition:
      background-color 0.12s,
      border-color 0.12s;
  }
  button:hover {
    border-color: var(--color-muted);
    background: var(--color-hover);
  }
</style>
