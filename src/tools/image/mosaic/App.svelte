<!--
  이미지 모자이크 도구 화면 (격리 frame 안에서 실행).
  사진 한 장 위에 가릴 곳(사각형·타원)을 여러 개 그리고, 곳마다 모자이크·흐림·검게 칠하기를 골라 다시 저장한다.
  원본은 워커가 들고 있고 화면에는 줄인 미리보기에 같은 계산을 걸어 보여 준다. 사진은 어디로도 전송되지 않는다.
-->
<script lang="ts">
  import '../../../frame/controls.css';
  import { onMount, tick } from 'svelte';
  import { pick } from '../../../frame/locale';
  import { MESSAGES } from './messages';
  import ActionBar from '../../../frame/ActionBar.svelte';
  import FileDrop from '../../../frame/FileDrop.svelte';
  import { downloadFile } from '../../../frame/download';
  import { onFrameFiles } from '../../../frame/drop';
  import { baseName, formatSize } from '../../../frame/format';
  import { requestShowTool } from '../../../frame/parent';
  import { canUse } from '../../../lib/entitlement';
  import { EXTENSIONS } from '../../../lib/image/batch.svelte';
  import { clampRect, resizeRect, type Edge, type Rect } from '../../../lib/image/crop-geometry';
  import {
    MosaicError,
    exportImage,
    openImage,
    type MosaicFailure,
  } from '../../../lib/image/mosaic';
  import {
    MAX_STRENGTH,
    MIN_STRENGTH,
    amountOf,
    boundsOf,
    paint,
    type Effect,
    type Region,
    type Shape,
  } from '../../../lib/image/mosaic-effects';
  import type { OutputType } from '../../../lib/image/process';

  const t = pick(MESSAGES);

  /** 미리보기 사진의 긴 변 (원본은 결과 파일에만 쓴다) */
  const PREVIEW_SIDE = 1600;
  /** 미리보기 칸의 가장 큰 높이 (CSS 픽셀) */
  const VIEW_MAX_HEIGHT = 480;
  /** 이보다 짧게 끌면(CSS 픽셀) 그리기가 아니라 고른 것을 놓는 누르기로 본다 */
  const CLICK_SLOP = 4;
  /** JPG·WebP 화질. 가린 곳 밖은 원본과 거의 같게 높게 둔다 */
  const QUALITY = 0.92;
  const FORMATS: OutputType[] = ['image/jpeg', 'image/png', 'image/webp'];
  const SHAPES: Shape[] = ['rect', 'ellipse'];
  const EFFECTS: Effect[] = ['mosaic', 'blur', 'fill'];
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

  let regions = $state.raw<Region[]>([]);
  let selectedId = $state<number>();
  let nextId = 1;
  /** 새로 그릴 곳의 설정. 고른 곳의 설정을 바꾸면 이것도 따라간다 */
  let defaults = $state<Pick<Region, 'shape' | 'effect' | 'strength'>>({
    shape: 'rect',
    effect: 'mosaic',
    strength: 5,
  });
  let format = $state<OutputType>('image/jpeg');

  type Save =
    | { kind: 'idle' }
    | { kind: 'saving' }
    | { kind: 'saved'; size: number; count: number }
    | { kind: 'failed'; reason: MosaicFailure };
  let save = $state.raw<Save>({ kind: 'idle' });

  const board = $derived(
    photo ? { width: photo.width, height: photo.height } : { width: 1, height: 1 },
  );
  const selected = $derived(regions.find((region) => region.id === selectedId));
  const current = $derived(selected ?? defaults);

  let addButton: HTMLButtonElement | undefined = $state();
  let layer: HTMLDivElement | undefined = $state();

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
      regions = [];
      selectedId = undefined;
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
    regions = [];
    selectedId = undefined;
    save = { kind: 'idle' };
    phase = 'idle';
  }

  /** 결과가 바뀌었다: 지난번에 받은 결과 안내를 지운다 */
  function edited() {
    if (save.kind !== 'saving') save = { kind: 'idle' };
  }

  function update(id: number, change: Partial<Region>) {
    regions = regions.map((region) => (region.id === id ? { ...region, ...change } : region));
    edited();
  }

  function setRect(id: number, rect: Rect) {
    update(id, clampRect(rect, board));
  }

  function addRegion(rect: Rect) {
    const region: Region = { id: nextId++, ...defaults, ...clampRect(rect, board) };
    regions = [...regions, region];
    selectedId = region.id;
    edited();
    return region;
  }

  /** 키보드로도 넣을 수 있게, 사진 가운데에 하나 넣고 고른다 (그다음 방향키로 옮긴다) */
  async function addAtCenter() {
    const side = Math.round(Math.min(board.width, board.height) * 0.3);
    const region = addRegion({
      x: (board.width - side) / 2,
      y: (board.height - side) / 2,
      width: side,
      height: side,
    });
    await tick();
    layer?.querySelector<HTMLElement>(`[data-region="${region.id}"]`)?.focus();
  }

  async function remove(id: number) {
    const index = regions.findIndex((region) => region.id === id);
    regions = regions.filter((region) => region.id !== id);
    if (selectedId === id) selectedId = undefined;
    edited();
    // 지운 곳에 있던 초점을 다음 곳(없으면 추가 버튼)으로 옮긴다
    await tick();
    const next = regions[Math.min(index, regions.length - 1)];
    if (next) layer?.querySelector<HTMLElement>(`[data-region="${next.id}"]`)?.focus();
    else addButton?.focus();
  }

  function clearAll() {
    regions = [];
    selectedId = undefined;
    edited();
  }

  /** 설정 바꾸기: 고른 곳이 있으면 그곳을, 다음에 그릴 곳의 설정도 같이 바꾼다 */
  function setting(change: Partial<Pick<Region, 'shape' | 'effect' | 'strength'>>) {
    defaults = { ...defaults, ...change };
    if (selected) update(selected.id, change);
  }

  function setField(field: keyof Rect, value: number) {
    if (!selected || !Number.isFinite(value)) return;
    setRect(selected.id, { ...selected, [field]: value });
  }

  // 미리보기: 줄인 사진에 같은 계산을 걸어 그린다 (칸 크기·흐리는 거리도 줄인 만큼)
  let stageWidth = $state(0);
  const view = $derived.by(() => {
    if (stageWidth === 0) return { width: 0, height: 0 };
    const scale = Math.min(stageWidth / board.width, VIEW_MAX_HEIGHT / board.height);
    return { width: board.width * scale, height: board.height * scale };
  });
  let canvas: HTMLCanvasElement | undefined = $state();
  $effect(() => {
    if (!canvas || !photo) return;
    const { preview } = photo;
    canvas.width = preview.width;
    canvas.height = preview.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(preview, 0, 0);
    const scale = preview.width / photo.width;
    for (const region of regions) {
      const area = {
        x: region.x * scale,
        y: region.y * scale,
        width: region.width * scale,
        height: region.height * scale,
      };
      const box = boundsOf(area, canvas.width, canvas.height);
      if (box.width === 0 || box.height === 0) continue;
      const pixels = ctx.getImageData(box.x, box.y, box.width, box.height);
      paint(
        pixels,
        { ...area, x: area.x - box.x, y: area.y - box.y },
        region.shape,
        region.effect,
        amountOf(region) * scale,
      );
      ctx.putImageData(pixels, box.x, box.y);
    }
  });

  // 끌기: 화면 픽셀을 원본 화소로 바꾼다
  type Drag =
    | { kind: 'draw'; from: { x: number; y: number }; to: { x: number; y: number } }
    | { kind: 'move' | Edge; id: number; x: number; y: number; start: Rect };
  let drag = $state<Drag>();

  /** 화면 좌표 → 사진 화소 (사진 밖은 끝으로) */
  function pointAt(event: PointerEvent) {
    const rect = layer!.getBoundingClientRect();
    const k = board.width / rect.width;
    return {
      x: Math.min(board.width, Math.max(0, (event.clientX - rect.left) * k)),
      y: Math.min(board.height, Math.max(0, (event.clientY - rect.top) * k)),
    };
  }

  function startDraw(event: PointerEvent) {
    if (event.button !== 0 || save.kind === 'saving') return;
    event.preventDefault();
    layer!.setPointerCapture(event.pointerId);
    const point = pointAt(event);
    drag = { kind: 'draw', from: point, to: point };
  }

  function startDrag(event: PointerEvent, region: Region, kind: 'move' | Edge) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    selectedId = region.id;
    drag = { kind, id: region.id, x: event.clientX, y: event.clientY, start: region };
  }

  function moveDrag(event: PointerEvent) {
    if (!drag) return;
    if (drag.kind === 'draw') {
      drag = { ...drag, to: pointAt(event) };
      return;
    }
    const k = board.width / view.width;
    const dx = (event.clientX - drag.x) * k;
    const dy = (event.clientY - drag.y) * k;
    const { start } = drag;
    if (drag.kind === 'move') setRect(drag.id, { ...start, x: start.x + dx, y: start.y + dy });
    else setRect(drag.id, resizeRect(start, drag.kind, dx, dy, board));
  }

  function endDrag() {
    if (drag?.kind === 'draw') {
      const rect = drawnRect(drag);
      const k = board.width / view.width;
      // 거의 움직이지 않았으면 빈 곳을 누른 것: 고른 것을 놓는다
      if (rect.width / k < CLICK_SLOP && rect.height / k < CLICK_SLOP) selectedId = undefined;
      else addRegion(rect);
    }
    drag = undefined;
  }

  function drawnRect(draw: { from: { x: number; y: number }; to: { x: number; y: number } }) {
    return {
      x: Math.min(draw.from.x, draw.to.x),
      y: Math.min(draw.from.y, draw.to.y),
      width: Math.abs(draw.to.x - draw.from.x),
      height: Math.abs(draw.to.y - draw.from.y),
    };
  }

  function onKey(event: KeyboardEvent, region: Region, target: 'move' | Edge) {
    if (target === 'move' && (event.key === 'Delete' || event.key === 'Backspace')) {
      event.preventDefault();
      remove(region.id);
      return;
    }
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
    selectedId = region.id;
    if (target === 'move')
      setRect(region.id, { ...region, x: region.x + move[0], y: region.y + move[1] });
    else setRect(region.id, resizeRect(region, target, ...move, board));
  }

  /** 손잡이 자리 (사진 대비 %) */
  function edgeAt(rect: Rect, edge: Edge) {
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

  const percent = (value: number, total: number) => `${(value / total) * 100}%`;

  async function download() {
    if (!photo || regions.length === 0 || save.kind === 'saving') return;
    const entitlement = await canUse('image/mosaic');
    if (!entitlement.allowed) return;
    const ticket = generation;
    const wanted = { regions, format, name: photo.name };
    save = { kind: 'saving' };
    try {
      const bytes = await exportImage(wanted.regions, wanted.format, QUALITY);
      if (ticket !== generation) return;
      downloadFile(
        bytes,
        `${baseName(wanted.name)}_${t.suffix}.${EXTENSIONS[wanted.format]}`,
        wanted.format,
      );
      save = { kind: 'saved', size: bytes.length, count: wanted.regions.length };
    } catch (error) {
      if (ticket !== generation) return;
      save = { kind: 'failed', reason: error instanceof MosaicError ? error.reason : 'tooLarge' };
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
          {t.saved(save.count, formatSize(save.size))}
        {:else if save.kind === 'saving'}
          {t.saving}
        {:else if regions.length === 0}
          {t.needRegions}
        {:else}
          {t.ready(regions.length, board.width, board.height, t.formats[format])}
        {/if}
      {/snippet}
      <button
        type="button"
        class="btn primary"
        disabled={regions.length === 0 || save.kind === 'saving'}
        onclick={download}>{t.download}</button
      >
    </ActionBar>

    <div class="tool-body">
      <div class="layout">
        <div class="stage" bind:clientWidth={stageWidth}>
          <div class="view" style:width="{view.width}px" style:height="{view.height}px">
            <canvas bind:this={canvas}></canvas>
            <div
              class="layer"
              role="presentation"
              bind:this={layer}
              onpointerdown={startDraw}
              onpointermove={moveDrag}
              onpointerup={endDrag}
              onpointercancel={endDrag}
            >
              {#each regions as region, index (region.id)}
                <button
                  type="button"
                  class="region {region.shape}"
                  class:selected={region.id === selectedId}
                  data-region={region.id}
                  style:left={percent(region.x, board.width)}
                  style:top={percent(region.y, board.height)}
                  style:width={percent(region.width, board.width)}
                  style:height={percent(region.height, board.height)}
                  aria-label={t.region(index + 1, t.effects[region.effect])}
                  aria-describedby="view-help"
                  onpointerdown={(event) => startDrag(event, region, 'move')}
                  onkeydown={(event) => onKey(event, region, 'move')}
                  onfocus={() => (selectedId = region.id)}
                >
                  <span class="tag" aria-hidden="true">{index + 1}</span>
                </button>
              {/each}
              {#if drag?.kind === 'draw'}
                {@const rect = drawnRect(drag)}
                <div
                  class="region drawing {defaults.shape}"
                  style:left={percent(rect.x, board.width)}
                  style:top={percent(rect.y, board.height)}
                  style:width={percent(rect.width, board.width)}
                  style:height={percent(rect.height, board.height)}
                ></div>
              {/if}
            </div>
            {#if selected}
              {#each EDGES as edge (edge)}
                {@const at = edgeAt(selected, edge)}
                <button
                  type="button"
                  class="handle {edge}"
                  style:left="{at.left}%"
                  style:top="{at.top}%"
                  aria-label={t.edges[edge]}
                  onpointerdown={(event) => startDrag(event, selected, edge)}
                  onpointermove={moveDrag}
                  onpointerup={endDrag}
                  onpointercancel={endDrag}
                  onkeydown={(event) => onKey(event, selected, edge)}
                ></button>
              {/each}
            {/if}
          </div>
          <p class="help" id="view-help">{t.previewHelp}</p>
        </div>

        <div class="panel">
          <section aria-labelledby="regions-title">
            <h2 id="regions-title">{t.regionsTitle}</h2>
            <p class="count">{t.count(regions.length)}</p>
            <div class="row">
              <button type="button" class="btn" bind:this={addButton} onclick={addAtCenter}
                >{t.add}</button
              >
              <button
                type="button"
                class="btn"
                disabled={!selected}
                onclick={() => selected && remove(selected.id)}>{t.remove}</button
              >
              <button type="button" class="btn" disabled={regions.length === 0} onclick={clearAll}
                >{t.clear}</button
              >
            </div>
            <p class="safety">{t.safety}</p>
          </section>

          <section aria-labelledby="settings-title">
            <h2 id="settings-title">
              {selected ? t.settingsOf(regions.indexOf(selected) + 1) : t.settingsNew}
            </h2>
            <div class="choices">
              <div class="choice" role="radiogroup" aria-label={t.effectGroup}>
                {#each EFFECTS as option (option)}
                  <label class:checked={current.effect === option}>
                    <input
                      type="radio"
                      name="effect"
                      value={option}
                      checked={current.effect === option}
                      onchange={() => setting({ effect: option })}
                    />
                    {t.effects[option]}
                  </label>
                {/each}
              </div>
              <div class="choice" role="radiogroup" aria-label={t.shapeGroup}>
                {#each SHAPES as option (option)}
                  <label class:checked={current.shape === option}>
                    <input
                      type="radio"
                      name="shape"
                      value={option}
                      checked={current.shape === option}
                      onchange={() => setting({ shape: option })}
                    />
                    {t.shapes[option]}
                  </label>
                {/each}
              </div>
            </div>
            <p class="help">{t.effectHelp[current.effect]}</p>
            {#if current.effect !== 'fill'}
              <div class="row strength">
                <label for="strength">{t.strength}</label>
                <input
                  id="strength"
                  type="range"
                  min={MIN_STRENGTH}
                  max={MAX_STRENGTH}
                  step="1"
                  value={current.strength}
                  oninput={(event) => setting({ strength: event.currentTarget.valueAsNumber })}
                />
                {#if selected}
                  <span class="value"
                    >{current.effect === 'blur'
                      ? t.strengthValue.blur(amountOf(selected))
                      : t.strengthValue.mosaic(amountOf(selected))}</span
                  >
                {/if}
              </div>
            {/if}
            {#if selected}
              {@const region = selected}
              <div class="fields">
                {#each ['x', 'y', 'width', 'height'] as const as field (field)}
                  <label class="field">
                    {t.fields[field]}
                    <input
                      type="number"
                      min={field === 'width' || field === 'height' ? 1 : 0}
                      max={field === 'x' || field === 'width' ? board.width : board.height}
                      inputmode="numeric"
                      value={region[field]}
                      onchange={(event) => {
                        setField(field, event.currentTarget.valueAsNumber);
                        event.currentTarget.value = String(selected?.[field] ?? '');
                      }}
                    />
                  </label>
                {/each}
              </div>
            {/if}
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
  .layer {
    position: absolute;
    inset: 0;
    overflow: hidden;
    cursor: crosshair;
    touch-action: none;
  }
  .region {
    position: absolute;
    padding: 0;
    border: 2px dashed var(--color-paper);
    background: transparent;
    /* 밝은 사진·어두운 사진 어디서나 칸 테두리가 보이게 바깥에 어두운 선을 한 겹 더 */
    box-shadow: 0 0 0 1px var(--color-redact);
    cursor: move;
    touch-action: none;
  }
  .region.ellipse {
    border-radius: 50%;
  }
  .region.selected {
    border-style: solid;
    border-color: var(--color-accent);
  }
  .region.drawing {
    border-style: solid;
    border-color: var(--color-accent);
    pointer-events: none;
  }
  .region:focus-visible {
    outline: 2px dashed var(--color-accent);
    outline-offset: 3px;
  }
  .tag {
    position: absolute;
    top: 2px;
    left: 2px;
    min-width: 18px;
    padding: 0 4px;
    border-radius: 4px;
    background: var(--color-redact);
    color: var(--color-on-scrim);
    font-size: 11px;
    font-weight: 700;
    line-height: 18px;
    text-align: center;
  }
  .region.ellipse .tag {
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }
  .region.selected .tag {
    background: var(--color-accent);
    color: var(--color-paper);
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
  .count {
    margin: 0 0 12px;
    color: var(--color-muted);
    font-size: 14px;
  }
  .safety {
    margin: 12px 0 0;
    padding: 10px 12px;
    border-left: 3px solid var(--color-accent);
    background: var(--color-accent-soft);
    font-size: 13px;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .choices {
    margin-bottom: 0;
  }
  .strength {
    margin-top: 12px;
  }
  .strength label {
    font-size: 14px;
    font-weight: 600;
  }
  .strength input {
    flex: 1;
    min-width: 120px;
    accent-color: var(--color-accent);
  }
  .strength .value {
    min-width: 72px;
    font-size: 14px;
    font-variant-numeric: tabular-nums;
    text-align: right;
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
