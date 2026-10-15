<!--
  쪽에서 남길 영역을 고르는 화면 (자르기).
  쪽 위에 사각형을 올리고 바깥을 어둡게 덮는다. 가운데를 끌면 옮겨지고, 네 모서리를 끌면 크기가
  바뀐다. 키보드로도 된다(화살표, Shift와 함께 크게). 영역은 화면에 보이는 쪽 기준 비율(PageRect)이다.
-->
<script lang="ts">
  import { pick } from '../../frame/locale';
  import { FRAME_MESSAGES } from '../../frame/messages';
  import type { PageRect } from './modify';
  import PageSheet from './PageSheet.svelte';
  import type { PDFDocumentProxy } from './pdfjs';

  const t = pick(FRAME_MESSAGES).crop;

  interface Props {
    doc: PDFDocumentProxy;
    pageIndex: number;
    rect: PageRect;
  }

  let { doc, pageIndex = $bindable(), rect = $bindable() }: Props = $props();

  /** 남길 영역의 최소 크기 (쪽 대비) */
  const MIN = 0.05;

  let view = $state({ width: 0, height: 0 });

  type Corner = 'nw' | 'ne' | 'sw' | 'se';
  const CORNERS: Corner[] = ['nw', 'ne', 'sw', 'se'];

  const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), Math.max(min, max));

  /** 영역 전체를 옮긴다 (크기 그대로, 쪽 안에서) */
  function moved(start: PageRect, dx: number, dy: number): PageRect {
    return {
      ...start,
      x: clamp(start.x + dx, 0, 1 - start.width),
      y: clamp(start.y + dy, 0, 1 - start.height),
    };
  }

  /** 모서리 하나를 옮긴다 (맞은편 모서리는 그대로) */
  function resized(start: PageRect, corner: Corner, dx: number, dy: number): PageRect {
    let left = start.x;
    let top = start.y;
    let right = start.x + start.width;
    let bottom = start.y + start.height;
    if (corner === 'nw' || corner === 'sw') left = clamp(left + dx, 0, right - MIN);
    else right = clamp(right + dx, left + MIN, 1);
    if (corner === 'nw' || corner === 'ne') top = clamp(top + dy, 0, bottom - MIN);
    else bottom = clamp(bottom + dy, top + MIN, 1);
    return { x: left, y: top, width: right - left, height: bottom - top };
  }

  let drag: { target: 'area' | Corner; x: number; y: number; start: PageRect } | undefined;

  function startDrag(event: PointerEvent, target: 'area' | Corner) {
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    drag = { target, x: event.clientX, y: event.clientY, start: { ...rect } };
  }

  function moveDrag(event: PointerEvent) {
    if (!drag || view.width === 0) return;
    const dx = (event.clientX - drag.x) / view.width;
    const dy = (event.clientY - drag.y) / view.height;
    rect =
      drag.target === 'area' ? moved(drag.start, dx, dy) : resized(drag.start, drag.target, dx, dy);
  }

  function endDrag() {
    drag = undefined;
  }

  function onKey(event: KeyboardEvent, target: 'area' | Corner) {
    const step = event.shiftKey ? 0.05 : 0.01;
    const keys: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = keys[event.key];
    if (!move) return;
    event.preventDefault();
    rect = target === 'area' ? moved(rect, ...move) : resized(rect, target, ...move);
  }

  /** 모서리 손잡이의 자리 (쪽 대비 %) */
  function cornerAt(corner: Corner) {
    return {
      left: (corner === 'nw' || corner === 'sw' ? rect.x : rect.x + rect.width) * 100,
      top: (corner === 'nw' || corner === 'ne' ? rect.y : rect.y + rect.height) * 100,
    };
  }
</script>

<PageSheet {doc} bind:pageIndex bind:view help={t.help}>
  <div class="layer">
    <button
      type="button"
      class="area"
      style:left="{rect.x * 100}%"
      style:top="{rect.y * 100}%"
      style:width="{rect.width * 100}%"
      style:height="{rect.height * 100}%"
      aria-label={t.area}
      onpointerdown={(event) => startDrag(event, 'area')}
      onpointermove={moveDrag}
      onpointerup={endDrag}
      onpointercancel={endDrag}
      onkeydown={(event) => onKey(event, 'area')}
    ></button>
  </div>
  {#each CORNERS as corner (corner)}
    {@const at = cornerAt(corner)}
    <button
      type="button"
      class="handle {corner}"
      style:left="{at.left}%"
      style:top="{at.top}%"
      aria-label={t.corners[corner]}
      onpointerdown={(event) => startDrag(event, corner)}
      onpointermove={moveDrag}
      onpointerup={endDrag}
      onpointercancel={endDrag}
      onkeydown={(event) => onKey(event, corner)}
    ></button>
  {/each}
</PageSheet>

<style>
  /* 남길 영역 바깥을 덮는 막이 쪽 밖으로 번지지 않게 자른다 */
  .layer {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }
  .area {
    position: absolute;
    padding: 0;
    border: 2px solid var(--color-accent);
    background: transparent;
    box-shadow: 0 0 0 100vmax var(--color-scrim);
    cursor: move;
    touch-action: none;
  }
  .area:focus-visible {
    outline: 2px dashed var(--color-bg);
    outline-offset: -6px;
  }
  .handle {
    position: absolute;
    width: 20px;
    height: 20px;
    margin: -10px 0 0 -10px;
    padding: 0;
    border: 2px solid var(--color-bg);
    border-radius: 50%;
    background: var(--color-accent);
    touch-action: none;
  }
  .handle.nw,
  .handle.se {
    cursor: nwse-resize;
  }
  .handle.ne,
  .handle.sw {
    cursor: nesw-resize;
  }
  .handle:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
</style>
