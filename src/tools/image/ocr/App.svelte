<!--
  이미지 글자 추출(OCR) 도구 화면 (격리 frame 안에서 실행).
  사진·화면 캡처·스캔 이미지 여러 장에서 글자를 읽어 이미지마다 보여 주고, 복사하거나 TXT로 받게 한다.
  인식 엔진·언어 데이터는 PDF 글자 인식과 같은 묶음이라 한쪽에서 받았으면 다시 받지 않는다.
  이미지와 읽은 글자는 어디로도 전송되지 않는다.
-->
<script lang="ts">
  import '../../../frame/controls.css';
  import { onMount } from 'svelte';
  import { frameLocale, pick } from '../../../frame/locale';
  import { FRAME_MESSAGES } from '../../../frame/messages';
  import { MESSAGES } from './messages';
  import ActionBar from '../../../frame/ActionBar.svelte';
  import FileDrop from '../../../frame/FileDrop.svelte';
  import { onFrameFiles } from '../../../frame/drop';
  import { requestShowTool } from '../../../frame/parent';
  import { copyText } from '../../../frame/clipboard';
  import { downloadFile } from '../../../frame/download';
  import { baseName, formatSize } from '../../../frame/format';
  import { canUse } from '../../../lib/entitlement';
  import { ImageBatch, type BatchItem } from '../../../lib/image/batch.svelte';
  import { OcrPool, type ImageResult } from '../../../lib/ocr/ocr';
  import { OcrData } from '../../../lib/ocr/ocr-data.svelte';
  import OcrSetup from '../../../lib/ocr/OcrSetup.svelte';

  const common = pick(FRAME_MESSAGES);
  const t = pick(MESSAGES);

  const batch = new ImageBatch({ anyFormat: true });
  const ocr = new OcrData();
  let showBoxes = $state(true);

  type Outcome =
    | { state: 'working' }
    /** text: 고쳐 쓴 글자 (처음에는 읽은 그대로) */
    | ({ state: 'done'; text: string } & Omit<ImageResult, 'text'>)
    | { state: 'failed' };
  /** 이미지마다 마지막으로 읽은 결과와 그때 고른 언어 */
  let outcomes: Record<number, Outcome & { langs: string }> = $state({});
  const signature = $derived(ocr.chosen.join('+'));
  const outcomeOf = (item: BatchItem) =>
    outcomes[item.id]?.langs === signature ? outcomes[item.id] : undefined;

  type Phase =
    { kind: 'idle' } | { kind: 'starting' } | { kind: 'working'; done: number; total: number };
  let phase: Phase = $state({ kind: 'idle' });
  const busy = $derived(phase.kind !== 'idle');
  /** 엔진을 띄우지 못하는 등 전체가 실패했을 때 */
  let failure = $state(false);
  /** 복사했다는 안내 (잠깐 보여 준다) */
  let notice: string | undefined = $state();
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;

  /** 아직 읽지 않았거나 읽지 못한 이미지 */
  const pending = $derived(
    batch.ready.filter((item) => {
      const outcome = outcomeOf(item);
      return !outcome || outcome.state === 'failed';
    }),
  );
  const done = $derived(
    batch.ready.flatMap((item) => {
      const outcome = outcomeOf(item);
      return outcome?.state === 'done' ? [{ item, outcome }] : [];
    }),
  );
  const failedCount = $derived(
    batch.ready.filter((item) => outcomeOf(item)?.state === 'failed').length,
  );
  /** 모든 이미지를 지금 언어로 한 번씩 읽었는지 */
  const finished = $derived(
    !busy &&
      batch.ready.length > 0 &&
      batch.ready.every((item) => {
        const state = outcomeOf(item)?.state;
        return state === 'done' || state === 'failed';
      }),
  );

  const blocker = $derived.by(() => {
    if (batch.loading) return t.loading;
    if (batch.ready.length === 0) return t.needOne;
    if (ocr.chosen.length === 0) return common.ocr.needLang;
    if (!ocr.ready) return common.ocr.needData;
    return undefined;
  });

  function add(files: File[]) {
    const first = batch.items.length === 0;
    if (batch.add(files) && first) requestShowTool();
  }

  onMount(() =>
    onFrameFiles((files) => {
      if (!busy) add(files);
    }),
  );

  async function run() {
    if (busy || blocker) return;
    const entitlement = await canUse('image/ocr');
    if (!entitlement.allowed) return;
    const chosen = ocr.chosen;
    const langs = signature;
    const targets = [...pending];
    if (targets.length === 0) return;
    failure = false;
    notice = undefined;
    phase = { kind: 'starting' };
    for (const item of targets) outcomes[item.id] = { state: 'working', langs };
    let pool: OcrPool | undefined;
    try {
      pool = await OcrPool.create(await ocr.bytes(chosen), chosen, targets.length);
      phase = { kind: 'working', done: 0, total: targets.length };
      await pool.images(
        targets.map((item) => item.file),
        (index, result) => {
          const item = targets[index]!;
          outcomes[item.id] =
            result instanceof Error
              ? { state: 'failed', langs }
              : { state: 'done', langs, ...result };
          if (phase.kind === 'working') phase = { ...phase, done: phase.done + 1 };
        },
      );
    } catch {
      failure = true;
      for (const item of targets) {
        if (outcomes[item.id]?.state === 'working') outcomes[item.id] = { state: 'failed', langs };
      }
    } finally {
      pool?.dispose();
      phase = { kind: 'idle' };
    }
  }

  /** 여러 장이면 장마다 파일 이름 머리 줄을 붙여 하나로 합친다 */
  function combined(): string {
    if (done.length === 1) return done[0]!.outcome.text;
    return done
      .map(({ item, outcome }) => `${t.fileMark(item.name)}\n${outcome.text}`)
      .join('\n\n');
  }

  function say(message: string) {
    notice = message;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => (notice = undefined), 4000);
  }

  async function copy(text: string) {
    say((await copyText(text)) ? t.copied : t.copyFailed);
  }

  function saveText() {
    if (done.length === 0) return;
    // 메모장에서도 줄이 바뀌게 CRLF로, 한글이 깨지지 않게 UTF-8 BOM을 붙인다
    const body = '﻿' + combined().replace(/\r?\n/g, '\r\n');
    const name = done.length === 1 ? `${baseName(done[0]!.item.name)}_${t.suffix}.txt` : t.allName;
    downloadFile(new TextEncoder().encode(body), name, 'text/plain;charset=utf-8');
  }

  function edit(item: BatchItem, text: string) {
    const outcome = outcomes[item.id];
    if (outcome?.state === 'done') outcome.text = text;
  }

  const count = (text: string) => text.replace(/\s/g, '').length;
  const characters = $derived(
    done.reduce((sum, { outcome }) => sum + count(outcome.text), 0).toLocaleString(frameLocale),
  );

  function describe(item: BatchItem): string {
    const outcome = outcomeOf(item);
    if (!outcome) return `${item.width}×${item.height} · ${formatSize(item.file.size)}`;
    if (outcome.state === 'working') return t.itemWorking;
    if (outcome.state === 'failed') return t.itemFailed;
    if (!outcome.text.trim()) return t.itemEmpty;
    return t.itemDone(outcome.lines.length, count(outcome.text).toLocaleString(frameLocale));
  }

  function placeholder(item: BatchItem): string {
    const outcome = outcomeOf(item);
    if (!outcome) return t.placeholder.waiting;
    if (outcome.state === 'working') return t.placeholder.working;
    if (outcome.state === 'failed') return t.placeholder.failed;
    return t.placeholder.empty;
  }
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
      <label class="btn" class:disabled={busy}>
        {common.images.add}
        <input
          type="file"
          class="visually-hidden"
          accept={batch.accept}
          multiple
          disabled={busy}
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
        {#if notice}
          {notice}
        {:else if phase.kind === 'starting'}
          {t.starting}
        {:else if phase.kind === 'working'}
          {t.working(phase.done, phase.total)}
        {:else if failure}
          <strong>{t.failed}</strong>
        {:else if finished && done.length > 0}
          {t.done(done.length, characters)}
          {#if failedCount > 0}
            <strong>{t.someFailed(failedCount)}</strong>
          {/if}
        {:else if finished}
          <strong>{t.someFailed(failedCount)}</strong>
        {:else}
          {blocker ?? t.ready(pending.length)}
        {/if}
      {/snippet}
      {#if finished && done.length > 0}
        <button type="button" class="btn" onclick={() => copy(combined())}>{t.copyAll}</button>
        <button type="button" class="btn primary" onclick={saveText}>{t.downloadText}</button>
      {:else}
        <button
          type="button"
          class="btn primary"
          disabled={busy || blocker !== undefined}
          onclick={run}>{t.run}</button
        >
      {/if}
    </ActionBar>

    <div class="body">
      <div class="options">
        <OcrSetup data={ocr} {busy} />
        <div class="view">
          <p class="help">{t.tips}</p>
          <label class="check">
            <input type="checkbox" bind:checked={showBoxes} />
            {t.boxes}
          </label>
        </div>
      </div>

      <ul class="list" aria-label={common.images.list}>
        {#each batch.items as item (item.id)}
          {@const outcome = outcomeOf(item)}
          <li class="card">
            <div class="head">
              <div class="info">
                <span class="name" title={item.name}>{item.name}</span>
                <span class="meta">
                  {#if item.status === 'loading'}
                    {common.images.reading}
                  {:else if item.status === 'error'}
                    <strong>{t.broken}</strong>
                  {:else if outcome?.state === 'failed'}
                    <strong>{describe(item)}</strong>
                  {:else}
                    {describe(item)}
                  {/if}
                </span>
              </div>
              {#if outcome?.state === 'done' && outcome.text.trim()}
                <button
                  type="button"
                  class="btn"
                  onclick={() => copy(outcome.text)}
                  aria-label={t.copy(item.name)}>{t.copyShort}</button
                >
              {/if}
              <button
                type="button"
                class="btn icon"
                disabled={busy}
                onclick={() => {
                  batch.remove(item);
                  delete outcomes[item.id];
                }}
                aria-label={common.images.remove(item.name)}>×</button
              >
            </div>
            {#if item.status !== 'error'}
              <div class="content">
                <div class="picture">
                  {#if item.thumb}
                    <div class="figure">
                      <img src={item.thumb} alt="" />
                      {#if showBoxes && outcome?.state === 'done' && outcome.lines.length > 0}
                        <svg
                          viewBox="0 0 {outcome.width} {outcome.height}"
                          preserveAspectRatio="none"
                          role="img"
                          aria-label={t.boxesLabel(item.name)}
                        >
                          {#each outcome.lines as line, index (index)}
                            <polygon points={line.corners.join(' ')}
                              ><title>{line.text}</title></polygon
                            >
                          {/each}
                        </svg>
                      {/if}
                    </div>
                  {/if}
                </div>
                <textarea
                  aria-label={t.textLabel(item.name)}
                  placeholder={placeholder(item)}
                  readonly={outcome?.state !== 'done'}
                  value={outcome?.state === 'done' ? outcome.text : ''}
                  oninput={(event) => edit(item, event.currentTarget.value)}></textarea>
              </div>
            {/if}
          </li>
        {/each}
      </ul>
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
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
  .options {
    padding: 12px 16px 0;
    border-bottom: 1px solid var(--color-line);
  }
  .view {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 16px;
    margin-bottom: 12px;
  }
  .view .help {
    flex: 1 1 280px;
    margin: 0;
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
  .list {
    margin: 0;
    padding: 0 16px;
    list-style: none;
  }
  .card {
    padding: 12px 0 16px;
  }
  .card + .card {
    border-top: 1px solid var(--color-line);
  }
  .head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
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
  .head :global(.btn.icon) {
    font-size: 18px;
    line-height: 1;
  }
  /* 이미지와 읽은 글자를 나란히 (좁은 화면에서는 위아래). 높이를 고정해 읽기 전후로 목록이 흔들리지 않게 */
  .content {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
    gap: 12px;
  }
  .picture {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 260px;
    border-radius: var(--radius);
    background: var(--color-bg);
  }
  .figure {
    position: relative;
    max-width: 100%;
    max-height: 100%;
  }
  .figure img {
    display: block;
    max-width: 100%;
    max-height: 260px;
    box-shadow: var(--shadow-page);
  }
  .figure svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  polygon {
    fill: var(--color-accent);
    fill-opacity: 0.12;
    stroke: var(--color-accent);
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
  }
  textarea {
    width: 100%;
    height: 260px;
    padding: 12px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius);
    background: var(--color-bg);
    color: var(--color-text);
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 1.6;
    resize: vertical;
  }
  textarea[readonly] {
    color: var(--color-muted);
  }
  @media (max-width: 560px) {
    .content {
      grid-template-columns: minmax(0, 1fr);
    }
    .picture,
    textarea {
      height: 200px;
    }
    .figure img {
      max-height: 200px;
    }
  }
</style>
