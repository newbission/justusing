<!--
  이미지 크기 조절 도구 화면 (격리 frame 안에서 실행).
  넣은 이미지들의 가로·세로를 비율이나 화소로 바꿔 원래 형식으로 저장한다.
  여러 장은 워커 여러 개가 나눠 처리한다. 파일은 어디로도 전송되지 않는다.
-->
<script lang="ts">
  import { pick } from '../../../frame/locale';
  import { FRAME_MESSAGES } from '../../../frame/messages';
  import { MESSAGES, type Mode } from './messages';
  import ActionBar from '../../../frame/ActionBar.svelte';
  import { downloadFile } from '../../../frame/download';
  import { baseName, formatSize } from '../../../frame/format';
  import { canUse } from '../../../lib/entitlement';
  import { EXTENSIONS, ImageBatch, type BatchItem } from '../../../lib/image/batch.svelte';
  import ImageBatchTool from '../../../lib/image/ImageBatchTool.svelte';
  import { processImage } from '../../../lib/image/process';
  import { makeZip } from '../../../lib/zip';

  const common = pick(FRAME_MESSAGES);
  const t = pick(MESSAGES);

  /** 다시 저장할 때 JPG·WebP 화질. 크기만 바꾸는 도구라 눈에 띄는 손실이 없게 높게 둔다 */
  const QUALITY = 0.92;
  /** 브라우저 canvas가 확실히 그릴 수 있는 크기 */
  const MAX_SIDE = 16_384;
  const MAX_PIXELS = 64_000_000;
  const MODES: Mode[] = ['percent', 'pixels'];

  type Outcome =
    | { state: 'working' }
    | { state: 'done'; bytes: Uint8Array; name: string; width: number; height: number }
    | { state: 'failed' };

  const batch = new ImageBatch();
  let mode: Mode = $state('percent');
  let percent: number | null = $state(50);
  let width: number | null = $state(null);
  let height: number | null = $state(null);
  let keepRatio = $state(true);
  let working = $state(false);
  let outcomes: Record<number, Outcome & { settings: string }> = $state({});

  /** 0보다 큰 정수만 크기로 친다 (빈 칸·0·음수는 없는 것) */
  const positive = (value: number | null) =>
    value !== null && Number.isFinite(value) && value >= 1 ? Math.round(value) : undefined;

  /** 지금 설정에서 고칠 점. 없으면 undefined */
  const problem = $derived.by(() => {
    if (mode === 'percent') {
      return percent === null || !(percent >= 1 && percent <= 400) ? t.invalidPercent : undefined;
    }
    if (!positive(width) && !positive(height)) return t.needSize;
    if (!keepRatio && !(positive(width) && positive(height))) return t.needBoth;
    return undefined;
  });

  /** 이미지 하나의 결과 크기 */
  function targetOf(item: BatchItem): { width: number; height: number } {
    let scale: { x: number; y: number };
    if (mode === 'percent') {
      scale = { x: percent! / 100, y: percent! / 100 };
    } else if (keepRatio) {
      const w = positive(width);
      const h = positive(height);
      const s = Math.min(w ? w / item.width : Infinity, h ? h / item.height : Infinity);
      scale = { x: s, y: s };
    } else {
      return { width: positive(width)!, height: positive(height)! };
    }
    return {
      width: Math.max(1, Math.round(item.width * scale.x)),
      height: Math.max(1, Math.round(item.height * scale.y)),
    };
  }

  const tooLarge = $derived(
    !problem &&
      batch.ready.some((item) => {
        const size = targetOf(item);
        return (
          size.width > MAX_SIDE || size.height > MAX_SIDE || size.width * size.height > MAX_PIXELS
        );
      }),
  );

  /** 설정이 바뀌면 이전 결과는 더 이상 맞지 않는다 */
  const settings = $derived(
    mode === 'percent' ? `percent:${percent}` : `pixels:${width}:${height}:${keepRatio}`,
  );
  const outcomeOf = (item: BatchItem) =>
    outcomes[item.id]?.settings === settings ? outcomes[item.id] : undefined;

  const blocker = $derived.by(() => {
    if (batch.loading) return t.reading;
    if (batch.ready.length === 0) return t.needOne;
    if (problem) return problem;
    if (tooLarge) return t.tooLarge;
    return undefined;
  });

  /** 모든 이미지를 지금 설정으로 바꿨으면 그 결과 */
  const summary = $derived.by(() => {
    if (working || batch.ready.length === 0) return undefined;
    const done: BatchItem[] = [];
    let failed = false;
    for (const item of batch.ready) {
      const state = outcomeOf(item)?.state;
      if (state === undefined || state === 'working') return undefined;
      if (state === 'done') done.push(item);
      else failed = true;
    }
    return { done, failed };
  });

  const finished = $derived(
    batch.ready.filter((item) => {
      const state = outcomeOf(item)?.state;
      return state !== undefined && state !== 'working';
    }).length,
  );

  async function resize() {
    if (blocker || working) return;
    const entitlement = await canUse('image/resize');
    if (!entitlement.allowed) return;

    const startedWith = settings;
    const targets = batch.ready
      .filter((item) => outcomeOf(item)?.state !== 'done')
      .map((item) => ({ item, size: targetOf(item) }));
    working = true;
    for (const { item } of targets) outcomes[item.id] = { state: 'working', settings: startedWith };
    await Promise.all(
      targets.map(async ({ item, size }) => {
        const type = item.type!;
        let outcome: Outcome;
        try {
          const result = await processImage(item.file, {
            type,
            quality: QUALITY,
            pngColors: 0,
            size,
          });
          outcome = {
            state: 'done',
            bytes: result.bytes,
            width: result.width,
            height: result.height,
            name: `${baseName(item.name)}_${result.width}x${result.height}.${EXTENSIONS[type]}`,
          };
        } catch {
          outcome = { state: 'failed' };
        }
        outcomes[item.id] = { ...outcome, settings: startedWith };
      }),
    );
    working = false;
  }

  function downloadOne(item: BatchItem) {
    const outcome = outcomeOf(item);
    if (outcome?.state === 'done') downloadFile(outcome.bytes, outcome.name, item.type);
  }

  async function downloadAll() {
    const files = batch.ready.flatMap((item) => {
      const outcome = outcomeOf(item);
      return outcome?.state === 'done'
        ? [{ name: outcome.name, bytes: outcome.bytes.slice() }]
        : [];
    });
    downloadFile(await makeZip(files), t.zipName, 'application/zip');
  }

  const dimensions = (size: { width: number; height: number }) => `${size.width}×${size.height}`;
