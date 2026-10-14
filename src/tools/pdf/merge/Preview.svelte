<!--
  합치기 전 미리보기. 실제로 합치지 않고, 원본에서 정한 순서대로 페이지를 이어 그린다.
  도구 칸 전체를 덮는 화면이다 (격리 frame 안이라 광고와 겹치지 않는다).
-->
<script module lang="ts">
  import type { PDFDocumentProxy } from '../../../lib/pdf/pdfjs';

  export interface PreviewPage {
    doc: PDFDocumentProxy;
    /** 원본 안의 페이지 순번 (0부터) */
    index: number;
    /** 어느 파일의 페이지인지 보여 줄 파일 이름 */
    fileName: string;
  }
</script>

<script lang="ts">
  import { pick } from '../../../frame/locale';
  import { MESSAGES } from './messages';

  const t = pick(MESSAGES);
  import { onMount } from 'svelte';
  import PdfPage from '../../../lib/pdf/PdfPage.svelte';

  interface Props {
    pages: PreviewPage[];
    onclose: () => void;
  }

  let { pages, onclose }: Props = $props();

  /** 순서를 한눈에 보도록 여러 쪽이 한 화면에 들어오는 크기로 그린다. 좁은 화면에서는 폭에 맞춘다. */
  const PAGE_WIDTH = 240;
  /** 페이지 양옆 여백 합계(px) */
  const SIDE_PADDING = 32;
  let width = $state(0);
  let closeButton: HTMLButtonElement;

  function fitScale(pageWidth: number) {
    return Math.min(PAGE_WIDTH, width - SIDE_PADDING) / pageWidth;
  }

  onMount(() => {
    // 열리면 닫기 버튼으로 포커스를 옮기고, 닫히면 원래 있던 곳(미리보기 버튼)으로 돌려준다
    const previous = document.activeElement as HTMLElement | null;
    closeButton.focus();
    return () => previous?.focus();
  });
</script>

<div
  class="preview"
  role="dialog"
  aria-modal="true"
  aria-label={t.previewLabel}
  tabindex="-1"
  onkeydown={(event) => {
    if (event.key === 'Escape') onclose();
  }}
>
  <div class="bar">
    <p>{t.previewTitle(pages.length)} <span>{t.previewNote}</span></p>
    <button type="button" bind:this={closeButton} onclick={onclose}>{t.close}</button>
  </div>
  <ol class="pages" bind:clientWidth={width}>
    {#each pages as page, position (position)}
      <li>
        <span class="caption">{t.caption(position + 1, page.fileName, page.index + 1)}</span>
        {#if width > 0}
          {#await page.doc.getPage(page.index + 1) then proxy}
            <PdfPage page={proxy} scale={fitScale(proxy.getViewport({ scale: 1 }).width)} />
          {/await}
        {/if}
      </li>
    {/each}
  </ol>
</div>

<style>
  .preview {
    position: absolute;
    inset: 0;
    z-index: 10;
    display: flex;
    flex-direction: column;
    background: var(--color-bg);
  }
  .bar {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    height: 56px;
    padding: 0 16px;
    border-bottom: 1px solid var(--color-line);
    background: var(--color-surface);
  }
  .bar p {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
  }
  .bar span {
    margin-left: 8px;
    color: var(--color-muted);
    font-size: 13px;
    font-weight: 400;
  }
  .bar button {
    height: 36px;
    padding: 0 16px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius);
    background: transparent;
    cursor: pointer;
  }
  .bar button:hover {
    border-color: var(--color-muted);
    background: var(--color-hover);
  }
  .pages {
    display: flex;
    flex: 1;
    flex-wrap: wrap;
    align-content: flex-start;
    justify-content: center;
    gap: 20px;
    margin: 0;
    padding: 16px;
    overflow: auto;
    list-style: none;
  }
  li {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
  .caption {
    color: var(--color-muted);
    font-size: 13px;
  }
</style>
