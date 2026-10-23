<!--
  이미지를 JPG·PNG·WebP로 바꾸는 화면 (격리 frame 안에서 실행). 형식 변환·HEIC 변환 도구가 문구만 바꿔 같이 쓴다.
  읽을 수 있는 이미지(JPG·PNG·WebP·GIF·BMP·AVIF, HEIC 등)를 받는다. HEIC는 브라우저가 못 읽으면 libheif로 연다.
  여러 장은 워커 여러 개가 나눠 처리한다. 파일은 어디로도 전송되지 않는다.
-->
<script lang="ts" module>
  import type { OutputType } from './process';

  /** 도구가 넘기는 화면 문구 (도구 폴더의 messages.ts) */
  export interface ConvertMessages {
    hint: string;
    bar: string;
    formatGroup: string;
    formats: Record<OutputType, string>;
    help: Record<OutputType, string>;
    gifNote: string;
    reading: string;
    needOne: string;
    ready: (count: number, format: string) => string;
    working: (done: number, total: number) => string;
    workingShort: string;
    run: string;
    done: (count: number) => string;
    failed: string;
    downloadAll: (count: number) => string;
    zipName: string;
    itemPlan: (size: string, from: string, to: string) => string;
    itemWorking: string;
    itemDone: (to: string, size: string) => string;
    itemFailed: string;
    noWebp: string;
    unreadable: string;
    /** 설정 아래 늘 보이는 안내 (HEIC 변환: 대표 사진만, 촬영 정보 없음) */
    note?: string;
  }
</script>

<script lang="ts">
  import { pick } from '../../frame/locale';
  import { FRAME_MESSAGES } from '../../frame/messages';
  import ActionBar from '../../frame/ActionBar.svelte';
  import { downloadFile } from '../../frame/download';
  import { baseName, formatSize } from '../../frame/format';
  import { canUse } from '../entitlement';
  import { EXTENSIONS, ImageBatch, type BatchItem } from './batch.svelte';
  import ImageBatchTool from './ImageBatchTool.svelte';
  import { ImageProcessError, processImage } from './process';
  import { makeZip } from '../zip';

  interface Props {
    /** 이용 권한을 물을 도구 ID */
    tool: string;
    t: ConvertMessages;
    /** 파일 고르기 창에 넘길 형식. 없으면 모든 이미지 */
    accept?: string;
  }

  let { tool, t, accept }: Props = $props();

  const common = pick(FRAME_MESSAGES);

  /** JPG·WebP 화질. 형식만 바꾸는 도구라 눈에 띄는 손실이 없게 높게 둔다 */
  const QUALITY = 0.92;
  const FORMATS: OutputType[] = ['image/jpeg', 'image/png', 'image/webp'];

  type Outcome =
    | { state: 'working' }
    | { state: 'done'; bytes: Uint8Array; name: string }
    | { state: 'failed'; reason: 'decode' | 'encode' };

  // 받을 형식은 도구마다 정해져 바뀌지 않는다 (처음 값만 쓴다)
  // svelte-ignore state_referenced_locally
  const batch = new ImageBatch({ anyFormat: true, accept });
  let format: OutputType = $state('image/jpeg');
  let working = $state(false);
  let outcomes: Record<number, Outcome & { format: OutputType }> = $state({});

  const outcomeOf = (item: BatchItem) =>
    outcomes[item.id]?.format === format ? outcomes[item.id] : undefined;

  const hasGif = $derived(batch.items.some((item) => /\.gif$/i.test(item.name)));

  const blocker = $derived.by(() => {
    if (batch.loading) return t.reading;
    if (batch.ready.length === 0) return t.needOne;
    return undefined;
  });

  /** 모든 이미지를 지금 형식으로 바꿨으면 그 결과 */
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

  /** 목록에 보일 원래 형식 (확장자 기준, 예: HEIC) */
  function sourceLabel(item: BatchItem): string {
    const extension = /\.([a-z0-9]+)$/i.exec(item.name)?.[1]?.toUpperCase();
    if (extension === 'JPEG') return 'JPG';
    return extension ?? item.file.type.replace('image/', '').toUpperCase();
  }

  async function convert() {
    if (blocker || working) return;
    const entitlement = await canUse(tool);
    if (!entitlement.allowed) return;

    const target = format;
    const targets = batch.ready.filter((item) => outcomeOf(item)?.state !== 'done');
    working = true;
    for (const item of targets) outcomes[item.id] = { state: 'working', format: target };
    await Promise.all(
      targets.map(async (item) => {
        let outcome: Outcome;
        try {
          const { bytes } = await processImage(item.file, {
            type: target,
            quality: QUALITY,
            pngColors: 0,
          });
          outcome = { state: 'done', bytes, name: `${baseName(item.name)}.${EXTENSIONS[target]}` };
        } catch (error) {
          outcome = {
            state: 'failed',
            reason: error instanceof ImageProcessError ? error.reason : 'encode',
          };
        }
        outcomes[item.id] = { ...outcome, format: target };
      }),
    );
    working = false;
  }

  function downloadOne(item: BatchItem) {
    const outcome = outcomeOf(item);
    if (outcome?.state === 'done') downloadFile(outcome.bytes, outcome.name, format);
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
</script>

<ImageBatchTool
  {batch}
  busy={working}
  hint={t.hint}
  broken={t.unreadable}
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
        {:else}
          {blocker ?? t.ready(batch.ready.length, t.formats[format])}
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
          onclick={convert}>{working ? t.workingShort : t.run}</button
        >
      {/if}
    </ActionBar>
  {/snippet}

  {#snippet options()}
    <div class="choice" role="radiogroup" aria-label={t.formatGroup}>
      {#each FORMATS as option (option)}
        <label class:checked={format === option}>
          <input type="radio" name="format" value={option} bind:group={format} disabled={working} />
          {t.formats[option]}
        </label>
      {/each}
    </div>
    <p class="help">{t.help[format]} {t.note ?? ''} {hasGif ? t.gifNote : ''}</p>
  {/snippet}

  {#snippet meta(item: BatchItem)}
    {@const outcome = outcomeOf(item)}
    {#if outcome?.state === 'working'}
      {t.itemWorking}
    {:else if outcome?.state === 'done'}
      {t.itemDone(t.formats[format], formatSize(outcome.bytes.length))}
    {:else if outcome?.state === 'failed'}
      <strong
        >{outcome.reason === 'encode' && format === 'image/webp' ? t.noWebp : t.itemFailed}</strong
      >
    {:else}
      {t.itemPlan(formatSize(item.file.size), sourceLabel(item), t.formats[format])}
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
