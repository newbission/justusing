<!--
  쪽 하나를 크게 그리고 그 위에 겹칠 화면을 받는 틀 (이미지 놓기·자르기).
  위에 쪽 넘기기(‹ ›)와 안내 글, 아래에 쪽. 겹칠 화면(children)은 쪽과 같은 크기의 칸 안에
  % 단위로 놓으면 된다. 파일은 어디로도 전송되지 않는다.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { pick } from '../../frame/locale';
  import { FRAME_MESSAGES } from '../../frame/messages';
  import type { PDFDocumentProxy, PDFPageProxy } from './pdfjs';

  const t = pick(FRAME_MESSAGES).place;

  interface Props {
    doc: PDFDocumentProxy;
    /** 지금 보고 있는 쪽 (0부터) */
    pageIndex: number;
    /** 그린 쪽의 화면 크기(px). 겹칠 화면이 끌기 거리를 비율로 바꿀 때 쓴다 */
    view?: { width: number; height: number };
    /** 쪽 위에 보여 줄 안내 글 */
    help: string;
    /** 입력 칸(양식)을 그리지 않을지. 그 위에 직접 입력 칸을 겹칠 때 (양식 채우기) */
    hideForms?: boolean;
    children: Snippet;
  }

  let {
    doc,
    pageIndex = $bindable(),
    view = $bindable({ width: 0, height: 0 }),
    help,
    hideForms = false,
    children,
  }: Props = $props();

  /** 쪽을 그릴 최대 폭(px). 넓은 화면에서도 한눈에 보이게 */
  const MAX_WIDTH = 520;

  let boxWidth = $state(0);
  let canvas: HTMLCanvasElement;

  $effect(() => {
    const width = Math.min(boxWidth, MAX_WIDTH);
    if (width <= 0) return;
    let cancelled = false;
    let task: ReturnType<PDFPageProxy['render']> | undefined;
    doc.getPage(pageIndex + 1).then((page) => {
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: width / base.width });
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      view = { width: viewport.width, height: viewport.height };
      task = page.render({
        canvas,
        viewport,
        // pdf.js AnnotationMode: 1 주석·양식 모두 그림, 2 양식 칸은 빼고 그림
        annotationMode: hideForms ? 2 : 1,
        transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
      });
      task.promise.catch(() => {
        // 쪽을 바꿔 이전 그리기가 취소된 경우. 다음 그리기가 이어서 한다.
      });
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  });
</script>

<div class="page-sheet" bind:clientWidth={boxWidth}>
  <div class="nav">
    <button
      type="button"
      class="btn"
      disabled={pageIndex === 0}
      onclick={() => (pageIndex -= 1)}
      aria-label={t.previous}>‹</button
    >
    <span aria-live="polite">{t.page(pageIndex + 1, doc.numPages)}</span>
    <button
      type="button"
      class="btn"
      disabled={pageIndex === doc.numPages - 1}
      onclick={() => (pageIndex += 1)}
      aria-label={t.next}>›</button
    >
  </div>

  <p class="help">{help}</p>

  <div class="sheet" style:width="{view.width}px" style:height="{view.height}px">
    <canvas bind:this={canvas} style:width="{view.width}px" style:height="{view.height}px"></canvas>
    {#if view.width > 0}
      {@render children()}
    {/if}
  </div>
</div>

<style>
  .page-sheet {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .nav {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 14px;
  }
  .help {
    margin: 0;
    color: var(--color-muted);
    font-size: 13px;
    text-align: center;
  }
  .sheet {
    position: relative;
    box-shadow: var(--shadow-page);
  }
  canvas {
    display: block;
    background: var(--color-paper);
  }
</style>
