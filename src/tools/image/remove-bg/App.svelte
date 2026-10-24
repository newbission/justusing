<!--
  배경 지우기 도구 화면 (격리 frame 안에서 실행).
  사진 한 장에서 누른 곳(처음에는 가운데)의 물체·사람·동물만 남기고 배경을 지운다. 지우개·되살리기 붓으로 고치고,
  가장자리를 좁히거나 넓히고 부드럽게 다듬는다. 투명 PNG 또는 고른 색 배경의 JPG로 원본 크기 그대로 받는다.
  물체 나누기 데이터는 처음 한 번 받아(크기를 밝히고 묻는다) 이 브라우저에 보관한다. 사진은 어디로도 전송되지 않는다.
-->
<script lang="ts">
  import '../../../frame/controls.css';
  import { onMount, untrack } from 'svelte';
  import { pick } from '../../../frame/locale';
  import { MESSAGES } from './messages';
  import ActionBar from '../../../frame/ActionBar.svelte';
  import FileDrop from '../../../frame/FileDrop.svelte';
  import { dataStatus, loadData, missingData } from '../../../frame/data';
  import { downloadFile } from '../../../frame/download';
  import { onFrameFiles } from '../../../frame/drop';
  import { baseName, formatSize } from '../../../frame/format';
  import { requestShowTool } from '../../../frame/parent';
  import { canUse } from '../../../lib/entitlement';
  import {
    CutoutError,
    CutoutPhoto,
    type CutoutFailure,
    type TrimBox,
  } from '../../../lib/cutout/cutout';
  import {
    SHIFT_LIMIT,
    SOFT_LIMIT,
    coverage,
    union,
    type Look,
    type Mask,
    type Point,
    type Stroke,
  } from '../../../lib/cutout/matte';
  import { CUTOUT_CONSENT, CUTOUT_FILES, ObjectFinder } from '../../../lib/cutout/objects';
  import type { OutputType } from '../../../lib/image/process';

  const t = pick(MESSAGES);

  /** 미리보기 사진의 긴 변 (원본은 결과 파일에만 쓴다) */
  const PREVIEW_SIDE = 1600;
  /** 물체 나누기에 넣는 사진의 긴 변 (모델은 512로 줄여 보고, 마스크는 이 크기로 돌려준다) */
  const ANALYSIS_SIDE = 1024;
  /** 미리보기 칸의 가장 큰 높이 (CSS 픽셀) */
  const VIEW_MAX_HEIGHT = 480;
  /** 이보다 짧게 끌면(CSS 픽셀) 누르기로 본다 */
  const CLICK_SLOP = 6;
  /** 남길 물체로 볼 만한 곳이 이보다 적으면 찾지 못한 것으로 본다 */
  const MIN_COVERAGE = 0.002;
  /** JPG 화질 (배경을 칠한 결과) */
  const QUALITY = 0.92;
  /** 처음 남길 곳: 사진 가운데 */
  const CENTER: Point = { x: 0.5, y: 0.5 };
  const BRUSH_MIN = 1;
  const BRUSH_MAX = 12;
  const WHITE = '#ffffff';

  interface Photo {
    name: string;
    /** 바로 세운 원본의 가로·세로 */
    width: number;
    height: number;
    preview: ImageBitmap;
    /** 물체 나누기용으로 줄인 사진 (엔진에 넘길 때마다 사본을 만든다) */
    analysis: ImageBitmap;
  }

  type Phase = 'idle' | 'opening' | 'error' | 'ready';
  let phase = $state<Phase>('idle');
  let photo = $state.raw<Photo>();
  /** 새 사진을 열거나 닫을 때마다 늘어난다. 늦게 끝난 예전 작업이 지금 사진을 덮어쓰지 않게 한다 */
  let generation = 0;

  type Data =
    | { kind: 'checking' }
    | { kind: 'missing'; removed: boolean; lowSpace: boolean }
    | { kind: 'downloading'; percent: number }
    | { kind: 'failed' }
    | { kind: 'ready' };
  let data = $state<Data>({ kind: 'checking' });
  const totalBytes = CUTOUT_FILES.reduce((sum, file) => sum + file.bytes, 0);
  /** 받아야 할 크기 (증명사진에서 엔진을 받았으면 모델만) */
  let needBytes = $state(totalBytes);

  /** 남길 곳(누른 점)과 붓질, 되돌리기 순서 */
  let points = $state.raw<Point[]>([]);
  let strokes = $state.raw<Stroke[]>([]);
  let history = $state.raw<('point' | 'stroke')[]>([]);

  type Separation = 'idle' | 'working' | 'ready' | 'failed';
  let separation = $state<Separation>('idle');
  /** 모델이 아무 물체도 남기지 못했다 */
  let empty = $state(false);
  /** 사진 워커에 새 마스크를 넘길 때마다 늘어난다 (미리보기를 다시 그린다) */
  let maskVersion = $state(0);
  /** 점마다 나눈 마스크 (같은 점을 다시 나누지 않는다). 사진이 바뀌면 비운다 */
  const masks = new Map<string, Mask>();
  const keyOf = (point: Point) => `${point.x.toFixed(4)},${point.y.toFixed(4)}`;

  type Tool = 'pick' | 'erase' | 'restore';
  let tool = $state<Tool>('pick');
  /** 붓 지름 (사진 긴 변의 %) */
  let brush = $state(4);
  let shift = $state(0);
  let soft = $state(0);
  type BackgroundChoice = 'none' | 'white' | 'custom';
  let background = $state<BackgroundChoice>('none');
  let customColor = $state('#dbe7f3');
  let trim = $state(false);
  let showOriginal = $state(false);

  const backgroundColor = $derived(
    background === 'none' ? undefined : background === 'white' ? WHITE : customColor,
  );
  const look = $derived<Look>({
    edge: { shift, soft },
    strokes,
    background: backgroundColor,
    trim,
  });
  const format = $derived<OutputType>(backgroundColor ? 'image/jpeg' : 'image/png');
  const formatName = $derived(format === 'image/png' ? 'PNG' : 'JPG');

  type Save =
    | { kind: 'idle' }
    | { kind: 'saving' }
    | { kind: 'saved'; size: number; width: number; height: number; format: string }
    | { kind: 'failed'; reason: CutoutFailure };
  let save = $state.raw<Save>({ kind: 'idle' });

  let finder: Promise<ObjectFinder> | undefined;
  /** 엔진에 넘긴 사진 (다른 사진이면 다시 넘긴다) */
  let finderPhoto: Photo | undefined;
  const photos = new CutoutPhoto();

  /** 받은 데이터로 엔진을 띄운다 (엔진이 바이트를 넘겨받아 비운다) */
  function startFinder(bytes: Promise<Map<string, Uint8Array>>) {
    const started = bytes.then((value) => ObjectFinder.create(value));
    started.catch(() => {
      if (finder === started) finder = undefined;
    });
    finder = started;
    finderPhoto = undefined;
    return started;
  }

  /** 엔진을 버린다 (워커가 죽었을 수 있다). 다음에는 보관본으로 다시 띄운다 */
  function dropFinder() {
    finder?.then((value) => value.dispose()).catch(() => {});
    finder = undefined;
    finderPhoto = undefined;
  }

  onMount(() => {
    dataStatus(CUTOUT_FILES, CUTOUT_CONSENT).then((status) => {
      const missing = missingData(CUTOUT_FILES, status);
      const lowSpace = status.available !== undefined && status.available < missing.bytes * 2;
      needBytes = missing.bytes;
      data =
        missing.bytes === 0
          ? { kind: 'ready' }
          : { kind: 'missing', removed: missing.removed, lowSpace };
    });
    const off = onFrameFiles(([file]) => {
      if (file) open(file);
    });
    return () => {
      off();
      dropFinder();
      photos.dispose();
      photo?.preview.close();
      photo?.analysis.close();
    };
  });

  async function downloadData() {
    data = { kind: 'downloading', percent: 0 };
    try {
      const bytes = await loadData(CUTOUT_FILES, CUTOUT_CONSENT, (received) => {
        data = {
          kind: 'downloading',
          percent: Math.min(99, Math.floor((received / Math.max(1, needBytes)) * 100)),
        };
      });
      // 받은 바이트로 바로 띄운다. 보관소를 쓸 수 없는 창(시크릿 모드 등)에서 다시 받지 않게 한다
      startFinder(Promise.resolve(bytes));
      data = { kind: 'ready' };
    } catch {
      data = { kind: 'failed' };
    }
  }

  async function open(file: File) {
    const ticket = ++generation;
    close(false);
    phase = 'opening';
    try {
      const opened = await photos.open(file, PREVIEW_SIDE, ANALYSIS_SIDE);
      if (ticket !== generation) {
        opened.preview.close();
        opened.analysis.close();
        return;
      }
      photo = { name: file.name, ...opened };
      points = [CENTER];
      strokes = [];
      history = ['point'];
      phase = 'ready';
      requestShowTool();
    } catch {
      if (ticket === generation) phase = 'error';
    }
  }

  function close(reset = true) {
    if (reset) generation++;
    photo?.preview.close();
    photo?.analysis.close();
    photo = undefined;
    masks.clear();
    points = [];
    strokes = [];
    history = [];
    separation = 'idle';
    empty = false;
    maskVersion = 0;
    box = undefined;
    showOriginal = false;
    save = { kind: 'idle' };
    phase = 'idle';
  }

  // 데이터가 준비되면 남길 곳이 바뀔 때마다 물체를 나눈다
  $effect(() => {
    if (data.kind !== 'ready' || !photo) return;
    void points;
    untrack(separate);
  });

  /**
   * 남길 곳마다 물체를 나눠 겹치고 사진 워커에 넘긴다. 한 번에 하나만 돌고, 그사이 바뀐 것은 끝난 뒤 다시 한다.
   * 늦게 끝난 예전 사진의 결과는 버린다
   */
  let separating = false;
  let again = false;
  async function separate() {
    if (separating) {
      again = true;
      return;
    }
    separating = true;
    try {
      do {
        again = false;
        const current = photo;
        const wanted = points;
        const ticket = generation;
        if (!current) break;
        separation = 'working';
        try {
          const found = await (finder ?? startFinder(loadData(CUTOUT_FILES, CUTOUT_CONSENT)));
          if (finderPhoto !== current) {
            await found.setImage(await createImageBitmap(current.analysis));
            finderPhoto = current;
          }
          for (const point of wanted) {
            if (ticket !== generation) break;
            if (!masks.has(keyOf(point))) masks.set(keyOf(point), await found.segment(point));
          }
          if (ticket !== generation) continue;
          const { width, height } = current.analysis;
          const merged = union(
            wanted.map((point) => masks.get(keyOf(point))!),
            width,
            height,
          );
          empty = coverage(merged) < MIN_COVERAGE;
          await photos.setMask(merged);
          if (ticket !== generation) continue;
          maskVersion++;
          separation = 'ready';
        } catch {
          if (ticket !== generation) continue;
          dropFinder();
          separation = 'failed';
        }
      } while (again);
    } finally {
      separating = false;
    }
  }

  function retry() {
    separation = 'idle';
    separate();
  }

  /** 결과가 바뀌었다: 지난번에 받은 결과 안내를 지운다 */
  function edited() {
    if (save.kind !== 'saving') save = { kind: 'idle' };
  }
  $effect(() => {
    void look;
    untrack(edited);
  });

  function addPoint(point: Point) {
    points = [...points, point];
    history = [...history, 'point'];
  }

  function addStroke(stroke: Stroke) {
    strokes = [...strokes, stroke];
    history = [...history, 'stroke'];
  }

  function undo() {
    const last = history.at(-1);
    if (!last) return;
    history = history.slice(0, -1);
    if (last === 'point') points = points.slice(0, -1);
    else strokes = strokes.slice(0, -1);
  }

  function restart() {
    points = [CENTER];
    strokes = [];
    history = ['point'];
  }

  // 미리보기
  const board = $derived(
    photo ? { width: photo.width, height: photo.height } : { width: 1, height: 1 },
  );
  let stageWidth = $state(0);
  const view = $derived.by(() => {
    if (stageWidth === 0) return { width: 0, height: 0 };
    const scale = Math.min(stageWidth / board.width, VIEW_MAX_HEIGHT / board.height);
    return { width: board.width * scale, height: board.height * scale };
  });
  let canvas: HTMLCanvasElement | undefined = $state();
  /** 물체에 맞춰 자를 때 남을 자리 (미리보기에 점선으로) */
  let box = $state.raw<TrimBox>();

  function show(image: ImageBitmap) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  }

  $effect(() => {
    if (!canvas || !photo) return;
    canvas.width = photo.preview.width;
    canvas.height = photo.preview.height;
    show(photo.preview);
    untrack(refresh);
  });

  $effect(() => {
    void look;
    void maskVersion;
    void showOriginal;
    untrack(refresh);
  });

  /**
   * 미리보기는 워커가 그린다. 한 번에 하나만 보내고, 그사이 바뀐 것은 끝난 뒤 가장 최근 것 하나만 다시 그린다.
   * 마스크가 없거나 원본을 보고 있으면 원본을 그린다
   */
  let rendering = false;
  let stale = false;
  async function refresh() {
    if (rendering) {
      stale = true;
      return;
    }
    rendering = true;
    try {
      do {
        stale = false;
        const ticket = generation;
        if (!photo) break;
        if (showOriginal || maskVersion === 0) {
          show(photo.preview);
          box = undefined;
          continue;
        }
        let drawn: { image: ImageBitmap; box?: TrimBox };
        try {
          drawn = await photos.preview(look);
        } catch {
          // 워커가 죽었으면 저장할 때 다시 열라고 알린다. 미리보기는 지난 그림 그대로 둔다
          break;
        }
        if (ticket === generation && !showOriginal) {
          show(drawn.image);
          box = drawn.box;
        }
        drawn.image.close();
      } while (stale);
    } finally {
      rendering = false;
    }
  }

  // 누르기·붓질: 화면 자리를 사진 비율 자리로 바꾼다
  let layer: HTMLDivElement | undefined = $state();
  let pressed: { x: number; y: number } | undefined;
  /** 지금 칠하는 붓질 (손을 떼면 붓질 목록에 들어간다) */
  let painting = $state.raw<Stroke>();
  /** 붓 모양을 보여 줄 자리 (포인터가 칸 위에 있을 때) */
  let hover = $state.raw<Point>();
  /** 키보드로 옮기는 자리 (칸에 초점이 있을 때 보인다) */
  let cursor = $state.raw<Point>(CENTER);
  let focused = $state(false);

  const canEdit = $derived(data.kind === 'ready' && phase === 'ready');
  const brushes = $derived(tool !== 'pick' && maskVersion > 0);

  function pointAt(event: PointerEvent): Point {
    const rect = layer!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  }

  function onpointerdown(event: PointerEvent) {
    if (event.button !== 0 || !canEdit || save.kind === 'saving') return;
    event.preventDefault();
    layer!.setPointerCapture(event.pointerId);
    if (tool === 'pick') {
      pressed = { x: event.clientX, y: event.clientY };
    } else if (brushes) {
      painting = { mode: tool, size: brush / 100, points: [pointAt(event)] };
    }
  }

  function onpointermove(event: PointerEvent) {
    hover = pointAt(event);
    if (!painting) return;
    const point = pointAt(event);
    const last = painting.points.at(-1)!;
    // 너무 촘촘하게 넣지 않는다 (붓 지름의 1/6마다)
    const distance =
      Math.hypot((point.x - last.x) * board.width, (point.y - last.y) * board.height) /
      Math.max(board.width, board.height);
    if (distance < painting.size / 6) return;
    painting = { ...painting, points: [...painting.points, point] };
  }

  function onpointerup(event: PointerEvent) {
    if (pressed) {
      const moved = Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y);
      if (moved < CLICK_SLOP) addPoint(pointAt(event));
      pressed = undefined;
    }
    if (painting) {
      addStroke(painting);
      painting = undefined;
    }
  }

  function onpointercancel() {
    pressed = undefined;
    painting = undefined;
  }

  function onkeydown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      undo();
      return;
    }
    const step = event.shiftKey ? 0.05 : 0.01;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      cursor = {
        x: Math.min(1, Math.max(0, cursor.x + move[0])),
        y: Math.min(1, Math.max(0, cursor.y + move[1])),
      };
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && canEdit) {
      event.preventDefault();
      if (tool === 'pick') addPoint(cursor);
      else if (brushes) addStroke({ mode: tool, size: brush / 100, points: [cursor] });
    }
  }

  const percent = (value: number) => `${value * 100}%`;
  /** 붓 지름 (화면 픽셀) */
  const brushPixels = $derived((brush / 100) * Math.max(view.width, view.height));

  const canSave = $derived(
    data.kind === 'ready' && separation === 'ready' && save.kind !== 'saving',
  );

  async function download() {
    if (!photo || !canSave) return;
    const entitlement = await canUse('image/remove-bg');
    if (!entitlement.allowed) return;
    const ticket = generation;
    const wanted = { look, format, name: photo.name, formatName };
    save = { kind: 'saving' };
    try {
      const saved = await photos.export(wanted.look, wanted.format, QUALITY);
      if (ticket !== generation) return;
      const extension = wanted.format === 'image/png' ? 'png' : 'jpg';
      downloadFile(saved.bytes, `${baseName(wanted.name)}_${t.suffix}.${extension}`, wanted.format);
      save = {
        kind: 'saved',
        size: saved.bytes.length,
        width: saved.width,
        height: saved.height,
        format: wanted.formatName,
      };
    } catch (error) {
      if (ticket !== generation) return;
      save = { kind: 'failed', reason: error instanceof CutoutError ? error.reason : 'tooLarge' };
    }
  }

  const keepsSomething = $derived(!empty || strokes.some((stroke) => stroke.mode === 'restore'));
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
          {t.saved(`${save.width}×${save.height}`, save.format, formatSize(save.size))}
        {:else if save.kind === 'saving'}
          {t.saving}
        {:else if data.kind !== 'ready'}
          {t.needData}
        {:else if separation === 'failed'}
          <strong>{t.separateFailed}</strong>
        {:else if separation !== 'ready'}
          {t.separating}
        {:else if !keepsSomething}
          <strong>{t.empty}</strong>
        {:else if points.length === 1 && points[0] === CENTER}
          {t.separatedCenter}
        {:else}
          {t.separated(points.length)}
        {/if}
      {/snippet}
      <button type="button" class="btn primary" disabled={!canSave} onclick={download}
        >{t.download(formatName)}</button
      >
    </ActionBar>

    <div class="tool-body">
      {#if data.kind !== 'ready'}
        <section class="data" aria-label={t.dataTitle}>
          {#if data.kind === 'checking'}
            <p>{t.checking}</p>
          {:else}
            <h2>{t.dataTitle}</h2>
            {#if data.kind === 'missing' && data.removed}
              <p><strong>{t.dataRemoved}</strong></p>
            {/if}
            <p>{t.dataSize(formatSize(needBytes))}</p>
            {#if needBytes < totalBytes}
              <p class="help">{t.dataShared}</p>
            {/if}
            <p class="help">{t.dataNote}</p>
            {#if data.kind === 'missing' && data.lowSpace}
              <p class="help">{t.lowSpace}</p>
            {/if}
            {#if data.kind === 'failed'}
              <p><strong>{t.dataFailed}</strong></p>
            {/if}
            <button
              type="button"
              class="btn primary"
              disabled={data.kind === 'downloading'}
              onclick={downloadData}
              >{data.kind === 'downloading'
                ? t.downloading(data.percent)
                : t.getData(formatSize(needBytes))}</button
            >
          {/if}
        </section>
      {/if}

      {#if separation === 'failed'}
        <section aria-label={t.separateFailed}>
          <p class="problem">{t.separateFailed}</p>
          <button type="button" class="btn" onclick={retry}>{t.retry}</button>
        </section>
      {/if}

      <div class="layout">
        <div class="stage" bind:clientWidth={stageWidth}>
          <div class="view" style:width="{view.width}px" style:height="{view.height}px">
            <canvas bind:this={canvas}></canvas>
            <!-- 누르기·붓질·방향키로 남길 곳을 고르는 칸 (같은 일을 하는 버튼·고르기도 옆에 있다) -->
            <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
            <div
              class="layer {tool}"
              class:off={!canEdit}
              role="application"
              tabindex="0"
              aria-label={t.preview}
              aria-describedby="view-help"
              bind:this={layer}
              {onpointerdown}
              {onpointermove}
              {onpointerup}
              {onpointercancel}
              onpointerleave={() => (hover = undefined)}
              {onkeydown}
              onfocus={() => (focused = true)}
              onblur={() => (focused = false)}
            >
              {#if box && trim && !showOriginal}
                <span
                  class="trim"
                  style:left={percent(box.x)}
                  style:top={percent(box.y)}
                  style:width={percent(box.width)}
                  style:height={percent(box.height)}
                ></span>
              {/if}
              {#if painting}
                <svg
                  class="painting {painting.mode}"
                  viewBox="0 0 {board.width} {board.height}"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <polyline
                    points={painting.points
                      .map((point) => `${point.x * board.width},${point.y * board.height}`)
                      .join(' ')}
                    stroke-width={painting.size * Math.max(board.width, board.height)}
                  />
                </svg>
              {/if}
              {#if canEdit && !showOriginal}
                {#each points as point, index (index)}
                  <span
                    class="point"
                    style:left={percent(point.x)}
                    style:top={percent(point.y)}
                    aria-hidden="true">{index + 1}</span
                  >
                {/each}
              {/if}
              {#if hover && brushes}
                <span
                  class="brush {tool}"
                  style:left={percent(hover.x)}
                  style:top={percent(hover.y)}
                  style:width="{brushPixels}px"
                  style:height="{brushPixels}px"
                  aria-hidden="true"
                ></span>
              {/if}
              {#if focused && canEdit}
                <span
                  class="cursor"
                  class:round={brushes}
                  style:left={percent(cursor.x)}
                  style:top={percent(cursor.y)}
                  style:width={brushes ? `${brushPixels}px` : undefined}
                  style:height={brushes ? `${brushPixels}px` : undefined}
                  aria-hidden="true"
                ></span>
              {/if}
            </div>
          </div>
          <div class="row under">
            <button
              type="button"
              class="btn"
              aria-pressed={showOriginal}
              disabled={maskVersion === 0}
              onclick={() => (showOriginal = !showOriginal)}>{t.showOriginal}</button
            >
            <span class="count">{t.count(points.length, strokes.length)}</span>
          </div>
          <p class="help" id="view-help">{t.previewHelp}</p>
        </div>

        <div class="panel">
          <section aria-labelledby="tool-title">
            <h2 id="tool-title">{t.toolTitle}</h2>
            <div class="choice" role="radiogroup" aria-label={t.toolGroup}>
              {#each ['pick', 'erase', 'restore'] as const as option (option)}
                <label class:checked={tool === option}>
                  <input
                    type="radio"
                    name="tool"
                    value={option}
                    bind:group={tool}
                    disabled={!canEdit}
                  />
                  {t.tools[option]}
                </label>
              {/each}
            </div>
            <p class="help">{t.toolHelp[tool]}</p>
            {#if tool !== 'pick'}
              <div class="slider">
                <label for="brush">{t.brushSize}</label>
                <input
                  id="brush"
                  type="range"
                  min={BRUSH_MIN}
                  max={BRUSH_MAX}
                  step="1"
                  bind:value={brush}
                />
                <span class="value">{brush}%</span>
              </div>
            {/if}
            <div class="row">
              <button type="button" class="btn" disabled={history.length === 0} onclick={undo}
                >{t.undo}</button
              >
              <button type="button" class="btn" disabled={!canEdit} onclick={restart}
                >{t.restart}</button
              >
            </div>
          </section>

          <section aria-labelledby="edge-title">
            <h2 id="edge-title">{t.edgeTitle}</h2>
            <div class="slider">
              <label for="shift">{t.shift}</label>
              <input
                id="shift"
                type="range"
                min={-SHIFT_LIMIT}
                max={SHIFT_LIMIT}
                step="1"
                bind:value={shift}
              />
              <span class="value">{t.shiftValue(shift)}</span>
            </div>
            <div class="slider">
              <label for="soft">{t.soft}</label>
              <input id="soft" type="range" min="0" max={SOFT_LIMIT} step="1" bind:value={soft} />
              <span class="value">{soft}</span>
            </div>
            <p class="help">{t.edgeHelp}</p>
          </section>

          <section aria-labelledby="background-title">
            <h2 id="background-title">{t.backgroundTitle}</h2>
            <div class="swatches" role="radiogroup" aria-labelledby="background-title">
              {#each ['none', 'white', 'custom'] as const as option (option)}
                <label class:checked={background === option}>
                  <input type="radio" name="background" value={option} bind:group={background} />
                  <span
                    class="dot"
                    class:none={option === 'none'}
                    style:background-color={option === 'white'
                      ? WHITE
                      : option === 'custom'
                        ? customColor
                        : undefined}
                  ></span>
                  {t.backgrounds[option]}
                </label>
              {/each}
            </div>
            {#if background === 'custom'}
              <label class="pick">
                {t.customColor}
                <input type="color" bind:value={customColor} />
              </label>
            {/if}
            <p class="help">
              {backgroundColor ? t.backgroundHelp.color : t.backgroundHelp.none}
            </p>
            <label class="check">
              <input type="checkbox" bind:checked={trim} />
              {t.trim}
            </label>
            {#if trim}
              <p class="help">{t.trimHelp}</p>
            {/if}
            <p class="help">{t.sizeNote}</p>
          </section>

          <p class="limits">{t.limits}</p>
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
    /* 체크무늬: 지워진(투명한) 곳이 보이게. 두 테마 모두 밝은 칸으로 그려 사진 색과 헷갈리지 않게 한다 */
    background: repeating-conic-gradient(
        color-mix(in srgb, var(--color-paper-text) 14%, var(--color-paper)) 0 25%,
        var(--color-paper) 0 50%
      )
      0 0 / 16px 16px;
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
  .layer.erase,
  .layer.restore {
    cursor: none;
  }
  .layer.off {
    cursor: default;
  }
  .layer:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
  .point {
    position: absolute;
    width: 22px;
    height: 22px;
    margin: -11px 0 0 -11px;
    border: 2px solid var(--color-paper);
    border-radius: 50%;
    background: var(--color-accent);
    box-shadow: 0 0 0 1px var(--color-redact);
    color: var(--color-paper);
    font-size: 11px;
    font-weight: 700;
    line-height: 18px;
    text-align: center;
    pointer-events: none;
  }
  .brush,
  .cursor {
    position: absolute;
    transform: translate(-50%, -50%);
    border: 2px solid var(--color-paper);
    border-radius: 50%;
    box-shadow:
      0 0 0 1px var(--color-redact),
      inset 0 0 0 1px var(--color-redact);
    pointer-events: none;
  }
  .brush.restore {
    border-color: var(--color-accent);
  }
  /* 키보드 자리: 고르기는 십자, 붓은 붓 크기 동그라미 */
  .cursor:not(.round) {
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 0;
    box-shadow: none;
    background:
      linear-gradient(var(--color-accent), var(--color-accent)) center / 2px 100% no-repeat,
      linear-gradient(var(--color-accent), var(--color-accent)) center / 100% 2px no-repeat;
  }
  .painting {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  .painting polyline {
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
    opacity: 0.45;
  }
  .painting.erase polyline {
    stroke: var(--color-redact);
  }
  .painting.restore polyline {
    stroke: var(--color-accent);
  }
  .trim {
    position: absolute;
    border: 2px dashed var(--color-accent);
    box-shadow: 0 0 0 1px var(--color-paper);
    pointer-events: none;
  }
  .under {
    justify-content: center;
    margin-top: 12px;
  }
  .count {
    color: var(--color-muted);
    font-size: 13px;
  }
  .stage .help {
    margin: 8px 0 0;
    text-align: center;
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
  .data p {
    margin: 0 0 8px;
    font-size: 14px;
  }
  .data .help {
    margin: 0 0 8px;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  section .row {
    margin-top: 12px;
  }
  .slider {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    margin-top: 12px;
  }
  .slider label {
    min-width: 88px;
    font-size: 14px;
    font-weight: 600;
  }
  .slider input {
    flex: 1;
    min-width: 120px;
    accent-color: var(--color-accent);
  }
  .slider .value {
    min-width: 44px;
    font-size: 14px;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
  .swatches {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .swatches label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius);
    font-size: 14px;
    cursor: pointer;
  }
  .swatches label:hover {
    background: var(--color-hover);
  }
  .swatches label.checked {
    border-color: var(--color-text);
    box-shadow: inset 0 0 0 1px var(--color-text);
    font-weight: 600;
  }
  .swatches label:has(input:focus-visible) {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
  .swatches input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .dot {
    width: 14px;
    height: 14px;
    border: 1px solid var(--color-line);
    border-radius: 50%;
  }
  /* 투명: 체크무늬 점 */
  .dot.none {
    background: repeating-conic-gradient(
        color-mix(in srgb, var(--color-paper-text) 22%, var(--color-paper)) 0 25%,
        var(--color-paper) 0 50%
      )
      0 0 / 7px 7px;
  }
  .pick {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
    font-size: 14px;
  }
  .pick input {
    width: 44px;
    height: 32px;
    padding: 0;
    border: 1px solid var(--color-line);
    border-radius: var(--radius);
    background: none;
  }
  .check {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
  .check input {
    width: 16px;
    height: 16px;
    accent-color: var(--color-accent);
  }
  .limits {
    margin: 0 0 16px;
    padding: 10px 12px;
    border-left: 3px solid var(--color-accent);
    background: var(--color-accent-soft);
    font-size: 13px;
  }
</style>
