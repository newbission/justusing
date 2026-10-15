<!--
  PDF 페이지 썸네일. 정사각형 칸 안에 페이지를 비율 그대로 맞춰 그린다.
  화면 근처에 왔을 때만 그려서 페이지가 많아도 가볍다 (pdf/view의 PdfPage와 같은 방식).
-->
<script lang="ts">
  import type { PDFPageProxy } from './pdfjs';

  interface Props {
    page: PDFPageProxy;
    /** 칸 한 변 길이(px) */
    size: number;
    /** 원래 방향에 더해 보여줄 시계 방향 회전 (90의 배수) */
    rotate?: number;
  }

  let { page, size, rotate = 0 }: Props = $props();

  let canvas: HTMLCanvasElement;
  let box: HTMLDivElement;
  let nearScreen = $state(false);

  const viewport = $derived.by(() => {
    const rotation = (page.rotate + rotate) % 360;
    const base = page.getViewport({ scale: 1, rotation });
    return page.getViewport({ scale: size / Math.max(base.width, base.height), rotation });
  });

  $effect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) nearScreen = entry.isIntersecting;
      },
      { rootMargin: '50% 0px' },
    );
    observer.observe(box);
    return () => observer.disconnect();
  });

  $effect(() => {
    if (!nearScreen) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * ratio);
    canvas.height = Math.floor(viewport.height * ratio);
    const task = page.render({
      canvas,
      viewport,
      transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
    });
    task.promise.catch(() => {
      // 회전이 바뀌어 이전 그리기가 취소된 경우 등. 다음 그리기가 이어서 한다.
    });
    return () => task.cancel();
  });
</script>

<div class="thumb" bind:this={box} style:width="{size}px" style:height="{size}px">
  <canvas
    bind:this={canvas}
    style:width="{viewport.width}px"
    style:height="{viewport.height}px"
    aria-hidden="true"
  ></canvas>
</div>

<style>
  .thumb {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
  }
  canvas {
    background: var(--color-paper);
    box-shadow: var(--shadow-page);
  }
</style>
