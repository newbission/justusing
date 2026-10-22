<!--
  이미지 이어 붙이기 도구 화면 (격리 frame 안에서 실행).
  넣은 이미지를 목록 순서대로 세로나 가로로 이어 한 장(또는 나눈 여러 장, PDF)으로 만든다.
  세로로 이을 때는 화면 캡처의 겹친 부분과 고정 막대를 찾아 이음마다 잘라 낼 줄을 채우고, 사용자가 고칠 수 있다.
  미리보기는 줄인 사진으로 화면에서 그리고, 실제 결과는 워커가 원래 크기로 그린다. 파일은 어디로도 전송되지 않는다.
-->
<script lang="ts">
  import '../../../frame/controls.css';
  import { onMount, tick } from 'svelte';
  import { flip } from 'svelte/animate';
  import { pick } from '../../../frame/locale';
  import { FRAME_MESSAGES } from '../../../frame/messages';
  import { MESSAGES, type Format, type SizeMode } from './messages';
  import ActionBar from '../../../frame/ActionBar.svelte';
  import FileDrop from '../../../frame/FileDrop.svelte';
  import { onFrameFiles } from '../../../frame/drop';
  import { requestShowTool } from '../../../frame/parent';
  import { downloadFile } from '../../../frame/download';
  import { baseName, formatSize } from '../../../frame/format';
  import { canUse } from '../../../lib/entitlement';
  import { ImageBatch, type BatchItem } from '../../../lib/image/batch.svelte';
  import {
    findSeam,
    forgetSeams,
    stitchImages,
    StitchError,
    STITCH_TYPES,
    type Background,
    type StitchFormat,
  } from '../../../lib/image/stitch';
  import {
    layoutStitch,
    NO_SEAM,
    type Direction,
    type Seam,
  } from '../../../lib/image/stitch-layout';
  import { imagesToPdf } from '../../../lib/pdf/images-to-pdf';
  import { makeZip } from '../../../lib/zip';

  const common = pick(FRAME_MESSAGES);
  const t = pick(MESSAGES);

  const DIRECTIONS: Direction[] = ['vertical', 'horizontal'];
  const SIZE_MODES: SizeMode[] = ['narrow', 'wide', 'custom'];
  const BACKGROUNDS: Background[] = ['white', 'black', 'transparent'];
  const FORMATS: Format[] = ['jpg', 'png', 'webp', 'pdf'];
  /** JPG·WebP 화질. 글자가 많은 캡처라 눈에 띄는 손실이 없게 높게 둔다 */
  const QUALITY = 0.92;
  /** 한 장의 가장 긴 변: JPG는 canvas 한계, WebP는 형식 한계 */
  const MAX_SIDE: Record<Format, number> = {
    jpg: 32_767,
    png: Infinity,
    webp: 16_383,
    pdf: 32_767,
  };
  /** PNG도 이보다 크면 메모리가 모자랄 수 있어 받지 않는다 */
  const MAX_PIXELS = 400_000_000;
  /**
   * 결과 폭. 줄 묶음씩 그려도 canvas 폭은 결과 전체 폭이라 브라우저의 canvas 한 변 한계에 묶인다
   * (PNG·나누기로도 피할 수 없다). 여러 브라우저가 확실히 그리는 값으로 둔다
   */
  const MAX_WIDTH = 16_384;
  /** 미리보기용으로 줄인 사진의 짧은 변 */
  const PREVIEW_SIDE = 600;

  type Detection = { state: 'working' } | { state: 'done'; seam?: Seam } | { state: 'skip' };
  type Outcome =
    | { state: 'done'; files: { name: string; bytes: Uint8Array }[]; type: string; zip: string }
    | { state: 'failed'; message: string };

  const batch = new ImageBatch({ anyFormat: true });
  let direction: Direction = $state('vertical');
  let auto = $state(true);
  let sizeMode: SizeMode = $state('narrow');
  let customSize: number | null = $state(null);
  let gap: number | null = $state(0);
  let background: Background = $state('white');
  let format: Format = $state('jpg');
  let split = $state(false);
  let splitHeight: number | null = $state(3000);
  let working = $state(false);
  let outcome: (Outcome & { settings: string }) | undefined = $state();
  /** 이음(앞 사진 id-뒤 사진 id)마다 자동으로 찾은 값과 사용자가 고친 값 */
  let detections: Record<string, Detection> = $state({});
  let manual: Record<string, Seam> = $state({});
  /** 미리보기용으로 줄인 사진 */
  let previews: Record<number, ImageBitmap> = $state({});

  const vertical = $derived(direction === 'vertical');
  const ready = $derived(batch.ready);
  const pairs = $derived(
    ready.slice(1).map((b, i) => {
      const a = ready[i]!;
      return { a, b, key: `${a.id}-${b.id}` };
    }),
  );

  function seamOf(key: string): Seam {
    if (manual[key]) return manual[key];
    const detection = detections[key];
    return auto && detection?.state === 'done' ? (detection.seam ?? NO_SEAM) : NO_SEAM;
  }

  // 세로로 이을 때 이음마다 겹친 부분을 찾는다 (워커에서, 한 번에 하나씩)
  $effect(() => {
    if (!vertical || !auto) return;
    for (const { a, b, key } of pairs) {
      if (detections[key]) continue;
      if (a.width !== b.width) {
        detections[key] = { state: 'skip' };
        continue;
      }
      detections[key] = { state: 'working' };
      findSeam({ key: a.id, file: a.file }, { key: b.id, file: b.file }).then(
        (seam) => (detections[key] = { state: 'done', seam }),
        () => (detections[key] = { state: 'done' }),
      );
    }
  });

  /** 미리보기 사진을 만들기 시작한 사진 (만드는 동안 effect가 다시 돌아도 두 번 만들지 않게) */
  const requested = new Set<number>();

  // 미리보기용으로 줄인 사진을 만든다
  $effect(() => {
    for (const item of ready) {
      if (requested.has(item.id)) continue;
      requested.add(item.id);
      previewOf(item).then(
        (bitmap) => {
          if (batch.items.includes(item)) previews[item.id] = bitmap;
          else bitmap.close();
        },
        () => undefined,
      );
    }
  });

  /**
   * 바로 세운 뒤 줄인 사진. 바로 세우기와 줄이기를 한 번에 시키면 브라우저에 따라 줄이는 크기를 세우기 전
   * 가로·세로로 보고 찌그러뜨릴 수 있어 두 번에 나눈다
   */
  async function previewOf(item: BatchItem): Promise<ImageBitmap> {
    const upright = await createImageBitmap(item.file, { imageOrientation: 'from-image' });
    try {
      const scale = Math.min(1, PREVIEW_SIDE / Math.min(upright.width, upright.height));
      return await createImageBitmap(upright, {
        resizeWidth: Math.max(1, Math.round(upright.width * scale)),
        resizeHeight: Math.max(1, Math.round(upright.height * scale)),
        resizeQuality: 'medium',
      });
    } finally {
      upright.close();
    }
  }

  const positive = (value: number | null, max: number, min = 1) =>
    value !== null && Number.isFinite(value) && value >= min && value <= max
      ? Math.round(value)
      : undefined;

  /** 맞출 폭(세로) 또는 높이(가로) */
  const size = $derived.by(() => {
    if (ready.length === 0) return undefined;
    if (sizeMode === 'custom') return positive(customSize, 20_000);
    const sides = ready.map((item) => (vertical ? item.width : item.height));
    return sizeMode === 'narrow' ? Math.min(...sides) : Math.max(...sides);
  });
  const gapValue = $derived(positive(gap, 500, 0));
  const seams = $derived(vertical ? pairs.map(({ key }) => seamOf(key)) : []);
  const layout = $derived(
    size === undefined || gapValue === undefined
      ? undefined
      : layoutStitch(ready, { direction, size, gap: gapValue, seams }),
  );
  /** 늘려서 붙이는 사진 수 */
  const enlarged = $derived(
    size === undefined
      ? 0
      : ready.filter((item) => (vertical ? item.width : item.height) < size).length,
  );
  const splitValue = $derived(positive(splitHeight, 30_000, 100));
  /** 나눌 높이 (PDF는 A4 비율 쪽) */
  const chunk = $derived.by(() => {
    if (!vertical || !layout) return undefined;
    if (format === 'pdf') return Math.round((layout.width * 297) / 210);
    return split ? splitValue : undefined;
  });
  const detecting = $derived(
    vertical && auto && pairs.some(({ key }) => detections[key]?.state === 'working'),
  );

  const blocker = $derived.by(() => {
    if (batch.loading) return t.reading;
    if (ready.length < 2) return t.needTwo;
    if (size === undefined) return t.invalidSize;
    if (gapValue === undefined) return t.invalidGap;
    if (vertical && split && format !== 'pdf' && splitValue === undefined) return t.invalidSplit;
    if (detecting) return t.detecting;
    if (!layout) return t.badCut;
    if (layout.width > MAX_WIDTH) return t.tooWide(MAX_WIDTH, vertical);
    const tall = chunk ?? layout.height;
    if (layout.width > MAX_SIDE[format] || tall > MAX_SIDE[format]) {
      return t.tooLong(t.formats[format], MAX_SIDE[format]);
    }
    if (layout.width * layout.height > MAX_PIXELS) return t.tooBig;
    return undefined;
  });

  /** 설정이 바뀌면 이전 결과는 더 이상 맞지 않는다 */
  const settings = $derived(
    JSON.stringify([ready.map((item) => item.id), layout, background, format, chunk]),
  );
  const current = $derived(outcome?.settings === settings ? outcome : undefined);
  const done = $derived(current?.state === 'done' ? current : undefined);

  async function run() {
    if (blocker || working || !layout) return;
    const entitlement = await canUse('image/stitch');
    if (!entitlement.allowed) return;
    const startedWith = settings;
    const sources = ready;
    const pdf = format === 'pdf';
    // PDF 쪽은 JPG로 만들어 넣는다
    const saveAs: StitchFormat = format === 'pdf' ? 'jpg' : format;
    const base = `${baseName(sources[0]!.name)}_${t.suffix}`;
    working = true;
    try {
      const parts = await stitchImages({
        files: sources.map((item) => item.file),
        layout,
        // JPG에는 투명이 없다
        background: saveAs === 'jpg' && background === 'transparent' ? 'white' : background,
        format: saveAs,
        quality: QUALITY,
        chunk,
      });
      if (pdf) {
        let bytes: Uint8Array;
        try {
          bytes = await imagesToPdf({
            images: parts.map((part) => new Blob([part as BlobPart], { type: 'image/jpeg' })),
            size: 'fit',
            margin: 0,
          });
        } catch {
          outcome = { state: 'failed', message: t.pdfFailed, settings: startedWith };
          return;
        }
        outcome = {
          state: 'done',
          files: [{ name: `${base}.pdf`, bytes }],
          type: 'application/pdf',
          zip: `${base}.zip`,
          settings: startedWith,
        };
      } else {
        outcome = {
          state: 'done',
          files:
            parts.length === 1
              ? [{ name: `${base}.${saveAs}`, bytes: parts[0]! }]
              : parts.map((bytes, i) => ({ name: `${base}_${i + 1}.${saveAs}`, bytes })),
          type: STITCH_TYPES[saveAs],
          zip: `${base}.zip`,
          settings: startedWith,
        };
      }
    } catch (error) {
      const reason = error instanceof StitchError ? error.reason : 'tooLarge';
      outcome = { state: 'failed', message: t.failed[reason], settings: startedWith };
    } finally {
      working = false;
    }
  }

  async function download() {
    if (!done) return;
    if (done.files.length === 1) {
      const [file] = done.files;
      downloadFile(file!.bytes, file!.name, done.type);
      return;
    }
    // makeZip은 받은 바이트를 비우므로 복사본을 넘긴다 (다시 받을 수 있게)
    const zip = await makeZip(
      done.files.map(({ name, bytes }) => ({ name, bytes: bytes.slice() })),
    );
    downloadFile(zip, done.zip, 'application/zip');
  }

  function add(files: File[]) {
    if (working) return;
    const first = batch.items.length === 0;
    if (batch.add(files) && first) requestShowTool();
  }

  function remove(item: BatchItem) {
    batch.remove(item);
    forgetSeams([item.id]);
    previews[item.id]?.close();
    delete previews[item.id];
  }

  /** 한 칸 위(-1)나 아래(1)로 옮긴다 */
  async function move(item: BatchItem, delta: -1 | 1) {
    const items = batch.items;
    const from = items.indexOf(item);
    const to = from + delta;
    if (to < 0 || to >= items.length) return;
    items.splice(to, 0, ...items.splice(from, 1));
    // 줄이 옮겨지면 브라우저가 버튼 포커스를 놓치므로 같은 버튼에 다시 맞춘다
    await tick();
    const row = document.querySelector(`[data-item="${item.id}"]`);
    const same = row?.querySelector<HTMLButtonElement>(`[data-move="${delta}"]`);
    const other = row?.querySelector<HTMLButtonElement>(`[data-move="${-delta}"]`);
    (same && !same.disabled ? same : other)?.focus();
  }

  function setSeam(key: string, side: keyof Seam, value: string) {
    const number = Math.max(0, Math.round(Number(value)) || 0);
    manual[key] = { ...seamOf(key), [side]: number };
  }

  function chooseFormat(next: Format) {
    format = next;
    // JPG·PDF에는 투명이 없다
    if ((next === 'jpg' || next === 'pdf') && background === 'transparent') background = 'white';
  }

  function chooseDirection(next: Direction) {
    direction = next;
    // PDF는 세로로 이은 결과를 쪽으로 나눈다
    if (next === 'horizontal' && format === 'pdf') format = 'jpg';
  }

  function seamState(key: string): string {
    if (manual[key]) return t.seamManual;
    const detection = detections[key];
    if (!auto || !detection) return '';
    if (detection.state === 'working') return t.seamFinding;
    if (detection.state === 'skip') return t.seamWidth;
    return detection.seam ? t.seamFound : t.seamNone;
  }

  // 미리보기 그리기 (줄인 사진으로)
  let canvas: HTMLCanvasElement | undefined = $state();
  /** 미리보기 칸의 안쪽 폭 (여백 빼고) */
  let previewWidth = $state(0);
  const view = $derived.by(() => {
    if (!layout || previewWidth <= 0) return undefined;
    const scale = Math.min(previewWidth / layout.width, 1);
    const width = Math.max(1, Math.round(layout.width * scale));
    const height = Math.max(1, Math.round(layout.height * scale));
    // 아주 긴 결과는 화면 밀도를 낮춰 canvas 한계 안에 둔다
    const density = Math.max(0.1, Math.min(devicePixelRatio || 1, 16_000 / height));
    return { scale, width, height, density };
  });
  $effect(() => {
    if (!canvas || !layout || !view) return;
    const { scale, density } = view;
    canvas.width = Math.round(view.width * density);
    canvas.height = Math.round(view.height * density);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const k = scale * density;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (background !== 'transparent' || format === 'jpg' || format === 'pdf') {
      ctx.fillStyle = background === 'black' ? '#000' : '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.imageSmoothingQuality = 'high';
    for (const piece of layout.pieces) {
      const item = ready[piece.index];
      const bitmap = item && previews[item.id];
      if (!bitmap) continue;
      const s = bitmap.width / item.width;
      ctx.drawImage(
        bitmap,
        piece.sx * s,
        piece.sy * s,
        piece.sw * s,
        piece.sh * s,
        piece.dx * k,
        piece.dy * k,
        piece.dw * k,
        piece.dh * k,
      );
    }
    // 이음 자리를 양쪽 가장자리에 짧게 표시한다
    ctx.fillStyle = getComputedStyle(canvas).getPropertyValue('--color-accent').trim() || '#000';
    for (const piece of layout.pieces.slice(1)) {
      if (vertical) {
        const y = Math.round(piece.dy * k);
        ctx.fillRect(0, y - 1, 10 * density, 3);
        ctx.fillRect(canvas.width - 10 * density, y - 1, 10 * density, 3);
      } else {
        const x = Math.round(piece.dx * k);
        ctx.fillRect(x - 1, 0, 3, 10 * density);
        ctx.fillRect(x - 1, canvas.height - 10 * density, 3, 10 * density);
      }
    }
  });

  onMount(() => {
    const off = onFrameFiles(add);
    return () => {
      off();
      for (const bitmap of Object.values(previews)) bitmap.close();
    };
  });
</script>

<div class="tool">
  {#if batch.items.length === 0}
    <div class="drop">
      <FileDrop
        accept={batch.accept}
        label={common.images.choose}
        multiple
        hint={t.hint}
        onfiles={add}
      />
    </div>
  {:else}
    <div class="summary">
      <span aria-live="polite"
        >{common.images.summary(batch.items.length, formatSize(batch.totalSize))}</span
      >
      <label class="btn" class:disabled={working}>
        {common.images.add}
        <input
          type="file"
          class="visually-hidden"
          accept={batch.accept}
          multiple
          disabled={working}
          onchange={(event) => {
            add([...(event.currentTarget.files ?? [])]);
            event.currentTarget.value = '';
          }}
        />
      </label>
    </div>

    <!-- 모바일 하단 고정 광고와 멀도록 목록 위에 둔다 -->
    <ActionBar label={t.bar}>
      {#snippet text()}
        {#if working}
          {t.working}
        {:else if done}
          {@const total = done.files.reduce((sum, file) => sum + file.bytes.length, 0)}
          {done.files.length === 1
            ? common.action.done(done.files[0]!.name, formatSize(total))
            : t.doneParts(done.files.length, formatSize(total))}
        {:else if current?.state === 'failed'}
          <strong>{current.message}</strong>
        {:else}
          {blocker ?? (layout ? t.ready(layout.width, layout.height) : '')}
        {/if}
      {/snippet}
      {#if done}
        <button type="button" class="btn primary" onclick={download}
          >{done.files.length === 1
            ? common.action.download
            : t.downloadAll(done.files.length)}</button
        >
      {:else}
        <button
          type="button"
          class="btn primary"
          disabled={blocker !== undefined || working}
          onclick={run}>{working ? t.working : t.run}</button
        >
      {/if}
    </ActionBar>

    <div class="body">
      <div class="side">
        <div class="options">
          <div class="choices">
            <div class="choice" role="radiogroup" aria-label={t.directionGroup}>
              {#each DIRECTIONS as value (value)}
                <label class:checked={direction === value}>
                  <input
                    type="radio"
                    name="direction"
                    {value}
                    checked={direction === value}
                    disabled={working}
                    onchange={() => chooseDirection(value)}
                  />
                  {t.directions[value]}
                </label>
              {/each}
            </div>
          </div>

          {#if vertical}
            <label class="check">
              <input type="checkbox" bind:checked={auto} disabled={working} />
              {t.auto}
            </label>
            <p class="help">{t.autoHelp}</p>
          {/if}

          <p class="group-name">{t.sizeGroup[direction]}</p>
          <div class="choices">
            <div class="choice" role="radiogroup" aria-label={t.sizeGroup[direction]}>
              {#each SIZE_MODES as value (value)}
                <label class:checked={sizeMode === value}>
                  <input
                    type="radio"
                    name="size"
                    {value}
                    bind:group={sizeMode}
                    disabled={working}
                  />
                  {t.sizes[direction][value]}
                </label>
              {/each}
            </div>
          </div>
          {#if sizeMode === 'custom'}
            <label class="field">
              {t.customSize[direction]}
              <input
                type="number"
                min="1"
                max="20000"
                inputmode="numeric"
                bind:value={customSize}
                disabled={working}
                aria-invalid={size === undefined}
              />
            </label>
          {/if}
          {#if enlarged > 0}
            <p class="problem">{t.upscale(enlarged)}</p>
          {/if}

          <div class="row-fields">
            <label class="field">
              {t.gap}
              <input
                type="number"
                min="0"
                max="500"
                inputmode="numeric"
                bind:value={gap}
                disabled={working}
                aria-invalid={gapValue === undefined}
              />
            </label>
          </div>

          <p class="group-name">{t.backgroundGroup}</p>
          <div class="choices">
            <div class="choice" role="radiogroup" aria-label={t.backgroundGroup}>
              {#each BACKGROUNDS as value (value)}
                {#if value !== 'transparent' || format === 'png' || format === 'webp'}
                  <label class:checked={background === value}>
                    <input
                      type="radio"
                      name="background"
                      {value}
                      bind:group={background}
                      disabled={working}
                    />
                    {t.backgrounds[value]}
                  </label>
                {/if}
              {/each}
            </div>
          </div>

          <p class="group-name">{t.formatGroup}</p>
          <div class="choices">
            <div class="choice" role="radiogroup" aria-label={t.formatGroup}>
              {#each FORMATS as value (value)}
                {#if value !== 'pdf' || vertical}
                  <label class:checked={format === value}>
                    <input
                      type="radio"
                      name="format"
                      {value}
                      checked={format === value}
                      disabled={working}
                      onchange={() => chooseFormat(value)}
                    />
                    {t.formats[value]}
                  </label>
                {/if}
              {/each}
            </div>
          </div>
          <p class="help">{t.formatHelp[format]}</p>

          {#if vertical && format !== 'pdf'}
            <label class="check">
              <input type="checkbox" bind:checked={split} disabled={working} />
              {t.split}
            </label>
            {#if split}
              <label class="field">
                {t.splitHeight}
                <input
                  type="number"
                  min="100"
                  max="30000"
                  inputmode="numeric"
                  bind:value={splitHeight}
                  disabled={working}
                  aria-invalid={splitValue === undefined}
                />
              </label>
              <p class="help">{t.splitHelp}</p>
            {/if}
          {/if}
        </div>

        <ol class="list" aria-label={t.list}>
          {#each batch.items as item, index (item.id)}
            {@const pair = pairs.find((p) => p.a === item)}
            <li class="item" data-item={item.id} animate:flip={{ duration: 200 }}>
              <div class="row">
                <div class="thumb">
                  {#if item.thumb}
                    <img src={item.thumb} alt="" />
                  {/if}
                </div>
                <div class="info">
                  <span class="name" title={item.name}>{item.name}</span>
                  <span class="meta">
                    {#if item.status === 'loading'}
                      {common.images.reading}
                    {:else if item.status === 'error'}
                      <strong>{t.broken}</strong>
                    {:else}
                      {t.itemSize(item.width, item.height)}
                    {/if}
                  </span>
                </div>
                <button
                  type="button"
                  class="btn icon"
                  data-move="-1"
                  disabled={index === 0 || working}
                  onclick={() => move(item, -1)}
                  aria-label={t.up(item.name)}>↑</button
                >
                <button
                  type="button"
                  class="btn icon"
                  data-move="1"
                  disabled={index === batch.items.length - 1 || working}
                  onclick={() => move(item, 1)}
                  aria-label={t.down(item.name)}>↓</button
                >
                <button
                  type="button"
                  class="btn icon"
                  disabled={working}
                  onclick={() => remove(item)}
                  aria-label={t.remove(item.name)}>×</button
                >
              </div>
              {#if vertical && pair}
                {@const seam = seamOf(pair.key)}
                {@const n = ready.indexOf(item) + 1}
                <div class="seam" role="group" aria-label={t.seam(n)}>
                  <span class="seam-state">{seamState(pair.key)}</span>
                  <label>
                    {t.seamBottom}
                    <input
                      type="number"
                      min="0"
                      inputmode="numeric"
                      value={seam.bottom}
                      disabled={working}
                      oninput={(event) => setSeam(pair.key, 'bottom', event.currentTarget.value)}
                    />
                  </label>
                  <label>
                    {t.seamTop}
                    <input
                      type="number"
                      min="0"
                      inputmode="numeric"
                      value={seam.top}
                      disabled={working}
                      oninput={(event) => setSeam(pair.key, 'top', event.currentTarget.value)}
                    />
                  </label>
                  <span class="seam-unit">{t.seamUnit}</span>
                  {#if manual[pair.key]}
                    <button
                      type="button"
                      class="btn"
                      disabled={working}
                      onclick={() => delete manual[pair.key]}>{t.seamReset}</button
                    >
                  {/if}
                </div>
              {/if}
            </li>
          {/each}
        </ol>
      </div>

      <section class="preview" aria-label={t.preview}>
        <div class="preview-inner" bind:clientWidth={previewWidth}></div>
        {#if layout && view}
          <div role="img" aria-label={t.previewLabel(layout.width, layout.height)}>
            <canvas
              bind:this={canvas}
              style:width="{view.width}px"
              style:height="{view.height}px"
              class:transparent={background === 'transparent'}
            ></canvas>
          </div>
        {/if}
      </section>
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
  .drop {
    flex: 1;
    padding: 16px;
  }
  .summary {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: space-between;
    height: 48px;
    padding: 0 16px;
    border-bottom: 1px solid var(--color-line);
    font-size: 14px;
  }
  label.disabled {
    opacity: 0.4;
    cursor: default;
  }
  .body {
    display: grid;
    flex: 1;
    grid-template-columns: minmax(0, 1fr) minmax(200px, 38%);
    min-height: 0;
  }
  .side {
    overflow: auto;
  }
  .options {
    padding: 12px 16px 0;
    border-bottom: 1px solid var(--color-line);
  }
  .group-name {
    margin: 0 0 8px;
    font-size: 14px;
    font-weight: 600;
  }
  .check {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 6px;
    font-size: 14px;
    cursor: pointer;
  }
  .check input {
    margin-top: 3px;
  }
  .preview {
    padding: 12px;
    overflow: auto;
    border-left: 1px solid var(--color-line);
    background: var(--color-bg);
  }
  /* 폭만 재는 빈 칸 */
  .preview-inner {
    height: 0;
  }
  .preview canvas {
    display: block;
    margin: 0 auto;
    box-shadow: var(--shadow-page);
  }
  /* 투명한 결과는 바둑판 위에 보여 준다 */
  .preview canvas.transparent {
    background: repeating-conic-gradient(var(--color-line) 0 25%, transparent 0 50%) 0 0 / 16px 16px;
  }

  .list {
    margin: 0;
    padding: 8px;
    list-style: none;
  }
  .item + .item {
    border-top: 1px solid var(--color-line);
  }
  /* 줄 높이 고정: 읽는 동안·읽은 뒤에 목록이 흔들리지 않게 */
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 72px;
    padding: 0 8px;
  }
  .thumb {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
  }
  .thumb img {
    max-width: 100%;
    max-height: 100%;
    box-shadow: var(--shadow-page);
  }
  .info {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .name {
    overflow: hidden;
    font-size: 15px;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .meta {
    overflow: hidden;
    color: var(--color-muted);
    font-size: 13px;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .meta strong {
    color: var(--color-text);
  }
  .row :global(.btn.icon) {
    font-size: 18px;
    line-height: 1;
  }
  /* 이음: 위아래 사진 사이에서 잘라 낼 줄 */
  .seam {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 12px;
    margin: 0 8px 8px 72px;
    padding: 8px 12px;
    border-left: 3px solid var(--color-accent);
    border-radius: var(--radius);
    background: var(--color-hover);
    font-size: 13px;
  }
  .seam-state {
    flex-basis: 100%;
    color: var(--color-muted);
  }
  .seam-state:empty {
    display: none;
  }
  .seam label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .seam input {
    width: 76px;
    height: 30px;
    padding: 0 8px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius);
    background: var(--color-bg);
    font-size: 14px;
  }
  .seam-unit {
    color: var(--color-muted);
  }

  @media (max-width: 720px) {
    .body {
      display: block;
      overflow: auto;
    }
    .side {
      overflow: visible;
    }
    .preview {
      max-height: 480px;
      border-top: 1px solid var(--color-line);
      border-left: 0;
    }
    .seam {
      margin-left: 8px;
    }
  }
</style>
