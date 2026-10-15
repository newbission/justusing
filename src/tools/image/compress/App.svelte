<!--
  이미지 압축 도구 화면 (격리 frame 안에서 실행).
  넣은 이미지들을 같은 크기로 두고 다시 저장해 용량을 줄인다. 여러 장은 워커 여러 개가 나눠 처리한다.
  파일은 어디로도 전송되지 않는다.
-->
<script lang="ts">
  import { pick } from '../../../frame/locale';
  import { FRAME_MESSAGES } from '../../../frame/messages';
  import { MESSAGES, type Format, type Level } from './messages';
  import ActionBar from '../../../frame/ActionBar.svelte';
  import { downloadFile } from '../../../frame/download';
  import { baseName, formatSize } from '../../../frame/format';
  import { canUse } from '../../../lib/entitlement';
  import { EXTENSIONS, ImageBatch, type BatchItem } from '../../../lib/image/batch.svelte';
  import ImageBatchTool from '../../../lib/image/ImageBatchTool.svelte';
  import { ImageProcessError, processImage, type OutputType } from '../../../lib/image/process';
  import { makeZip } from '../../../lib/zip';

  const common = pick(FRAME_MESSAGES);
  const t = pick(MESSAGES);

  /** 단계별 JPG·WebP 화질과 PNG 색 수 (0 = 색을 줄이지 않음) */
  const LEVEL_OPTIONS: Record<Level, { quality: number; pngColors: number }> = {
    light: { quality: 0.85, pngColors: 0 },
    balanced: { quality: 0.75, pngColors: 256 },
    strong: { quality: 0.6, pngColors: 128 },
  };
  const LEVELS: Level[] = ['light', 'balanced', 'strong'];
  const FORMATS: Format[] = ['same', 'webp'];

  type Outcome =
    | { state: 'working' }
    /** 줄어든 결과 */
    | { state: 'done'; bytes: Uint8Array; name: string }
    /** 원본보다 작아지지 않아 원본을 그대로 둔다 */
    | { state: 'kept' }
    | { state: 'failed'; reason: 'decode' | 'encode' };

  const batch = new ImageBatch();
  let level: Level = $state('balanced');
  let format: Format = $state('same');
  let working = $state(false);
  /** 이미지마다 마지막으로 줄인 결과와 그때의 설정 */
  let outcomes: Record<number, Outcome & { settings: string }> = $state({});

  /** 설정이 바뀌면 이전 결과는 더 이상 맞지 않는다 */
  const settings = $derived(`${level}:${format}`);
  const outcomeOf = (item: BatchItem) =>
    outcomes[item.id]?.settings === settings ? outcomes[item.id] : undefined;

  /** 모든 이미지를 지금 설정으로 줄였으면 그 합계 */
  const summary = $derived.by(() => {
    if (working || batch.ready.length === 0) return undefined;
    let before = 0;
    let after = 0;
    let failed = false;
    for (const item of batch.ready) {
      const outcome = outcomeOf(item);
      if (!outcome || outcome.state === 'working') return undefined;
      before += item.file.size;
      if (outcome.state === 'done') after += outcome.bytes.length;
      else if (outcome.state === 'kept') after += item.file.size;
      else failed = true;
    }
    const shrunk = batch.ready.filter((item) => outcomeOf(item)?.state === 'done');
    return { before, after, failed, shrunk };
  });

  const finished = $derived(
    batch.ready.filter((item) => {
      const state = outcomeOf(item)?.state;
      return state !== undefined && state !== 'working';
    }).length,
  );

  const blocker = $derived.by(() => {
    if (batch.loading) return t.reading;
    if (batch.ready.length === 0) return t.needOne;
    return undefined;
  });

  function outputType(item: BatchItem): OutputType {
    return format === 'webp' ? 'image/webp' : item.type!;
  }

  async function compress() {
    if (blocker || working) return;
    const entitlement = await canUse('image/compress');
    if (!entitlement.allowed) return;

    const startedWith = settings;
    const { quality, pngColors } = LEVEL_OPTIONS[level];
    const targets = batch.ready.filter((item) => outcomeOf(item)?.state !== 'done');
    working = true;
    for (const item of targets) outcomes[item.id] = { state: 'working', settings: startedWith };
    // 워커 수만큼만 동시에 돈다 (process.ts). 모두 한꺼번에 맡기고 끝나는 대로 표시한다
    await Promise.all(
      targets.map(async (item) => {
        const type = outputType(item);
        let outcome: Outcome;
        try {
          const { bytes } = await processImage(item.file, { type, quality, pngColors });
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
        outcomes[item.id] = { ...outcome, settings: startedWith };
      }),
    );
    working = false;
  }

  async function downloadAll() {
    const files = await Promise.all(
      batch.ready.map(async (item) => {
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

  function downloadOne(item: BatchItem) {
    const outcome = outcomeOf(item);
    if (outcome?.state === 'done') downloadFile(outcome.bytes, outcome.name, outputType(item));
  }

  function percentSaved(before: number, after: number) {
    return Math.max(1, Math.round((1 - after / before) * 100));
  }
</script>

<ImageBatchTool {batch} busy={working}>
  {#snippet bar()}
    <ActionBar label={t.bar}>
      {#snippet text()}
        {#if working}
          {t.working(finished, batch.ready.length)}
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
          {blocker ?? t.ready(batch.ready.length)}
        {/if}
      {/snippet}
      {#if summary && summary.shrunk.length > 0 && batch.ready.length === 1}
        <button type="button" class="btn primary" onclick={() => downloadOne(summary.shrunk[0]!)}
          >{common.action.download}</button
        >
      {:else if summary && summary.shrunk.length > 0}
        <button type="button" class="btn primary" onclick={downloadAll}
          >{t.downloadAll(batch.ready.length)}</button
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
  {/snippet}

  {#snippet options()}
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
          <input type="radio" name="format" value={option} bind:group={format} disabled={working} />
          <span class="long">{t.formats[option].label}</span>
          <span class="short">{t.formats[option].short}</span>
        </label>
      {/each}
    </div>
    <p class="help">{t.levelHelp[level]} {t.note}</p>
  {/snippet}

  {#snippet meta(item: BatchItem)}
    {@const outcome = outcomeOf(item)}
    {#if outcome?.state === 'working'}
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
      <strong>{outcome.reason === 'encode' && format === 'webp' ? t.noWebp : t.broken}</strong>
    {:else}
      {item.width}×{item.height} · {formatSize(item.file.size)}
    {/if}
  {/snippet}

  {#snippet actions(item: BatchItem)}
    {#if outcomeOf(item)?.state === 'done'}
      <button
        type="button"
        class="btn icon"
        onclick={() => downloadOne(item)}
        aria-label={common.images.download(item.name)}>↓</button
      >
    {/if}
  {/snippet}
</ImageBatchTool>
