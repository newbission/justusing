<!--
  쪽 위에 이미지를 놓는 화면 (이미지 넣기·서명 넣기).
  쪽을 크게 그리고 그 위에 이미지를 올린다. 이미지를 끌면 옮겨지고, 오른쪽 아래 손잡이를 끌면
  비율을 지킨 채 크기가 바뀐다. 키보드로도 된다(화살표: 옮기기, +/-: 크기).
  자리는 화면에 보이는 쪽 기준 비율(StampPlace)로 내보낸다. 파일은 어디로도 전송되지 않는다.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { pick } from '../../frame/locale';
  import { FRAME_MESSAGES } from '../../frame/messages';
  import type { StampPlace } from './modify';
  import PageSheet from './PageSheet.svelte';
  import type { PDFDocumentProxy } from './pdfjs';

  const t = pick(FRAME_MESSAGES).place;

  interface Props {
    doc: PDFDocumentProxy;
    /** 놓을 이미지 (blob 주소와 화소 크기) */
    image: { url: string; width: number; height: number };
    /** 지금 보고 있는 쪽 (0부터) */
    pageIndex: number;
    place: StampPlace;
  }

  let { doc, image, pageIndex = $bindable(), place = $bindable() }: Props = $props();

  /** 이미지 최소 폭 (쪽 폭 대비) */
  const MIN_WIDTH = 0.03;

  /** 그린 쪽의 화면 크기(px) */
  let view = $state({ width: 0, height: 0 });

  /** 이미지 높이 (쪽 높이 대비 비율). 이미지 비율과 이 쪽의 비율로 정해진다 */
  const height = $derived(
    view.height === 0 ? 0 : (place.width * view.width * image.height) / image.width / view.height,
  );

  const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), Math.max(min, max));

  /** 자리를 쪽 안으로 맞춘다 */
  function fit(next: StampPlace): StampPlace {
    if (view.height === 0) return next;
    // 이미지 높이 / 너비 (쪽 비율 기준). 세로로 긴 이미지는 높이가 먼저 쪽에 닿는다
    const tall = (view.width * image.height) / image.width / view.height;
    // 아주 긴 이미지는 최소 폭보다 쪽 안에 들어가는 것을 먼저 지킨다
    const max = Math.min(1, 1 / tall);
    const width = Math.min(clamp(next.width, MIN_WIDTH, max), max);
    return { width, x: clamp(next.x, 0, 1 - width), y: clamp(next.y, 0, 1 - width * tall) };
  }

  // 끌기: 시작할 때의 포인터 위치와 자리
  let drag: { mode: 'move' | 'resize'; x: number; y: number; start: StampPlace } | undefined;

  function startDrag(event: PointerEvent, mode: 'move' | 'resize') {
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    drag = { mode, x: event.clientX, y: event.clientY, start: { ...place } };
  }

  function moveDrag(event: PointerEvent) {
    if (!drag || view.width === 0) return;
    const dx = (event.clientX - drag.x) / view.width;
    const dy = (event.clientY - drag.y) / view.height;
    place =
      drag.mode === 'move'
        ? fit({ ...drag.start, x: drag.start.x + dx, y: drag.start.y + dy })
        : fit({ ...drag.start, width: drag.start.width + dx });
  }

  function endDrag() {
    drag = undefined;
  }

  function onKey(event: KeyboardEvent) {
    const step = event.shiftKey ? 0.05 : 0.01;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (move) {
      place = fit({ ...place, x: place.x + move[0], y: place.y + move[1] });
    } else if (event.key === '+' || event.key === '=') {
      place = fit({ ...place, width: place.width + step });
    } else if (event.key === '-') {
      place = fit({ ...place, width: place.width - step });
    } else {
      return;
    }
    event.preventDefault();
  }

  // 쪽을 바꾸면(비율이 다를 수 있다) 이미지가 쪽 밖으로 나가지 않게 다시 맞춘다
  $effect(() => {
    if (view.height > 0) place = untrack(() => fit(place));
  });
</script>

<PageSheet {doc} bind:pageIndex bind:view help={t.help}>
  <button
    type="button"
    class="stamp"
    style:left="{place.x * 100}%"
    style:top="{place.y * 100}%"
    style:width="{place.width * 100}%"
    style:height="{height * 100}%"
    aria-label={t.stamp}
    onpointerdown={(event) => startDrag(event, 'move')}
    onpointermove={moveDrag}
    onpointerup={endDrag}
    onpointercancel={endDrag}
    onkeydown={onKey}
  >
    <img src={image.url} alt="" draggable="false" />
  </button>
  <button
    type="button"
    class="handle"
    style:left="{(place.x + place.width) * 100}%"
    style:top="{(place.y + height) * 100}%"
    aria-label={t.resize}
    onpointerdown={(event) => startDrag(event, 'resize')}
    onpointermove={moveDrag}
    onpointerup={endDrag}
    onpointercancel={endDrag}
    onkeydown={onKey}
  ></button>
</PageSheet>

<style>
  .stamp {
    position: absolute;
    padding: 0;
    border: 1px dashed var(--color-accent);
    background: transparent;
    cursor: move;
    touch-action: none;
  }
  .stamp:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
  .stamp img {
    display: block;
    width: 100%;
    height: 100%;
    pointer-events: none;
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
    cursor: nwse-resize;
    touch-action: none;
  }
  .handle:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
</style>