</script>

<ImageBatchTool
  {batch}
  busy={working}
  result={(item) => {
    const outcome = outcomeOf(item);
    return outcome?.state === 'done' ? outcome.bytes : undefined;
  }}
  onremove={(item) => delete outcomes[item.id]}
>
  {#snippet bar()}
    <ActionBar label={t.bar}>
      {#snippet text()}
        {#if working}
          {t.working(finished, batch.ready.length)}
        {:else if summary?.failed}
          <strong>{t.failed}</strong>
        {:else if summary}
          {t.done(summary.done.length)}
        {:else if blocker === t.reading || blocker === t.needOne}
          {blocker}
        {:else if blocker}
          <strong>{blocker}</strong>
        {:else}
          {t.ready(batch.ready.length)}
        {/if}
      {/snippet}
      {#if summary && summary.done.length > 0 && batch.ready.length === 1}
        <button type="button" class="btn primary" onclick={() => downloadOne(summary.done[0]!)}
          >{common.action.download}</button
        >
      {:else if summary && summary.done.length > 0}
        <button type="button" class="btn primary" onclick={downloadAll}
          >{t.downloadAll(summary.done.length)}</button
        >
      {:else}
        <button
          type="button"
          class="btn primary"
          disabled={blocker !== undefined || working || summary !== undefined}
          onclick={resize}>{working ? t.workingShort : t.run}</button
        >
      {/if}
    </ActionBar>
  {/snippet}

  {#snippet options()}
    <div class="choice" role="radiogroup" aria-label={t.modeGroup}>
      {#each MODES as option (option)}
        <label class:checked={mode === option}>
          <input type="radio" name="mode" value={option} bind:group={mode} disabled={working} />
          <span class="long">{t.modes[option].label}</span>
          <span class="short">{t.modes[option].short}</span>
        </label>
      {/each}
    </div>
    {#if mode === 'percent'}
      <label class="size">
        {t.percent}
        <input
          type="number"
          inputmode="numeric"
          min="1"
          max="400"
          bind:value={percent}
          disabled={working}
          aria-invalid={problem !== undefined}
        />
      </label>
      <p class="help">{t.help.percent}</p>
    {:else}
      <label class="size">
        {t.width}
        <input
          type="number"
          inputmode="numeric"
          min="1"
          bind:value={width}
          disabled={working}
          aria-invalid={problem !== undefined}
        />
      </label>
      <label class="size">
        {t.height}
        <input
          type="number"
          inputmode="numeric"
          min="1"
          bind:value={height}
          disabled={working}
          aria-invalid={problem !== undefined}
        />
      </label>
      <label class="check">
        <input type="checkbox" bind:checked={keepRatio} disabled={working} />
        {t.keepRatio}
      </label>
      <p class="help">{keepRatio ? t.help.keep : t.help.exact}</p>
    {/if}
  {/snippet}

  {#snippet meta(item: BatchItem)}
    {@const outcome = outcomeOf(item)}
    {#if outcome?.state === 'working'}
      {t.itemWorking}
    {:else if outcome?.state === 'done'}
      {t.itemDone(dimensions(outcome), formatSize(outcome.bytes.length))}
    {:else if outcome?.state === 'failed'}
      <strong>{t.itemFailed}</strong>
    {:else if problem}
      {dimensions(item)} · {formatSize(item.file.size)}
    {:else}
      {t.itemPlan(dimensions(item), dimensions(targetOf(item)), formatSize(item.file.size))}
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

<style>
  .size {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
  }
  .size input {
    width: 96px;
    height: 36px;
    padding: 0 10px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius);
    background: var(--color-bg);
    font-size: 15px;
  }
  .size input[aria-invalid='true'] {
    border-color: var(--color-text);
  }
  .check {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    cursor: pointer;
  }
  .check input {
    width: 18px;
    height: 18px;
    accent-color: var(--color-text);
  }
</style>
