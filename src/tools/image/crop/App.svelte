<!--
  이미지 자르기·회전 도구 화면 (격리 frame 안에서 실행).
  사진 한 장을 90°씩 돌리고, 뒤집고, 기울기를 바로잡고, 남길 영역을 골라 다시 저장한다.
  원본은 워커가 들고 있고 화면에는 줄인 미리보기만 그린다. 사진은 어디로도 전송되지 않는다.
-->
<script lang="ts">
  import '../../../frame/controls.css';
  import { onMount } from 'svelte';
  import { pick } from '../../../frame/locale';
  import { MESSAGES, RATIOS, type Ratio } from './messages';
  import ActionBar from '../../../frame/ActionBar.svelte';
  import FileDrop from '../../../frame/FileDrop.svelte';
  import { downloadFile } from '../../../frame/download';
  import { onFrameFiles } from '../../../frame/drop';
  import { baseName, formatSize } from '../../../frame/format';
  import { requestShowTool } from '../../../frame/parent';
  import { canUse } from '../../../lib/entitlement';
  import { EXTENSIONS } from '../../../lib/image/batch.svelte';
  import { CropError, exportImage, openImage, type CropFailure } from '../../../lib/image/crop';
  import {
    MAX_ANGLE,
    NO_TURN,
    applyTurn,
    boardSize,
    clampRect,
    fitRatio,
    flipRect,
    fullRect,
    resizeRect,
    turnRect,
    type Edge,
    type Rect,
    type Turn,
  } from '../../../lib/image/crop-geometry';
  import type { OutputType } from '../../../lib/image/process';

  const t = pick(MESSAGES);

  /** 미리보기 사진의 긴 변 (원본은 결과 파일에만 쓴다) */
  const PREVIEW_SIDE = 1600;
  /** 미리보기 칸의 가장 큰 높이 (CSS 픽셀) */
  const VIEW_MAX_HEIGHT = 420;
  /** JPG·WebP 화질. 자르기만 하는 도구라 눈에 띄는 손실이 없게 높게 둔다 */
  const QUALITY = 0.92;
  const FORMATS: OutputType[] = ['image/jpeg', 'image/png', 'image/webp'];
  const EDGES: Edge[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

  interface Photo {
    name: string;
    /** 바로 세운 원본의 가로·세로 */
    width: number;
    height: number;
    preview: ImageBitmap;
  }

  type Phase = 'idle' | 'opening' | 'error' | 'ready';
  let phase = $state<Phase>('idle');
  let photo = $state.raw<Photo>();
  /** 새 사진을 열거나 닫을 때마다 늘어난다. 늦게 끝난 예전 작업이 지금 사진을 덮어쓰지 않게 한다 */
  let generation = 0;

  let turn = $state.raw<Turn>(NO_TURN);
  let rect = $state.raw<Rect>({ x: 0, y: 0, width: 1, height: 1 });
  let ratio = $state<Ratio>('free');
  let format = $state<OutputType>('image/jpeg');

  type Save =
    | { kind: 'idle' }
    | { kind: 'saving' }
    | { kind: 'saved'; size: number; width: number; height: number }
    | { kind: 'failed'; reason: CropFailure };
  let save = $state.raw<Save>({ kind: 'idle' });

  const board = $derived(photo ? boardSize(photo, turn) : { width: 1, height: 1 });
  /** 고른 비율 (가로/세로). 자유면 없다 */
  const ratioValue = $derived.by(() => {
    if (ratio === 'free') return undefined;
    if (ratio === 'original') return board.width / board.height;
    const [w, h] = ratio.split(':').map(Number);
    return w! / h!;
  });

  onMount(() => {
    const off = onFrameFiles(([file]) => {
      if (file) open(file);
    });
    return () => {
      off();
      photo?.preview.close();
    };
  });

  /** 원래 형식으로 저장한다. JPG·PNG·WebP가 아니면(HEIC·GIF 등) JPG */
  function formatOf(file: File): OutputType {
    if (file.type === 'image/png' || /\.png$/i.test(file.name)) return 'image/png';
    if (file.type === 'image/webp' || /\.webp$/i.test(file.name)) return 'image/webp';
    return 'image/jpeg';
  }

  async function open(file: File) {
    const ticket = ++generation;
    close(false);
    phase = 'opening';
    try {
      const opened = await openImage(file, PREVIEW_SIDE);
      if (ticket !== generation) {
        opened.preview.close();
        return;
      }
      photo = { name: file.name, ...opened };
      turn = NO_TURN;
      ratio = 'free';
      rect = fullRect(opened);
      format = formatOf(file);
      phase = 'ready';
      requestShowTool();
    } catch {
      if (ticket === generation) phase = 'error';
    }
  }

  function close(reset = true) {
    if (reset) generation++;
    photo?.preview.close();
    photo = undefined;
    save = { kind: 'idle' };
    phase = 'idle';
  }

  /** 결과가 바뀌었다: 지난번에 받은 결과 안내를 지운다 */
  function edited() {
    if (save.kind !== 'saving') save = { kind: 'idle' };
  }

  function setRect(next: Rect) {
    rect = clampRect(next, board, ratioValue);
    edited();
  }

  /** 90° 돌리기. 자를 영역과 고른 비율도 같이 돌린다 */
  function rotate(direction: 1 | -1) {
    const before = board;
    // 뒤집기는 90° 회전 바깥(판 기준)에 걸리므로, 보이는 그림을 돌리려면 두 축을 서로 바꾼다
    turn = {
      ...turn,
      quarter: (turn.quarter + direction + 4) % 4,
      flipX: turn.flipY,
      flipY: turn.flipX,
    };
    // 비율을 먼저 돌려야 돌린 영역을 새 비율로 맞춘다
    if (ratio !== 'free' && ratio !== 'original') {
      const [w, h] = ratio.split(':');
      const swapped = `${h}:${w}` as Ratio;
      if (RATIOS.includes(swapped)) ratio = swapped;
    }
    rect = clampRect(turnRect(rect, before, direction), board, ratioValue);
    edited();
  }

  /** 뒤집기. 바로잡은 기울기도 거울처럼 바뀌므로 반대로 돌린다 */
  function flip(axis: 'x' | 'y') {
    turn =
      axis === 'x'
        ? { ...turn, flipX: !turn.flipX, angle: -turn.angle }
        : { ...turn, flipY: !turn.flipY, angle: -turn.angle };
    rect = flipRect(rect, board, axis);
    edited();
  }

  function setAngle(value: number) {
    if (!Number.isFinite(value)) return;
    const angle = Math.round(Math.min(MAX_ANGLE, Math.max(-MAX_ANGLE, value)) * 10) / 10;
    turn = { ...turn, angle: angle === 0 ? 0 : angle };
    edited();
  }

  function chooseRatio(next: Ratio) {
    ratio = next;
    if (ratioValue !== undefined) setRect(fitRatio(rect, board, ratioValue));
  }

  /** 숫자 칸에서 하나를 바꿨다. 비율을 지킬 때는 폭·높이를 같이 바꾼다 */
  function setField(field: keyof Rect, value: number) {
    if (!Number.isFinite(value)) return;
    const next = { ...rect, [field]: value };
    // 판을 넘거나 너무 작으면 setRect(clampRect)가 비율째 맞춘다
    if (ratioValue !== undefined && field === 'height') next.width = next.height * ratioValue;
    setRect(next);
  }

  function reset() {
    if (!photo) return;
    turn = NO_TURN;
    ratio = 'free';
    rect = fullRect(photo);
    edited();
  }

  // 미리보기: 판 전체를 칸에 맞춰 그린다 (자를 영역은 위에 겹친 사각형)
  let stageWidth = $state(0);
  const view = $derived.by(() => {
    if (stageWidth === 0) return { width: 0, height: 0 };
    const scale = Math.min(stageWidth / board.width, VIEW_MAX_HEIGHT / board.height);
    return { width: board.width * scale, height: board.height * scale };
  });
  let canvas: HTMLCanvasElement | undefined = $state();
  $effect(() => {
    if (!canvas || !photo || view.width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(view.width * dpr));
    canvas.height = Math.max(1, Math.round(view.height * dpr));
    const ctx = canvas.getContext('2d')!;
    const { preview } = photo;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingQuality = 'high';
    applyTurn(ctx, preview, turn, canvas.width / boardSize(preview, turn).width);
    ctx.drawImage(preview, -preview.width / 2, -preview.height / 2);
  });

  // 끌기: 화면 픽셀만큼 움직인 것을 판 화소로 바꾼다
  let drag: { target: 'area' | Edge; x: number; y: number; start: Rect } | undefined;

  function startDrag(event: PointerEvent, target: 'area' | Edge) {
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    drag = { target, x: event.clientX, y: event.clientY, start: rect };
  }

  function moveDrag(event: PointerEvent) {
    if (!drag || view.width === 0) return;
    const k = board.width / view.width;
    const dx = (event.clientX - drag.x) * k;
    const dy = (event.clientY - drag.y) * k;
    if (drag.target === 'area')
      setRect({ ...drag.start, x: drag.start.x + dx, y: drag.start.y + dy });
    else setRect(resizeRect(drag.start, drag.target, dx, dy, board, ratioValue));
  }

  function endDrag() {
    drag = undefined;
  }

  function onKey(event: KeyboardEvent, target: 'area' | Edge) {
    const step =
      Math.max(1, Math.round(Math.max(board.width, board.height) / 100)) *
      (event.shiftKey ? 10 : 1);
    const keys: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = keys[event.key];
    if (!move) return;
    event.preventDefault();
    if (target === 'area') setRect({ ...rect, x: rect.x + move[0], y: rect.y + move[1] });
    else setRect(resizeRect(rect, target, ...move, board, ratioValue));
  }

  /** 손잡이 자리 (판 대비 %) */
  function edgeAt(edge: Edge) {
    const x = edge.includes('w')
      ? rect.x
      : edge.includes('e')
        ? rect.x + rect.width
        : rect.x + rect.width / 2;
    const y = edge.includes('n')
      ? rect.y
      : edge.includes('s')
        ? rect.y + rect.height
        : rect.y + rect.height / 2;
    return { left: (x / board.width) * 100, top: (y / board.height) * 100 };
  }

  async function download() {
    if (!photo || save.kind === 'saving') return;
    const entitlement = await canUse('image/crop');
    if (!entitlement.allowed) return;
    const ticket = generation;
    const wanted = { turn, rect, format, name: photo.name };
    save = { kind: 'saving' };
    try {
      const bytes = await exportImage(wanted.turn, wanted.rect, wanted.format, QUALITY);
      if (ticket !== generation) return;
      downloadFile(
        bytes,
        `${baseName(wanted.name)}_${t.suffix}.${EXTENSIONS[wanted.format]}`,
        wanted.format,
      );
      save = { kind: 'saved', size: bytes.length, ...wanted.rect };
    } catch (error) {
      if (ticket !== generation) return;
      save = { kind: 'failed', reason: error instanceof CropError ? error.reason : 'tooLarge' };
    }
  }
</script>

<div class="tool">
  {#if phase === 'ready' && photo}
    <div class="filebar">
      <span class="name" title={photo.name}>{photo.name}</span>
      <span class="meta">{photo.width}×{photo.height}</span>
      <button type="button" class="btn" onclick={() => close()}>{t.otherFile}</button>
    </div>

    <ActionBar label={t.bar}>
      {#snippet text()}
        {#if save.kind === 'failed'}
          <strong>{t.failed[save.reason]}</strong>
        {:else if save.kind === 'saved'}
          {t.saved(save.width, save.height, formatSize(save.size))}
        {:else if save.kind === 'saving'}
          {t.saving}
        {:else}
          {t.ready(rect.width, rect.height, t.formats[format])}
        {/if}
      {/snippet}
      <button type="button" class="btn primary" disabled={save.kind === 'saving'} onclick={download}
        >{t.download}</button
      >
    </ActionBar>

    <div class="tool-body">
      <div class="layout">
        <div class="stage" bind:clientWidth={stageWidth}>
          <div class="view" style:width="{view.width}px" style:height="{view.height}px">
            <canvas bind:this={canvas}></canvas>
            <div class="layer">
              <button
                type="button"
                class="area"
                style:left="{(rect.x / board.width) * 100}%"
                style:top="{(rect.y / board.height) * 100}%"
                style:width="{(rect.width / board.width) * 100}%"
                style:height="{(rect.height / board.height) * 100}%"
                aria-label={t.area}
                aria-describedby="view-help"
                onpointerdown={(event) => startDrag(event, 'area')}
                onpointermove={moveDrag}
                onpointerup={endDrag}
                onpointercancel={endDrag}
                onkeydown={(event) => onKey(event, 'area')}
              ></button>
            </div>
            {#each EDGES as edge (edge)}
              {#if ratioValue === undefined || edge.length === 2}
                {@const at = edgeAt(edge)}
                <button
                  type="button"
                  class="handle {edge}"
                  style:left="{at.left}%"
                  style:top="{at.top}%"
                  aria-label={t.edges[edge]}
                  onpointerdown={(event) => startDrag(event, edge)}
                  onpointermove={moveDrag}
                  onpointerup={endDrag}
                  onpointercancel={endDrag}
                  onkeydown={(event) => onKey(event, edge)}
                ></button>
              {/if}
            {/each}
          </div>
          <p class="help" id="view-help">{t.previewHelp}</p>
        </div>

        <div class="panel">
          <section aria-labelledby="turn-title">
            <h2 id="turn-title">{t.turnTitle}</h2>
            <div class="row">
              <button type="button" class="btn" onclick={() => rotate(-1)}>{t.rotateLeft}</button>
              <button type="button" class="btn" onclick={() => rotate(1)}>{t.rotateRight}</button>
              <button type="button" class="btn" aria-pressed={turn.flipX} onclick={() => flip('x')}
                >{t.flipX}</button
              >
              <button type="button" class="btn" aria-pressed={turn.flipY} onclick={() => flip('y')}
                >{t.flipY}</button
              >
            </div>
            <div class="row angle">
              <label for="angle">{t.angle}</label>
              <input
                id="angle"
                type="range"
                min={-MAX_ANGLE}
                max={MAX_ANGLE}
                step="0.1"
                value={turn.angle}
                aria-valuetext={t.angleValue(turn.angle.toFixed(1))}
                oninput={(event) => setAngle(event.currentTarget.valueAsNumber)}
              />
              <span class="value">{t.angleValue(turn.angle.toFixed(1))}</span>
              <button
                type="button"
                class="btn"
                disabled={turn.angle === 0}
                onclick={() => setAngle(0)}>{t.angleZero}</button
              >
            </div>
            <p class="help">{t.angleHelp}</p>
          </section>

          <section aria-labelledby="crop-title">
            <h2 id="crop-title">{t.cropTitle}</h2>
            <div class="ratios" role="radiogroup" aria-label={t.ratioGroup}>
              {#each RATIOS as option (option)}
                <label class:checked={ratio === option}>
                  <input
                    type="radio"
                    name="ratio"
                    value={option}
                    checked={ratio === option}
                    onchange={() => chooseRatio(option)}
                  />
                  {option === 'free' || option === 'original' ? t.ratios[option] : option}
                </label>
              {/each}
            </div>
            <p class="help">{t.ratioHelp}</p>
            <div class="fields">
              {#each ['x', 'y', 'width', 'height'] as const as field (field)}
                <label class="field">
                  {t.fields[field]}
                  <input
                    type="number"
                    min={field === 'width' || field === 'height' ? 1 : 0}
                    max={field === 'x' || field === 'width' ? board.width : board.height}
                    inputmode="numeric"
                    value={rect[field]}
                    onchange={(event) => {
                      setField(field, event.currentTarget.valueAsNumber);
                      event.currentTarget.value = String(rect[field]);
                    }}
                  />
                </label>
              {/each}
            </div>
            <button
              type="button"
              class="btn"
              onclick={() => {
                ratio = 'free';
                setRect(fullRect(board));
              }}>{t.whole}</button
            >
          </section>

          <section aria-labelledby="format-title">
            <h2 id="format-title">{t.formatTitle}</h2>
            <div class="choice" role="radiogroup" aria-label={t.formatGroup}>
              {#each FORMATS as option (option)}
                <label class:checked={format === option}>
                  <input
                    type="radio"
                    name="format"
                    value={option}
                    bind:group={format}
                    onchange={edited}
                  />
                  {t.formats[option]}
                </label>
              {/each}
            </div>
            <p class="help">{t.formatHelp[format]} {t.exifNote}</p>
          </section>

          <button type="button" class="btn" onclick={reset}>{t.reset}</button>
        </div>
      </div>
    </div>
  {:else if phase === 'opening'}
    <p class="status" role="status">{t.opening}</p>
  {:else}
    {#if phase === 'error'}
      <p class="banner" role="alert">{t.cannotOpen}</p>
    {/if}
    <div class="drop">
      <FileDrop
        accept="image/*,.heic,.heif,.avif"
        label={t.choose}
        hint={t.hint}
        onfiles={([file]) => file && open(file)}
      />
    </div>
  {/if}
</div>

<style>
  .tool {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--color-surface);
  }
  .filebar {
    display: flex;
    flex: none;
    align-items: center;
    gap: 12px;
    height: 48px;
    padding: 0 16px;
    border-bottom: 1px solid var(--color-line);
    font-size: 14px;
  }
  .filebar .name {
    overflow: hidden;
    font-weight: 600;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .filebar .meta {
    flex: 1;
    color: var(--color-muted);
    white-space: nowrap;
  }
  .status,
  .banner {
    margin: 0;
    padding: 16px;
    font-size: 14px;
  }
  .banner {
    border-bottom: 1px solid var(--color-line);
    font-weight: 600;
  }
  .drop {
    padding: 16px;
  }
  .layout {
    display: flex;
    flex-wrap: wrap;
    gap: 24px;
  }
  .stage {
    flex: 3 1 320px;
    min-width: 0;
  }
  .panel {
    flex: 2 1 280px;
    min-width: 0;
  }
  .view {
    position: relative;
    margin: 0 auto;
    /* 체크무늬: 투명한 곳이 보이게 */
    background: repeating-conic-gradient(var(--color-hover) 0 25%, transparent 0 50%) 0 0 / 16px
      16px;
    user-select: none;
  }
  .view canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
  /* 남길 영역 바깥을 덮는 막이 사진 밖으로 번지지 않게 자른다 */
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
  /* 3등분 선: 수평·구도를 맞출 때 기준 */
  .area::before,
  .area::after {
    content: '';
    position: absolute;
    pointer-events: none;
    border: 0 solid color-mix(in srgb, var(--color-paper) 55%, transparent);
  }
  .area::before {
    top: 0;
    bottom: 0;
    left: 33.333%;
    right: 33.333%;
    border-left-width: 1px;
    border-right-width: 1px;
  }
  .area::after {
    left: 0;
    right: 0;
    top: 33.333%;
    bottom: 33.333%;
    border-top-width: 1px;
    border-bottom-width: 1px;
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
  .handle.n,
  .handle.s {
    cursor: ns-resize;
  }
  .handle.e,
  .handle.w {
    cursor: ew-resize;
  }
  .handle:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
  .stage .help {
    margin: 16px 0 0;
  }
  section {
    margin-bottom: 16px;
    padding: 16px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius);
  }
  h2 {
    margin: 0 0 12px;
    font-size: 15px;
  }
  section .help {
    margin: 8px 0 0;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .row + .row {
    margin-top: 12px;
  }
  .angle label {
    font-size: 14px;
    font-weight: 600;
  }
  .angle input {
    flex: 1;
    min-width: 120px;
    accent-color: var(--color-accent);
  }
  .angle .value {
    min-width: 48px;
    font-size: 14px;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
  .ratios {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .ratios label {
    padding: 6px 10px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius);
    font-size: 14px;
    cursor: pointer;
  }
  .ratios label:hover {
    background: var(--color-hover);
  }
  .ratios label.checked {
    border-color: var(--color-text);
    background: var(--color-text);
    color: var(--color-bg);
    font-weight: 600;
  }
  .ratios label:has(input:focus-visible) {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
  .ratios input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 12px;
    margin-top: 16px;
  }
  .fields .field {
    margin-bottom: 12px;
  }
</style>
