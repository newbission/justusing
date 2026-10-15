<!--
  서명 그리기 칸 (서명 넣기). 마우스·손가락·펜으로 그리고, 다 그리면 그린 부분만 잘라
  배경이 투명한 PNG로 넘긴다. 그림은 이 기기 안에만 있다.
-->
<script lang="ts">
  import { pick } from '../../frame/locale';
  import { FRAME_MESSAGES } from '../../frame/messages';
  import type { EmbeddableImage } from '../image/prepare';

  const t = pick(FRAME_MESSAGES).signature;

  interface Props {
    /** 다 그렸을 때. PNG 바이트와 화면에 보여 줄 blob 주소 */
    ondone: (signature: { url: string; embed: EmbeddableImage }) => void;
  }

  let { ondone }: Props = $props();

  /** 서명 잉크 색. 화면 테마와 상관없이 PDF에 들어갈 색이다 */
  const INK = '#1a1a2e';
  /** 선 굵기 (CSS px) */
  const LINE = 2.5;

  let canvas: HTMLCanvasElement;
  let boxWidth = $state(0);
  const HEIGHT = 200;
  let empty = $state(true);
  /** 그린 범위 (canvas 화소). 다 그리면 이 범위만 잘라 낸다 */
  let bounds = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  let last: { x: number; y: number } | undefined;

  const ratio = () => window.devicePixelRatio || 1;

  $effect(() => {
    // 칸 폭이 바뀌면 다시 그려야 해서 지운다 (그리기 전에만 폭이 바뀐다)
    const width = Math.min(boxWidth, 560);
    if (width <= 0) return;
    canvas.width = Math.floor(width * ratio());
    canvas.height = Math.floor(HEIGHT * ratio());
    clear();
  });

  function point(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function grow(x: number, y: number) {
    const pad = LINE * ratio();
    bounds = {
      left: Math.min(bounds.left, x - pad),
      top: Math.min(bounds.top, y - pad),
      right: Math.max(bounds.right, x + pad),
      bottom: Math.max(bounds.bottom, y + pad),
    };
  }

  function down(event: PointerEvent) {
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    last = point(event);
    const context = canvas.getContext('2d')!;
    // 점 하나만 찍어도 보이게
    context.beginPath();
    context.arc(last.x, last.y, (LINE * ratio()) / 2, 0, Math.PI * 2);
    context.fill();
    grow(last.x, last.y);
    empty = false;
  }

  function move(event: PointerEvent) {
    if (!last) return;
    const next = point(event);
    const context = canvas.getContext('2d')!;
    context.beginPath();
    context.moveTo(last.x, last.y);
    context.lineTo(next.x, next.y);
    context.stroke();
    grow(next.x, next.y);
    last = next;
  }

  function up() {
    last = undefined;
  }

  function clear() {
    const context = canvas.getContext('2d')!;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = INK;
    context.fillStyle = INK;
    context.lineWidth = LINE * ratio();
    context.lineCap = 'round';
    context.lineJoin = 'round';
    bounds = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
    empty = true;
  }

  async function finish() {
    if (empty) return;
    const left = Math.max(0, Math.floor(bounds.left));
    const top = Math.max(0, Math.floor(bounds.top));
    const width = Math.min(canvas.width, Math.ceil(bounds.right)) - left;
    const height = Math.min(canvas.height, Math.ceil(bounds.bottom)) - top;
    const cut = new OffscreenCanvas(width, height);
    cut.getContext('2d')!.drawImage(canvas, left, top, width, height, 0, 0, width, height);
    const blob = await cut.convertToBlob({ type: 'image/png' });
    ondone({
      url: URL.createObjectURL(blob),
      embed: { kind: 'png', bytes: new Uint8Array(await blob.arrayBuffer()), width, height },
    });
  }
</script>

<div class="pad" bind:clientWidth={boxWidth}>
  <canvas
    bind:this={canvas}
    class:empty
    style:height="{HEIGHT}px"
    aria-label={t.pad}
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={up}
  ></canvas>
  {#if empty}<p class="placeholder" aria-hidden="true">{t.placeholder}</p>{/if}
  <div class="actions">
    <button type="button" class="btn" disabled={empty} onclick={clear}>{t.clear}</button>
    <button type="button" class="btn primary" disabled={empty} onclick={finish}>{t.done}</button>
  </div>
</div>

<style>
  .pad {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    max-width: 560px;
    margin: 0 auto;
  }
  canvas {
    width: 100%;
    border: 1px dashed var(--color-muted);
    border-radius: var(--radius);
    /* 서명 칸은 종이처럼 늘 흰 바탕 (잉크 색이 어두워서) */
    background: #fff;
    cursor: crosshair;
    touch-action: none;
  }
  .placeholder {
    position: absolute;
    top: 84px;
    right: 0;
    left: 0;
    margin: 0;
    color: var(--color-muted);
    text-align: center;
    pointer-events: none;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
</style>
