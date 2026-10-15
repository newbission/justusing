<!--
  이미지 압축 도구 화면 (격리 frame 안에서 실행).
  넣은 이미지들을 같은 크기로 두고 다시 저장해 용량을 줄인다. 여러 장은 워커 여러 개가 나눠 처리한다.
  파일은 어디로도 전송되지 않는다.
-->
<script lang="ts">
  import '../../../frame/controls.css';
  import { onMount } from 'svelte';
  import { pick } from '../../../frame/locale';
  import { FRAME_MESSAGES } from '../../../frame/messages';
  import { MESSAGES, type Format, type Level } from './messages';
  import ActionBar from '../../../frame/ActionBar.svelte';
  import FileDrop from '../../../frame/FileDrop.svelte';
  import { onFrameFiles } from '../../../frame/drop';
  import { requestShowTool } from '../../../frame/parent';
  import { downloadFile } from '../../../frame/download';
  import { baseName, formatSize } from '../../../frame/format';
  import { canUse } from '../../../lib/entitlement';
  import { readImageInfo } from '../../../lib/image/prepare';
  import {
    ImageProcessError,
    processImage,
    type OutputType,
    type ProcessOptions,
  } from '../../../lib/image/process';
  import { makeZip } from '../../../lib/zip';

  const common = pick(FRAME_MESSAGES);
  const t = pick(MESSAGES);

  const ACCEPT = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';

  /** 단계별 JPG·WebP 화질과 PNG 색 수 (0 = 색을 줄이지 않음) */
  const LEVEL_OPTIONS: Record<Level, { quality: number; pngColors: number }> = {
    light: { quality: 0.85, pngColors: 0 },
    balanced: { quality: 0.75, pngColors: 256 },
    strong: { quality: 0.6, pngColors: 128 },
  };
  const LEVELS: Level[] = ['light', 'balanced', 'strong'];
  const FORMATS: Format[] = ['same', 'webp'];
  const EXTENSIONS: Record<OutputType, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };

  type Outcome =
    | { state: 'working' }
    /** 줄어든 결과 */
    | { state: 'done'; bytes: Uint8Array; name: string }
    /** 원본보다 작아지지 않아 원본을 그대로 둔다 */
    | { state: 'kept' }
    | { state: 'failed'; reason: 'decode' | 'encode' };

  interface Item {
    id: number;
    name: string;
    file: File;
    /** 원래 형식. JPG·PNG·WebP가 아니면 unsupported */
    type?: OutputType;
    status: 'loading' | 'ready' | 'error';
    width: number;
    height: number;
    thumb?: string;
    /** 마지막으로 줄인 결과와 그때의 설정 */
    outcome?: Outcome & { settings: string };
  }

  let items: Item[] = $state([]);
  let nextId = 0;
  let level: Level = $state('balanced');
  let format: Format = $state('same');
  let working = $state(false);

  /** 설정이 바뀌면 이전 결과는 더 이상 맞지 않는다 */
  const settings = $derived(`${level}:${format}`);
  const readyItems = $derived(items.filter((item) => item.status === 'ready'));
  const outcomeOf = (item: Item) =>
    item.outcome?.settings === settings ? item.outcome : undefined;

  /** 모든 이미지를 지금 설정으로 줄였으면 그 합계 */
  const summary = $derived.by(() => {
    if (working || readyItems.length === 0) return undefined;
    let before = 0;
    let after = 0;
    let failed = false;
    for (const item of readyItems) {
      const outcome = outcomeOf(item);
      if (!outcome || outcome.state === 'working') return undefined;
      before += item.file.size;
      if (outcome.state === 'done') after += outcome.bytes.length;
      else if (outcome.state === 'kept') after += item.file.size;
      else failed = true;
    }
    const shrunk = readyItems.filter((item) => outcomeOf(item)?.state === 'done');
    return { before, after, failed, shrunk };
  });

  const blocker = $derived.by(() => {
    if (items.some((item) => item.status === 'loading')) return t.reading;
    if (readyItems.length === 0) return t.needOne;
    return undefined;
  });

  function outputType(item: Item): OutputType {
    return format === 'webp' ? 'image/webp' : item.type!;
  }

  function typeOf(file: File): OutputType | undefined {
    if (file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name)) return 'image/jpeg';
    if (file.type === 'image/png' || /\.png$/i.test(file.name)) return 'image/png';
    if (file.type === 'image/webp' || /\.webp$/i.test(file.name)) return 'image/webp';
    return undefined;
  }

  async function compress() {
    if (blocker || working) return;
    const entitlement = await canUse('image/compress');
    if (!entitlement.allowed) return;

    const startedWith = settings;
    const { quality, pngColors } = LEVEL_OPTIONS[level];
    const targets = readyItems.filter((item) => outcomeOf(item)?.state !== 'done');
    working = true;
    for (const item of targets) item.outcome = { state: 'working', settings: startedWith };
    // 워커 수만큼만 동시에 돈다 (process.ts). 모두 한꺼번에 맡기고 끝나는 대로 표시한다
    await Promise.all(
      targets.map(async (item) => {
        const type = outputType(item);
        const options: ProcessOptions = { type, quality, pngColors };
        let outcome: Outcome;
        try {
          const { bytes } = await processImage(item.file, options);
          outcome =
            bytes.length < item.file.size
              ? {
                  state: 'done',
                  bytes,
                  name: `${baseName(item.name)}_${t.suffix}.${EXTENSIONS[type]}`,
                }
              : { state: 'kept' };
        } catch (error) {
          outcome = {
            state: 'failed',
            reason: error instanceof ImageProcessError ? error.reason : 'encode',
          };
        }
        // 그동안 목록에서 뺐으면 버린다
        if (items.includes(item)) item.outcome = { ...outcome, settings: startedWith };
      }),
    );
    working = false;
  }

  async function downloadAll() {
    if (!summary) return;
    const files = await Promise.all(
      readyItems.map(async (item) => {
        const outcome = outcomeOf(item);
        // 줄어든 것은 결과를, 원본 그대로 둔 것은 원본을 넣어 고른 이미지가 모두 들어 있게 한다
        if (outcome?.state === 'done') return { name: outcome.name, bytes: outcome.bytes.slice() };
        if (outcome?.state === 'kept') {
          return { name: item.name, bytes: new Uint8Array(await item.file.arrayBuffer()) };
        }
        return undefined;
      }),
    );
    const zip = await makeZip(files.filter((file) => file !== undefined));
    downloadFile(zip, t.zipName, 'application/zip');
  }

  function downloadOne(item: Item) {
    const outcome = outcomeOf(item);
    if (outcome?.state === 'done') downloadFile(outcome.bytes, outcome.name, outputType(item));
  }

  function add(files: File[]) {
    const images = files.filter(
      (file) => file.type.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(file.name),
    );
    if (images.length === 0) return;
    if (items.length === 0) requestShowTool();
    for (const file of images) {
      const type = typeOf(file);
      items.push({
        id: nextId++,
        name: file.name,
        file,
        type,
        status: type ? 'loading' : 'error',
        width: 0,
        height: 0,
      });
      if (type) load(items.at(-1)!);
    }
  }

  async function load(item: Item) {
    try {
      const info = await readImageInfo(item.file);
      if (!items.some((other) => other.id === item.id)) return;
      item.width = info.width;
      item.height = info.height;
      item.thumb = URL.createObjectURL(item.file);
      item.status = 'ready';
    } catch {
      item.status = 'error';
    }
  }

  function remove(item: Item) {
    items = items.filter((other) => other !== item);
    if (item.thumb) URL.revokeObjectURL(item.thumb);
  }

  function percentSaved(before: number, after: number) {
    return Math.max(1, Math.round((1 - after / before) * 100));
  }

  const totalSize = $derived(items.reduce((sum, item) => sum + item.file.size, 0));

  onMount(() => onFrameFiles(add));
