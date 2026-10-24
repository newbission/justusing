<!--
  위치 정보 지우기 도구 화면 (격리 frame 안에서 실행).
  넣은 사진마다 위치·날짜·기기 정보를 보여 주고, 사진을 다시 저장하지 않고 정보 조각만 떼어 낸다.
  파일은 어디로도 전송되지 않는다.
-->
<script lang="ts">
  import { pick } from '../../../frame/locale';
  import { FRAME_MESSAGES } from '../../../frame/messages';
  import { MESSAGES } from './messages';
  import ActionBar from '../../../frame/ActionBar.svelte';
  import { downloadFile } from '../../../frame/download';
  import { baseName, formatSize } from '../../../frame/format';
  import { canUse } from '../../../lib/entitlement';
  import { ImageBatch, type BatchItem } from '../../../lib/image/batch.svelte';
  import ImageBatchTool from '../../../lib/image/ImageBatchTool.svelte';
  import {
    readMetadata,
    removeMetadata,
    type CleanMode,
    type PhotoInfo,
  } from '../../../lib/image/metadata';
  import { makeZip } from '../../../lib/zip';

  const common = pick(FRAME_MESSAGES);
  const t = pick(MESSAGES);
  const MODES: CleanMode[] = ['all', 'location'];

  type Outcome =
    | { state: 'working' }
    /** 정보를 지운 결과 */
    | { state: 'done'; bytes: Uint8Array; name: string }
    /** 지울 정보가 없어 원본 그대로 */
    | { state: 'kept' }
    | { state: 'failed' };

  // HEIC(아이폰 사진)도 HEIC 그대로 정보 칸만 비운다 (photo-metadata.ts). 목록 썸네일은 브라우저가 못 읽으면 libheif로
  const batch = new ImageBatch({ heic: true });
  let mode: CleanMode = $state('all');
  let working = $state(false);
  /** 사진마다 읽은 정보. 읽는 중이면 'loading', 구조를 읽지 못했으면 'error' */
  let infos: Record<number, PhotoInfo | 'loading' | 'error'> = $state({});
  /** 사진마다 마지막으로 지운 결과와 그때의 방식 */
  let outcomes: Record<number, Outcome & { mode: CleanMode }> = $state({});

  const outcomeOf = (item: BatchItem) =>
    outcomes[item.id]?.mode === mode ? outcomes[item.id] : undefined;
  const infoOf = (item: BatchItem) => {
    const info = infos[item.id];
    return typeof info === 'object' ? info : undefined;
  };

  // 목록에 들어온 사진의 정보를 읽는다 (워커에서, 한 장씩)
  $effect(() => {
    for (const item of batch.ready) {
      if (infos[item.id] !== undefined) continue;
      infos[item.id] = 'loading';
      readMetadata(item.file).then(
        (info) => {
          if (batch.items.includes(item)) infos[item.id] = info;
        },
        () => {
          if (batch.items.includes(item)) infos[item.id] = 'error';
        },
      );
    }
  });

  const located = $derived(batch.ready.filter((item) => infoOf(item)?.location).length);
  /** HDR 밝기 정보나 움직이는 사진의 영상이 붙은 사진 수 (지우면 함께 빠진다) */
  const appended = $derived(batch.ready.filter((item) => infoOf(item)?.appended).length);

  /** 모든 사진을 지금 방식으로 처리했으면 그 결과 */
  const summary = $derived.by(() => {
    if (working || batch.ready.length === 0) return undefined;
    let failed = false;
    for (const item of batch.ready) {
      const outcome = outcomeOf(item);
      if (!outcome || outcome.state === 'working') return undefined;
      if (outcome.state === 'failed') failed = true;
    }
    const cleaned = batch.ready.filter((item) => outcomeOf(item)?.state === 'done');
    return { failed, cleaned };
  });

  const blocker = $derived.by(() => {
    if (batch.loading || batch.ready.some((item) => infos[item.id] === 'loading')) {
      return t.reading;
    }
    if (batch.ready.length === 0) return t.needOne;
    return undefined;
  });

  /** 지운 결과에 지우려던 정보가 정말 없는지 */
  function clean(info: PhotoInfo, cleaned: CleanMode): boolean {
    if (info.location) return false;
    return cleaned === 'location' || (info.date === undefined && info.device === undefined);
  }

  /** 원래 확장자를 그대로 쓴다 (형식이 바뀌지 않는다) */
  function resultName(item: BatchItem, cleaned: CleanMode): string {
    const extension = item.name.match(/\.[^.]+$/)?.[0] ?? '';
    return `${baseName(item.name)}_${t.suffix[cleaned]}${extension}`;
  }

  async function run() {
    if (blocker || working) return;
    const entitlement = await canUse('image/remove-location');
    if (!entitlement.allowed) return;

    const startedWith = mode;
    const targets = batch.ready.filter((item) => outcomeOf(item)?.state !== 'done');
    working = true;
    for (const item of targets) outcomes[item.id] = { state: 'working', mode: startedWith };
    for (const item of targets) {
      let outcome: Outcome;
      try {
        const { bytes, info } = await removeMetadata(item.file, startedWith);
        if (!clean(info, startedWith)) outcome = { state: 'failed' };
        else if (!bytes) outcome = { state: 'kept' };
        else outcome = { state: 'done', bytes, name: resultName(item, startedWith) };
      } catch {
        outcome = { state: 'failed' };
      }
      // 지우는 동안 목록에서 뺀 사진의 결과는 두지 않는다
      if (batch.items.includes(item)) outcomes[item.id] = { ...outcome, mode: startedWith };
    }
    working = false;
  }

  /** ZIP에 실제로 들어가는 장수 (실패한 사진은 빠진다) */
  const zipCount = $derived(
    batch.ready.filter((item) => {
      const state = outcomeOf(item)?.state;
      return state === 'done' || state === 'kept';
    }).length,
  );

  async function downloadAll() {
    const files = await Promise.all(
      batch.ready.map(async (item) => {
        const outcome = outcomeOf(item);
        // 지운 것은 결과를, 지울 것이 없던 것은 원본을 넣어 고른 사진이 모두 들어 있게 한다
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
    if (outcome?.state === 'done')
      downloadFile(outcome.bytes, outcome.name, item.file.type || 'application/octet-stream');
  }

  /** 지우기 전 줄 설명: 위치 · 찍은 날짜 · 기기 */
  function describe(info: PhotoInfo): string {
    const parts = [
      info.gps
        ? t.located(info.gps.latitude.toFixed(4), info.gps.longitude.toFixed(4))
        : info.location
          ? t.locatedUnknown
          : t.noLocation,
    ];
    if (info.date) parts.push(info.date);
    if (info.device) parts.push(info.device);
    return parts.join(' · ');
  }
</script>

<ImageBatchTool
  {batch}
  busy={working}
  hint={t.hint}
  broken={t.broken}
  onremove={(item) => {
    delete outcomes[item.id];
    delete infos[item.id];
  }}
>
  {#snippet bar()}
    <ActionBar label={t.bar}>
      {#snippet text()}
        {#if working}
          {t.working}
        {:else if summary && summary.failed}
          <strong>{t.failed}</strong>
        {:else if summary && summary.cleaned.length === 0}
          {t.nothing}
        {:else if summary}
          {t.done(summary.cleaned.length)}
        {:else}
          {blocker ?? t.ready(batch.ready.length, located)}
        {/if}
      {/snippet}
      {#if summary && summary.cleaned.length > 0 && batch.ready.length === 1}
        <button type="button" class="btn primary" onclick={() => downloadOne(summary.cleaned[0]!)}
          >{common.action.download}</button
        >
      {:else if summary && summary.cleaned.length > 0}
        <button type="button" class="btn primary" onclick={downloadAll}
          >{t.downloadAll(zipCount)}</button
        >
      {:else}
        <button
          type="button"
          class="btn primary"
          disabled={blocker !== undefined || working || summary !== undefined}
          onclick={run}>{working ? t.working : t.run}</button
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
    <p class="help">{t.modeHelp[mode]} {t.note}</p>
    {#if appended > 0}
      <p class="help"><strong>{t.appended(appended)}</strong></p>
    {/if}
  {/snippet}

  {#snippet meta(item: BatchItem)}
    {@const outcome = outcomeOf(item)}
    {@const info = infos[item.id]}
    {#if outcome?.state === 'working'}
      {t.itemWorking}
    {:else if outcome?.state === 'done'}
      {t.itemDone[outcome.mode](formatSize(item.file.size), formatSize(outcome.bytes.length))}
    {:else if outcome?.state === 'kept'}
      {t.itemKept}
    {:else if outcome?.state === 'failed' || info === 'error'}
      <strong>{t.itemFailed}</strong>
    {:else if typeof info === 'object'}
      {describe(info)}
    {:else}
      {t.infoReading}
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
