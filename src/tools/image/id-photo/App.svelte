<!--
  증명사진 도구 화면 (격리 frame 안에서 실행).
  사진 한 장에서 얼굴을 찾아 여권 규격(3.5×4.5cm, 머리 길이 3.2~3.6cm)에 맞게 자르고·키우고·기울기만 바로잡는다.
  얼굴 찾기 데이터는 처음 한 번 받아(크기를 밝히고 묻는다) 이 브라우저에 보관한다. 받지 않아도 직접 맞출 수 있다.
  사진은 어디로도 전송되지 않는다.
-->
<script lang="ts">
  import '../../../frame/controls.css';
  import { onMount, untrack } from 'svelte';
  import { pick } from '../../../frame/locale';
  import { MESSAGES } from './messages';
  import ActionBar from '../../../frame/ActionBar.svelte';
  import FileDrop from '../../../frame/FileDrop.svelte';
  import { dataStatus, loadData } from '../../../frame/data';
  import { downloadFile } from '../../../frame/download';
  import { onFrameFiles } from '../../../frame/drop';
  import { baseName, formatSize } from '../../../frame/format';
  import { requestShowTool } from '../../../frame/parent';
  import { canUse } from '../../../lib/entitlement';
  import { FACE_CONSENT, FACE_FILES, FaceFinder, type Point } from '../../../lib/face/face';
  import {
    SPEC,
    autoPlace,
    centerPlace,
    drawCrop,
    exportJpeg,
    headLength,
    outside,
    readFace,
    type Face,
    type Placement,
    type Thumb,
    whiteBackground,
  } from '../../../lib/face/id-photo';

  const t = pick(MESSAGES);

  /** 미리보기·얼굴 찾기에 쓰는 사진의 긴 변 (원본은 결과 파일에만 쓴다) */
  const PREVIEW_SIDE = 1600;
  /** 정수리·배경을 살필 때 쓰는 사진의 긴 변 */
  const THUMB_SIDE = 600;
  /** 미리보기 칸 크기 (CSS 픽셀, 35:45) */
  const VIEW_W = 245;
  const VIEW_H = 315;

  interface Photo {
    name: string;
    /** 원본 (결과 파일용) */
    bitmap: ImageBitmap;
    /** 줄인 사진 (미리보기·얼굴 찾기용) */
    preview: ImageBitmap;
    width: number;
    height: number;
    thumb: Thumb;
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
  const totalBytes = FACE_FILES.reduce((sum, file) => sum + file.bytes, 0);

  type Find =
    | { kind: 'idle' }
    | { kind: 'finding' }
    | { kind: 'found'; face: Face; auto: Placement; faces: number }
    | { kind: 'none' }
    | { kind: 'failed' };
  let find = $state.raw<Find>({ kind: 'idle' });
  let placement = $state.raw<Placement>({ cx: 0, cy: 0, angle: 0, height: 1 });
  let saved = $state.raw<{ size: number } | undefined>();
  let finder: Promise<FaceFinder> | undefined;

  /** 받은 데이터로 얼굴 찾기 엔진을 띄운다 (엔진이 바이트를 넘겨받아 비운다) */
  function startFinder(bytes: Promise<Map<string, Uint8Array>>) {
    const started = bytes.then((value) => FaceFinder.create(value));
    started.catch(() => {
      if (finder === started) finder = undefined;
    });
    finder = started;
    return started;
  }

  onMount(() => {
    dataStatus(FACE_FILES, FACE_CONSENT).then((status) => {
      const lowSpace = status.available !== undefined && status.available < totalBytes * 2;
      data = FACE_FILES.every((file) => status.cached.has(file.path))
        ? { kind: 'ready' }
        : { kind: 'missing', removed: status.consented, lowSpace };
    });
    const off = onFrameFiles(([file]) => {
      if (file) open(file);
    });
    return () => {
      off();
      finder?.then((value) => value.dispose()).catch(() => {});
    };
  });

  async function downloadData() {
    data = { kind: 'downloading', percent: 0 };
    try {
      const bytes = await loadData(FACE_FILES, FACE_CONSENT, (received) => {
        data = {
          kind: 'downloading',
          percent: Math.min(99, Math.floor((received / totalBytes) * 100)),
        };
      });
      // 받은 바이트로 바로 띄운다. 보관소를 쓸 수 없는 창(시크릿 모드 등)에서 다시 받지 않게 한다
      startFinder(Promise.resolve(bytes));
      data = { kind: 'ready' };
    } catch {
      data = { kind: 'failed' };
    }
  }

  async function shrink(source: ImageBitmap, side: number) {
    const scale = Math.min(1, side / Math.max(source.width, source.height));
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    const bitmap = await createImageBitmap(source, {
      resizeWidth: width,
      resizeHeight: height,
      resizeQuality: 'high',
    });
    return { bitmap, scale };
  }

  async function open(file: File) {
    const ticket = ++generation;
    close(false);
    phase = 'opening';
    try {
      // 휴대폰 사진의 방향(EXIF)은 브라우저가 맞춰 읽는다
      const bitmap = await createImageBitmap(file);
      const preview = (await shrink(bitmap, PREVIEW_SIDE)).bitmap;
      const small = await shrink(bitmap, THUMB_SIDE);
      const canvas = new OffscreenCanvas(small.bitmap.width, small.bitmap.height);
      const context = canvas.getContext('2d', { willReadFrequently: true })!;
      context.drawImage(small.bitmap, 0, 0);
      small.bitmap.close();
      const thumb: Thumb = {
        data: context.getImageData(0, 0, canvas.width, canvas.height).data,
        width: canvas.width,
        height: canvas.height,
        scale: small.scale,
      };
      if (ticket !== generation) {
        bitmap.close();
        preview.close();
        return;
      }
      photo = {
        name: file.name,
        bitmap,
        preview,
        width: bitmap.width,
        height: bitmap.height,
        thumb,
      };
      placement = centerPlace(bitmap.width, bitmap.height);
      phase = 'ready';
      requestShowTool();
    } catch {
      if (ticket === generation) phase = 'error';
    }
  }

  function close(reset = true) {
    if (reset) generation++;
    photo?.bitmap.close();
    photo?.preview.close();
    photo = undefined;
    find = { kind: 'idle' };
    saved = undefined;
    phase = 'idle';
  }

  // 데이터가 준비돼 있으면 사진을 열자마자 얼굴을 찾는다
  $effect(() => {
    if (data.kind === 'ready' && photo) untrack(() => find.kind === 'idle' && analyze());
  });

  /** 얼굴 크기 (이마 꼭대기~턱 거리, 0~1 비율). 여럿이면 가장 큰 얼굴을 쓴다 */
  const faceSize = (points: Point[]) =>
    Math.hypot(points[152].x - points[10].x, points[152].y - points[10].y);

  async function analyze() {
    const current = photo;
    if (!current) return;
    const ticket = generation;
    find = { kind: 'finding' };
    try {
      const faces = await (
        await (finder ?? startFinder(loadData(FACE_FILES, FACE_CONSENT)))
      ).detect(await createImageBitmap(current.preview));
      if (ticket !== generation) return;
      if (faces.length === 0) {
        find = { kind: 'none' };
        return;
      }
      const points = faces.reduce((a, b) => (faceSize(b) > faceSize(a) ? b : a));
      const face = readFace(points, current.width, current.height, current.thumb);
      const auto = autoPlace(face);
      placement = auto;
      saved = undefined;
      find = { kind: 'found', face, auto, faces: faces.length };
    } catch {
      if (ticket === generation) find = { kind: 'failed' };
    }
  }

  // 미리보기 그리기
  let canvas: HTMLCanvasElement | undefined = $state();
  $effect(() => {
    if (!canvas || !photo) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(VIEW_W * ratio);
    canvas.height = Math.round(VIEW_H * ratio);
    const k = photo.preview.width / photo.width;
    drawCrop(
      canvas.getContext('2d')!,
      photo.preview,
      {
        cx: placement.cx * k,
        cy: placement.cy * k,
        angle: placement.angle,
        height: placement.height * k,
      },
      canvas.width,
      canvas.height,
    );
  });

  function update(next: Placement) {
    placement = next;
    saved = undefined;
  }

  /** 사진을 칸 안에서 옮긴다 (dx, dy: 칸 높이에 대한 비율, 오른쪽·아래가 +) */
  function move(dx: number, dy: number) {
    const { angle, height } = placement;
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    // 사진이 오른쪽으로 가면 칸은 사진 위에서 왼쪽으로 간다
    const du = -dx * height;
    const dv = -dy * height;
    update({
      ...placement,
      cx: placement.cx + du * ux - dv * uy,
      cy: placement.cy + du * uy + dv * ux,
    });
  }
  /** 사진을 키운다 (factor > 1이면 얼굴이 커진다) */
  function zoom(factor: number) {
    const limit = Math.max(photo?.width ?? 1, photo?.height ?? 1) * 3;
    update({ ...placement, height: Math.min(limit, Math.max(16, placement.height / factor)) });
  }
  /** 사진을 돌린다 (degrees > 0이면 시계 반대 방향) */
  function rotate(degrees: number) {
    update({ ...placement, angle: placement.angle + (degrees * Math.PI) / 180 });
  }

  function reset() {
    if (find.kind === 'found') update(find.auto);
    else if (photo) update(centerPlace(photo.width, photo.height));
  }

  function onkeydown(event: KeyboardEvent) {
    const step = event.shiftKey ? 0.05 : 0.01;
    const actions: Record<string, () => void> = {
      ArrowLeft: () => move(-step, 0),
      ArrowRight: () => move(step, 0),
      ArrowUp: () => move(0, -step),
      ArrowDown: () => move(0, step),
      '+': () => zoom(1.02),
      '=': () => zoom(1.02),
      '-': () => zoom(1 / 1.02),
      '[': () => rotate(0.5),
      ']': () => rotate(-0.5),
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  }

  let dragging: { x: number; y: number } | undefined;
  function onpointerdown(event: PointerEvent) {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    dragging = { x: event.clientX, y: event.clientY };
  }
  function onpointermove(event: PointerEvent) {
    if (!dragging) return;
    move((event.clientX - dragging.x) / VIEW_H, (event.clientY - dragging.y) / VIEW_H);
    dragging = { x: event.clientX, y: event.clientY };
  }
  function onpointerup() {
    dragging = undefined;
  }

  const head = $derived(find.kind === 'found' ? headLength(find.face, placement) : undefined);
  const degrees = $derived(((placement.angle * 180) / Math.PI).toFixed(1).replace('-0.0', '0.0'));
  const checks = $derived.by(() => {
    if (!photo) return [];
    const list: string[] = [];
    if (find.kind === 'found') {
      if (find.faces > 1) list.push(t.checkTwoFaces);
      if (Math.abs(find.face.turn) > 0.15) list.push(t.checkTurned);
      if (!find.face.crownFound) list.push(t.checkCrown);
      if (head !== undefined && (head < SPEC.headMinMm || head > SPEC.headMaxMm)) {
        list.push(t.checkHead);
      }
    }
    if (!whiteBackground(photo.thumb)) list.push(t.checkBackground);
    if (placement.height < SPEC.outHeight) list.push(t.checkSmall);
    if (outside(placement, photo.width, photo.height)) list.push(t.checkOutside);
    return list;
  });

  async function save() {
    const current = photo;
    if (!current || find.kind === 'finding') return;
    const entitlement = await canUse('image/id-photo');
    if (!entitlement.allowed) return;
    const blob = await exportJpeg(current.bitmap, placement);
    if (current !== photo) return;
    downloadFile(
      new Uint8Array(await blob.arrayBuffer()),
      `${baseName(current.name)}_${t.suffix}.jpg`,
      'image/jpeg',
    );
    saved = { size: blob.size };
  }

  const guideTop = `${(SPEC.topMm / SPEC.heightMm) * 100}%`;
  const chinTop = `${((SPEC.topMm + SPEC.headMinMm) / SPEC.heightMm) * 100}%`;
  const chinHeight = `${((SPEC.headMaxMm - SPEC.headMinMm) / SPEC.heightMm) * 100}%`;
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
        {#if saved}
          {t.saved(formatSize(saved.size))}
        {:else if find.kind === 'finding'}
          {t.finding}
        {:else if find.kind === 'found'}
          {t.found}
        {:else if find.kind === 'none'}
          {t.noFace}
        {:else if find.kind === 'failed'}
          {t.findFailed}
        {:else}
          {t.manualReady}
        {/if}
      {/snippet}
      <button type="button" class="btn primary" disabled={find.kind === 'finding'} onclick={save}
        >{t.download}</button
      >
    </ActionBar>

    <div class="tool-body">
      <div class="layout">
        <div class="stage">
          <!-- 끌기·방향키로 사진을 옮기는 칸 (같은 일을 하는 버튼도 옆에 있다) -->
          <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
          <div
            class="view"
            role="application"
            tabindex="0"
            aria-label={t.preview}
            aria-describedby="view-help"
            {onkeydown}
            {onpointerdown}
            {onpointermove}
            {onpointerup}
            onpointercancel={onpointerup}
          >
            <canvas bind:this={canvas}></canvas>
            <span class="guide top" style:top={guideTop}></span>
            <span class="guide chin" style:top={chinTop} style:height={chinHeight}></span>
            <span class="guide center"></span>
          </div>
          <ul class="legend">
            <li><span class="key top"></span>{t.guideTop}</li>
            <li><span class="key chin"></span>{t.guideChin}</li>
          </ul>
          {#if head !== undefined}
            <p class="measure">{t.head((head / 10).toFixed(1))} <span>{t.headRange}</span></p>
          {/if}
          <p class="help" id="view-help">{t.previewHelp}</p>
        </div>

        <div class="panel">
          {#if data.kind !== 'ready'}
            <section class="data" aria-label={t.dataTitle}>
              {#if data.kind === 'checking'}
                <p>{t.checking}</p>
              {:else}
                <h2>{t.dataTitle}</h2>
                {#if data.kind === 'missing' && data.removed}
                  <p><strong>{t.dataRemoved}</strong></p>
                {/if}
                <p>{t.dataSize(formatSize(totalBytes))}</p>
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
                    : t.getData(formatSize(totalBytes))}</button
                >
              {/if}
            </section>
          {/if}

          <section class="adjust" aria-label={t.adjust}>
            <div class="row">
              <button type="button" class="btn" onclick={() => zoom(1 / 1.02)}>{t.smaller}</button>
              <button type="button" class="btn" onclick={() => zoom(1.02)}>{t.bigger}</button>
            </div>
            <div class="row">
              <button type="button" class="btn" onclick={() => move(0, -0.01)}>{t.up}</button>
              <button type="button" class="btn" onclick={() => move(0, 0.01)}>{t.down}</button>
              <button type="button" class="btn" onclick={() => move(-0.01, 0)}>{t.left}</button>
              <button type="button" class="btn" onclick={() => move(0.01, 0)}>{t.right}</button>
            </div>
            <div class="row">
              <button type="button" class="btn" onclick={() => rotate(0.5)}>{t.rotateLeft}</button>
              <button type="button" class="btn" onclick={() => rotate(-0.5)}>{t.rotateRight}</button
              >
              <span class="angle">{t.angle(degrees)}</span>
            </div>
            <div class="row">
              <button type="button" class="btn" onclick={reset}
                >{find.kind === 'found' ? t.reset : t.resetManual}</button
              >
            </div>
          </section>

          <section class="checks" aria-label={t.checksTitle}>
            <h2>{t.checksTitle}</h2>
            {#if checks.length > 0}
              <ul>
                {#each checks as check (check)}
                  <li>{check}</li>
                {/each}
              </ul>
            {/if}
            <p class="help">{t.checksNote}</p>
          </section>
        </div>
      </div>
    </div>
  {:else if phase === 'opening'}
    <p class="status" role="status">{t.opening}</p>
  {:else}
    {#if phase === 'error'}
      <p class="error banner" role="alert">{t.cannotOpen}</p>
    {/if}
    <div class="drop">
      <FileDrop
        accept="image/*"
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
    flex: none;
    width: 245px;
  }
  .panel {
    flex: 1;
    min-width: 260px;
  }
  .view {
    position: relative;
    width: 245px;
    height: 315px;
    border: 1px solid var(--color-line);
    cursor: grab;
    touch-action: none;
    user-select: none;
  }
  .view:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
  .view canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
  .guide {
    position: absolute;
    left: 0;
    right: 0;
    pointer-events: none;
  }
  .guide.top {
    border-top: 1.5px dashed var(--color-accent);
  }
  .guide.chin {
    background: color-mix(in srgb, var(--color-accent) 22%, transparent);
    border-top: 1px solid var(--color-accent);
    border-bottom: 1px solid var(--color-accent);
  }
  .guide.center {
    top: 0;
    bottom: 0;
    left: 50%;
    right: auto;
    border-left: 1px dashed color-mix(in srgb, var(--color-accent) 70%, transparent);
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
    margin: 8px 0 0;
    padding: 0;
    list-style: none;
    font-size: 13px;
    color: var(--color-muted);
  }
  .legend li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .key {
    display: inline-block;
    width: 16px;
    height: 8px;
  }
  .key.top {
    height: 0;
    border-top: 1.5px dashed var(--color-accent);
  }
  .key.chin {
    background: color-mix(in srgb, var(--color-accent) 22%, transparent);
    border: 1px solid var(--color-accent);
  }
  .measure {
    margin: 8px 0 0;
    font-size: 14px;
    font-weight: 600;
  }
  .measure span {
    color: var(--color-muted);
    font-weight: 400;
  }
  .help {
    margin: 8px 0 0;
    font-size: 13px;
    color: var(--color-muted);
  }
  .data,
  .checks {
    margin-bottom: 16px;
    padding: 16px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius);
  }
  .data h2,
  .checks h2 {
    margin: 0 0 8px;
    font-size: 15px;
  }
  .data p {
    margin: 0 0 8px;
    font-size: 14px;
  }
  .checks ul {
    margin: 0;
    padding-left: 18px;
    font-size: 14px;
  }
  .checks li + li {
    margin-top: 4px;
  }
  .adjust {
    margin-bottom: 16px;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  .angle {
    font-size: 13px;
    color: var(--color-muted);
  }
</style>