</script>

<div class="tool">
  {#if items.length === 0}
    <div class="drop">
      <FileDrop accept={ACCEPT} label={t.choose} multiple hint={t.hint} onfiles={add} />
    </div>
  {:else}
    <div class="summary">
      <span aria-live="polite">{t.summary(items.length, formatSize(totalSize))}</span>
      <label class="btn" class:disabled={working}>
        {t.addFiles}
        <input
          type="file"
          class="visually-hidden"
          accept={ACCEPT}
          multiple
          disabled={working}
          onchange={(event) => {
            add([...(event.currentTarget.files ?? [])]);
            event.currentTarget.value = '';
          }}
        />
      </label>
    </div>

    <ActionBar label={t.bar}>
      {#snippet text()}
        {#if working}
          {t.working(
            readyItems.filter((item) => {
              const state = outcomeOf(item)?.state;
              return state !== undefined && state !== 'working';
            }).length,
            readyItems.length,
          )}
        {:else if summary && summary.failed}
          <strong>{t.failed}</strong>
        {:else if summary && summary.shrunk.length === 0}
          {t.noGain}
        {:else if summary}
          {t.done(
            formatSize(summary.before),
            formatSize(summary.after),
            percentSaved(summary.before, summary.after),
          )}
        {:else}
          {blocker ?? t.ready(readyItems.length)}
        {/if}
      {/snippet}
      {#if summary && summary.shrunk.length > 0 && readyItems.length === 1}
        <button type="button" class="btn primary" onclick={() => downloadOne(summary.shrunk[0]!)}
          >{common.action.download}</button
        >
      {:else if summary && summary.shrunk.length > 0}
        <button type="button" class="btn primary" onclick={downloadAll}
          >{t.downloadAll(readyItems.length)}</button
        >
      {:else}
        <button
          type="button"
          class="btn primary"
          disabled={blocker !== undefined || working || summary !== undefined}
          onclick={compress}>{working ? t.workingShort : t.run}</button
        >
      {/if}
    </ActionBar>

    <div class="options">
      <div class="choice" role="radiogroup" aria-label={t.levelGroup}>
        {#each LEVELS as option (option)}
          <label class:checked={level === option}>
            <input type="radio" name="level" value={option} bind:group={level} disabled={working} />
            <span class="long">{t.levels[option].label}</span>
            <span class="short">{t.levels[option].short}</span>
          </label>
        {/each}
      </div>
      <div class="choice" role="radiogroup" aria-label={t.formatGroup}>
        {#each FORMATS as option (option)}
          <label class:checked={format === option}>
            <input
              type="radio"
              name="format"
              value={option}
              bind:group={format}
              disabled={working}
            />
            <span class="long">{t.formats[option].label}</span>
            <span class="short">{t.formats[option].short}</span>
          </label>
        {/each}
      </div>
      <p class="help">{t.levelHelp[level]} {t.note}</p>
    </div>

    <ul class="list" aria-label={t.list}>
      {#each items as item (item.id)}
        {@const outcome = outcomeOf(item)}
        <li class="row">
          <div class="thumb">
            {#if item.thumb}
              <img src={item.thumb} alt="" />
            {/if}
          </div>
          <div class="info">
            <span class="name" title={item.name}>{item.name}</span>
            <span class="meta">
              {#if item.status === 'loading'}
                {t.itemReading}
              {:else if item.status === 'error'}
                <strong>{t.broken}</strong>
              {:else if outcome?.state === 'working'}
                {t.itemWorking}
              {:else if outcome?.state === 'done'}
                {t.itemDone(
                  formatSize(item.file.size),
                  formatSize(outcome.bytes.length),
                  percentSaved(item.file.size, outcome.bytes.length),
                )}
              {:else if outcome?.state === 'kept'}
                {t.itemKept(formatSize(item.file.size))}
              {:else if outcome?.state === 'failed'}
                <strong
                  >{outcome.reason === 'encode' && format === 'webp' ? t.noWebp : t.broken}</strong
                >
              {:else}
                {item.width}×{item.height} · {formatSize(item.file.size)}
              {/if}
            </span>
          </div>
          {#if outcome?.state === 'done'}
            <button
              type="button"
              class="btn icon"
              onclick={() => downloadOne(item)}
              aria-label={t.download(item.name)}>↓</button
            >
          {/if}
          <button
            type="button"
            class="btn icon"
            disabled={working}
            onclick={() => remove(item)}
            aria-label={t.remove(item.name)}>×</button
          >
        </li>
      {/each}
    </ul>
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
  .options {
    display: flex;
    flex: none;
    flex-wrap: wrap;
    gap: 12px;
    padding: 12px 16px 0;
    border-bottom: 1px solid var(--color-line);
  }
  .options .help {
    flex-basis: 100%;
    margin-bottom: 12px;
  }
  .list {
    flex: 1;
    margin: 0;
    padding: 8px;
    overflow: auto;
    list-style: none;
  }
  /* 줄 높이 고정: 읽는 동안·줄인 뒤에 목록이 흔들리지 않게 */
  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 72px;
    padding: 0 8px;
  }
  .row + .row {
    border-top: 1px solid var(--color-line);
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
  .btn.icon {
    font-size: 18px;
    line-height: 1;
  }
</style>
