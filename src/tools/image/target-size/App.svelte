<!--
  이미지 용량 맞추기 도구 화면 (격리 frame 안에서 실행).
  넣은 이미지들을 "200KB 이하"처럼 정한 용량 이하로 저장한다. 화질을 먼저 낮추고, 고르면 가로·세로도 줄인다.
  화질을 찾는 반복은 워커 안에서 하고, 여러 장은 워커 여러 개가 나눠 처리한다. 파일은 어디로도 전송되지 않는다.
-->
<script lang="ts">
  import { pick } from '../../../frame/locale';
  import { FRAME_MESSAGES } from '../../../frame/messages';
  import { MESSAGES, type Format, type Method, type Unit } from './messages';
  import ActionBar from '../../../frame/ActionBar.svelte';
  import { downloadFile } from '../../../frame/download';
  import { baseName, formatSize } from '../../../frame/format';
  import { canUse } from '../../../lib/entitlement';
  import {
    EXTENSIONS,
    ImageBatch,
    saveType,
    type BatchItem,
  } from '../../../lib/image/batch.svelte';
  import ImageBatchTool from '../../../lib/image/ImageBatchTool.svelte';
  import {
    fitImage,
    ImageProcessError,
    type OutputType,
    type OverReason,
  } from '../../../lib/image/process';
  import { makeZip } from '../../../lib/zip';

  const common = pick(FRAME_MESSAGES);
  const t = pick(MESSAGES);

  /** 자주 쓰는 목표 (관공서·지원서 첨부, 메신저 등) */
  const PRESETS: { id: string; value: number; unit: Unit }[] = [
    { id: '100KB', value: 100, unit: 'KB' },
    { id: '200KB', value: 200, unit: 'KB' },
    { id: '500KB', value: 500, unit: 'KB' },
    { id: '1MB', value: 1, unit: 'MB' },
    { id: '2MB', value: 2, unit: 'MB' },
  ];
  /**
   * 1KB = 1,000바이트로 센다. 1,024로 세는 곳보다 엄격해서 어느 쪽으로 재도 넘지 않는다.
   * (목록의 용량 표시는 1,024로 세므로 결과가 목표보다 조금 작게 보인다)
   */
  const UNIT_BYTES: Record<Unit, number> = { KB: 1000, MB: 1_000_000 };
  const MIN_BYTES = 10_000;
  const MAX_BYTES = 50_000_000;
  const METHODS: Method[] = ['resize', 'keep'];
  const FORMATS: Format[] = ['jpg', 'same'];

  type Outcome =
    | { state: 'working' }
    | {
        state: 'done';
        bytes: Uint8Array;
        name: string;
        type: OutputType;
        width: number;
        height: number;
        quality?: number;
        colors?: number;
        flattened?: boolean;
      }
    /** 이미 목표 이하라 원본을 그대로 둔다 */
    | { state: 'kept' }
    /** 가장 작게 해도 목표를 넘는다 */
    | { state: 'over'; smallest: number; reason: OverReason }
    | { state: 'failed'; reason: 'decode' | 'encode' };

  // HEIC(아이폰 사진)는 브라우저가 HEIC로 저장하지 못해 늘 JPG로 맞춘다 (목표 이하여도 원본 HEIC를 두지 않는다)
  const batch = new ImageBatch({ heic: true });
  let preset: string = $state('200KB');
  let customValue: number | null = $state(300);
  let customUnit: Unit = $state('KB');
  let method: Method = $state('resize');
  let format: Format = $state('jpg');
  let working = $state(false);
  /** 이미지마다 마지막으로 맞춘 결과와 그때의 설정 */
  let outcomes: Record<number, Outcome & { settings: string }> = $state({});

  /** 지금 목표 (숫자·단위·바이트). 직접 입력이 범위를 벗어나면 undefined */
  const target = $derived.by(() => {
    const chosen = PRESETS.find((option) => option.id === preset);
    const value = chosen ? chosen.value : customValue;
    const unit = chosen ? chosen.unit : customUnit;
    if (value === null || !Number.isFinite(value) || value <= 0) return undefined;
    const bytes = Math.round(value * UNIT_BYTES[unit]);
    if (bytes < MIN_BYTES || bytes > MAX_BYTES) return undefined;
    // 1.50 → 1.5, 소수 둘째 자리까지
    return { bytes, label: `${Number(value.toFixed(2))}${unit}` };
  });

  /** 설정이 바뀌면 이전 결과는 더 이상 맞지 않는다 */
  const settings = $derived(`${target?.bytes}:${method}:${format}`);
  const outcomeOf = (item: BatchItem) =>
    outcomes[item.id]?.settings === settings ? outcomes[item.id] : undefined;

  const blocker = $derived.by(() => {
    if (batch.loading) return t.reading;
    if (batch.ready.length === 0) return t.needOne;
    if (!target) return t.invalidTarget;
    return undefined;
  });

  /** 모든 이미지를 지금 설정으로 맞췄으면 그 결과 */
  const summary = $derived.by(() => {
    if (working || batch.ready.length === 0) return undefined;
    const done: BatchItem[] = [];
    let kept = 0;
    let over: OverReason | undefined;
    let failed = false;
    for (const item of batch.ready) {
      const outcome = outcomeOf(item);
      if (!outcome || outcome.state === 'working') return undefined;
      if (outcome.state === 'done') done.push(item);
      else if (outcome.state === 'kept') kept++;
      else if (outcome.state === 'over') over ??= outcome.reason;
      else failed = true;
    }
    return { done, kept, over, failed };
  });

  const finished = $derived(
    batch.ready.filter((item) => {
      const state = outcomeOf(item)?.state;
      return state !== undefined && state !== 'working';
    }).length,
  );

  function outputType(item: BatchItem): OutputType {
    return format === 'jpg' ? 'image/jpeg' : saveType(item);
  }

  async function run() {
    if (blocker || working || !target) return;
    const entitlement = await canUse('image/target-size');
    if (!entitlement.allowed) return;

    const startedWith = settings;
    const limit = { bytes: target.bytes, resize: method === 'resize' };
    const label = target.label;
    const targets = batch.ready.filter((item) => outcomeOf(item)?.state !== 'done');
    working = true;
    for (const item of targets) outcomes[item.id] = { state: 'working', settings: startedWith };
    // 워커 수만큼만 동시에 돈다 (process.ts). 모두 한꺼번에 맡기고 끝나는 대로 표시한다
    await Promise.all(
      targets.map(async (item) => {
        const type = outputType(item);
        let outcome: Outcome;
        // 이미 목표 이하이고 형식도 같으면 다시 저장하지 않는다 (다시 저장하면 화질만 나빠진다)
        if (item.file.size <= limit.bytes && type === item.type) {
          outcome = { state: 'kept' };
        } else {
          try {
            const result = await fitImage(item.file, { type, limit });
            outcome = result.over
              ? { state: 'over', smallest: result.smallest, reason: result.reason }
              : {
                  state: 'done',
                  bytes: result.bytes,
                  name: `${baseName(item.name)}_${label}.${EXTENSIONS[type]}`,
                  type,
                  width: result.width,
                  height: result.height,
                  quality: result.quality,
                  colors: result.colors,
                  flattened: result.flattened,
                };
          } catch (error) {
            outcome = {
              state: 'failed',
              reason: error instanceof ImageProcessError ? error.reason : 'encode',
            };
          }
        }
        outcomes[item.id] = { ...outcome, settings: startedWith };
      }),
    );
    working = false;
  }

  /** ZIP에 실제로 들어가는 장수 (맞추지 못한 것·실패한 것은 빠진다) */
  const zipCount = $derived(
    batch.ready.filter((item) => {
      const state = outcomeOf(item)?.state;
      return state === 'done' || state === 'kept';
    }).length,
  );

  async function downloadAll() {
    if (!target) return;
    const files = await Promise.all(
      batch.ready.map(async (item) => {
        const outcome = outcomeOf(item);
        // 맞춘 것은 결과를, 이미 목표 이하인 것은 원본을 넣어 고른 이미지가 모두 들어 있게 한다
        if (outcome?.state === 'done') return { name: outcome.name, bytes: outcome.bytes.slice() };
        if (outcome?.state === 'kept') {
          return { name: item.name, bytes: new Uint8Array(await item.file.arrayBuffer()) };
        }
        return undefined;
      }),
    );
    const zip = await makeZip(files.filter((file) => file !== undefined));
    downloadFile(zip, t.zipName(target.label), 'application/zip');
  }

  function downloadOne(item: BatchItem) {
    const outcome = outcomeOf(item);
    if (outcome?.state === 'done') downloadFile(outcome.bytes, outcome.name, outcome.type);
  }

  /** 결과 줄 설명: 용량 · 크기 · 화질(PNG는 색 수) (· 투명한 곳은 흰색). 좁은 화면에서 뒤쪽이 잘린다 */
  function doneText(item: BatchItem, outcome: Extract<Outcome, { state: 'done' }>): string {
    const size = `${outcome.width}×${outcome.height}`;
    const parts = [
      formatSize(outcome.bytes.length),
      outcome.width === item.width && outcome.height === item.height
        ? t.sameSize(size)
        : t.resized(size),
      outcome.colors !== undefined
        ? t.colors(outcome.colors)
        : t.quality(Math.round((outcome.quality ?? 0) * 100)),
    ];
    if (outcome.flattened) parts.push(t.flattened);
    return parts.join(' · ');
  }
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
        {:else if summary && summary.failed}
          <strong>{t.failed}</strong>
        {:else if summary && summary.over}
          <strong>{summary.over === 'keep-size' ? t.overKeepSize : t.overTooSmall}</strong>
        {:else if summary && summary.done.length === 0}
          {t.allKept(target!.label)}
        {:else if summary}
          {t.done(batch.ready.length, target!.label)}
        {:else if blocker === t.invalidTarget}
          <strong>{blocker}</strong>
        {:else}
          {blocker ?? t.ready(batch.ready.length, target!.label)}
        {/if}
      {/snippet}
      {#if summary && summary.done.length > 0 && batch.ready.length === 1}
        <button type="button" class="btn primary" onclick={() => downloadOne(summary.done[0]!)}
          >{common.action.download}</button
        >
      {:else if summary && summary.done.length > 0}
        <button type="button" class="btn primary" onclick={downloadAll}
          >{t.downloadAll(zipCount)}</button
        >
      {:else}
        <button
          type="button"
          class="btn primary"
          disabled={blocker !== undefined || working || summary !== undefined}
          onclick={run}>{working ? t.workingShort : t.run}</button
        >
      {/if}
    </ActionBar>
  {/snippet}

  {#snippet options()}
    <div class="target-row">
      <span class="target-label" aria-hidden="true">{t.targetGroup}</span>
      <div class="targets" role="radiogroup" aria-label={t.targetGroup}>
        {#each PRESETS as option (option.id)}
          <label class:checked={preset === option.id}>
            <input
              type="radio"
              name="target"
              value={option.id}
              bind:group={preset}
              disabled={working}
            />
            {option.id}
          </label>
        {/each}
        <label class:checked={preset === 'custom'}>
          <input type="radio" name="target" value="custom" bind:group={preset} disabled={working} />
          {t.custom}
        </label>
      </div>
      {#if preset === 'custom'}
        <div class="custom">
          <input
            type="number"
            inputmode="decimal"
            min="0"
            step="any"
            bind:value={customValue}
            disabled={working}
            aria-label={t.customValue}
            aria-invalid={target === undefined}
          />
          <select bind:value={customUnit} disabled={working} aria-label={t.customUnit}>
            <option value="KB">KB</option>
            <option value="MB">MB</option>
          </select>
        </div>
      {/if}
    </div>
    <div class="choice" role="radiogroup" aria-label={t.methodGroup}>
      {#each METHODS as option (option)}
        <label class:checked={method === option}>
          <input type="radio" name="method" value={option} bind:group={method} disabled={working} />
          <span class="long">{t.methods[option].label}</span>
          <span class="short">{t.methods[option].short}</span>
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
    <p class="help">{t.methodHelp[method]} {t.formatHelp[format]}</p>
    {#if batch.ready.some((item) => item.type === undefined)}
      <p class="help">{t.heicNote}</p>
    {/if}
  {/snippet}

  {#snippet meta(item: BatchItem)}
    {@const outcome = outcomeOf(item)}
    {#if outcome?.state === 'working'}
      {t.itemWorking}
    {:else if outcome?.state === 'done'}
      <span class="wrap">{doneText(item, outcome)}</span>
    {:else if outcome?.state === 'kept'}
      {t.itemKept(formatSize(item.file.size))}
    {:else if outcome?.state === 'over'}
      <strong class="wrap"
        >{outcome.reason === 'keep-size'
          ? t.itemKeepSize(formatSize(outcome.smallest))
          : t.itemTooSmall(formatSize(outcome.smallest))}</strong
      >
    {:else if outcome?.state === 'failed'}
      <strong class="wrap"
        >{outcome.reason === 'decode'
          ? t.broken
          : format === 'same' && item.type === 'image/webp'
            ? t.noWebp
            : t.saveFailed}</strong
      >
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

<style>
  /* 목표 줄: 이름 · 고르기 · (직접 입력 칸). 설정 첫 줄을 혼자 차지한다 */
  .target-row {
    display: flex;
    flex-basis: 100%;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
  }
  .target-label {
    font-size: 14px;
    font-weight: 600;
  }
  /* 목표 고르기: 좁은 화면에서 줄을 넘겨도 깨지지 않게 하나씩 떨어진 버튼으로 */
  .targets {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .targets label {
    padding: 7px 12px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius);
    font-size: 14px;
    white-space: nowrap;
    cursor: pointer;
    transition: background-color 0.12s;
  }
  .targets label:hover {
    background: var(--color-hover);
  }
  .targets label.checked {
    border-color: var(--color-text);
    background: var(--color-text);
    color: var(--color-bg);
    font-weight: 600;
  }
  .targets label:has(input:focus-visible) {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
  .targets input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .custom {
    display: inline-flex;
    gap: 6px;
  }
  .custom input,
  .custom select {
    height: 36px;
    padding: 0 10px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius);
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 15px;
  }
  .custom input {
    width: 96px;
  }
  .custom input[aria-invalid='true'] {
    border-color: var(--color-text);
  }
  /* 결과 설명은 두 줄까지 (줄 높이는 그대로) */
  .wrap {
    display: -webkit-box;
    overflow: hidden;
    white-space: normal;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }
</style>
