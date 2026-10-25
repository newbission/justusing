<!--
  목록 칸의 그림 (격리 frame 안). 배경을 지운 결과가 있으면 체크무늬 위에 그리고, 아직이면 줄인 원래 사진을 그린다.
-->
<script lang="ts">
  interface Props {
    /** 워커가 그린 작은 결과 그림 */
    image?: ImageBitmap;
    /** 결과가 없을 때 보일 줄인 원래 사진 */
    base?: ImageBitmap;
  }

  let { image, base }: Props = $props();
  let canvas: HTMLCanvasElement | undefined = $state();
  const shown = $derived(image ?? base);

  $effect(() => {
    // 닫힌 그림(가로 0)은 그리지 않는다
    if (!canvas || !shown || shown.width === 0) return;
    canvas.width = shown.width;
    canvas.height = shown.height;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, shown.width, shown.height);
    ctx.drawImage(shown, 0, 0);
  });
</script>

{#if shown}
  <canvas bind:this={canvas} class:result={image !== undefined}></canvas>
{/if}

<style>
  canvas {
    display: block;
    max-width: 100%;
    max-height: 100%;
  }
  /* 체크무늬: 지워진(투명한) 곳이 보이게 (미리보기와 같이 두 테마 모두 밝게) */
  .result {
    background: repeating-conic-gradient(
        color-mix(in srgb, var(--color-paper-text) 14%, var(--color-paper)) 0 25%,
        var(--color-paper) 0 50%
      )
      0 0 / 12px 12px;
  }
</style>
