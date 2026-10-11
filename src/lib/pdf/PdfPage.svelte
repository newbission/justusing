<!--
  PDF 한 페이지 (보기·미리보기 공통). 자리(크기)는 바로 잡고, 화면 근처에 왔을 때만 그린다.
  페이지가 수백 장이어도 보이는 페이지만 그려서 메모리와 시간을 아낀다.
-->
<script lang="ts">
  import type { PDFPageProxy } from './pdfjs';

  interface Props {
    page: PDFPageProxy;
    /** 1 = 100% */
    scale: number;
  }

  let { page, scale }: Props = $props();

  let canvas: HTMLCanvasElement;
  let box: HTMLDivElement;
  let nearScreen = $state(false);

  const viewport = $derived(page.getViewport({ scale }));

  // 화면 위아래 한 화면 거리 안에 들어오면 그리기 시작한다
  $effect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) nearScreen = entry.isIntersecting;
      },
      { rootMargin: '100% 0px' },
    );
    observer.observe(box);
    return () => observer.disconnect();
  });

  $effect(() => {
    if (!nearScreen) return;
    // 고해상도 화면에서 흐리지 않게 실제 픽셀 수만큼 그린다
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * ratio);
    canvas.height = Math.floor(viewport.height * ratio);
    const task = page.render({
      canvas,
      viewport,
      transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
    });
    task.promise.catch(() => {
      // 확대 배율이 바뀌어 이전 그리기가 취소된 경우 등. 다음 그리기가 이어서 한다.
    });
    return () => task.cancel();
  });
</script>

<div
  class="page"
  bind:this={box}
  data-page={page.pageNumber}
  role="img"
  aria-label="{page.pageNumber}페이지"
  style:width="{viewport.width}px"
  style:height="{viewport.height}px"
>
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .page {
    flex: none;
    background: #fff;
    box-shadow: 0 1px 4px rgb(0 0 0 / 0.15);
  }
  canvas {
    width: 100%;
    height: 100%;
  }
</style>
