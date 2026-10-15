<!--
  PDF를 이미지로 도구 화면 (격리 frame 안에서 실행).
  PDF의 쪽을 JPG·PNG 이미지로 뽑는다 (전체 추출 / 선택 추출). 파일은 어디로도 전송되지 않는다.
-->
<script lang="ts">
  import { pick } from '../../../frame/locale';
  import { FRAME_MESSAGES } from '../../../frame/messages';
  import { MESSAGES } from './messages';

  const common = pick(FRAME_MESSAGES);
  const t = pick(MESSAGES);
  import ActionBar from '../../../frame/ActionBar.svelte';
  import { downloadFile } from '../../../frame/download';
  import { canUse } from '../../../lib/entitlement';
  import { makeZip } from '../../../lib/zip';
  import PageSelectGrid from '../../../lib/pdf/PageSelectGrid.svelte';
  import { IMAGE_TYPES, renderPageImage, type ImageFormat } from '../../../lib/pdf/render-image';
  import SinglePdfTool, { type LoadedPdf } from '../../../lib/pdf/SinglePdfTool.svelte';

  let pdf: LoadedPdf | undefined = $state.raw();
  const pageCount = $derived(pdf?.doc.numPages ?? 0);

  type Mode = 'all' | 'select';
  /** short: 좁은 화면에서 쓰는 짧은 이름 (긴 이름은 두 줄로 깨진다) */
  const MODES: { id: Mode; label: string; short: string }[] = (['all', 'select'] as const).map(
    (id) => ({ id, ...t.modes[id] }),
  );
  let mode: Mode = $state('all');

  const FORMATS: ImageFormat[] = ['jpg', 'png'];
  let format: ImageFormat = $state('jpg');

  type Quality = 'standard' | 'high';
  const DPI: Record<Quality, number> = { standard: 150, high: 300 };
  const QUALITIES: { id: Quality; label: string; short: string }[] = (
    ['standard', 'high'] as const
  ).map((id) => ({ id, ...t.qualities[id] }));
  let quality: Quality = $state('standard');

  /** '선택 추출'에서 쪽마다 선택 여부 (index 0 = 1쪽) */
  let selected: boolean[] = $state([]);
  const selectedPages = $derived(selected.flatMap((on, index) => (on ? [index + 1] : [])));

  /** 이미지로 만들 쪽 번호(1부터) */
  const pages = $derived(
    mode === 'all' ? Array.from({ length: pageCount }, (_, i) => i + 1) : selectedPages,
  );

  type Run =
    | { kind: 'idle' }
    | { kind: 'working'; done: number; total: number }
    | { kind: 'done'; name: string; bytes: Uint8Array; type: string; signature: string }
    | { kind: 'failed'; message: string };
  let run = $state<Run>({ kind: 'idle' });

  /** 만들 내용. 만든 뒤 바뀌면 결과는 더 이상 맞지 않는다. */
  const signature = $derived(`${format}:${quality}:${pages.join(',')}`);
  const result = $derived(run.kind === 'done' && run.signature === signature ? run : undefined);

  /** 쪽 이미지 이름. 정렬되도록 앞에 0을 채운다 (01, 02 … 10) */
  function imageName(base: string, page: number, extension: ImageFormat) {
    return `${base}_${String(page).padStart(String(pageCount).length, '0')}.${extension}`;
  }

  async function convert() {
    if (!pdf || pages.length === 0 || run.kind === 'working') return;
    const entitlement = await canUse('pdf/to-image');
    if (!entitlement.allowed) {
      run = { kind: 'failed', message: entitlement.reason ?? common.action.unavailable };
      return;
    }

    const plan = pages;
    const startedWith = signature;
    const dpi = DPI[quality];
    // 처리하는 동안 고른 값을 바꿔도 처음 값으로 끝까지 만든다
    const chosen = format;
    const type = IMAGE_TYPES[chosen];
    /** 처리하는 동안 다른 파일을 열면 이 결과는 버린다 */
    const source = pdf;
    const base = source.name.replace(/\.pdf$/i, '');
    run = { kind: 'working', done: 0, total: plan.length };
    try {
      const images: { name: string; bytes: Uint8Array }[] = [];
      for (const number of plan) {
        const page = await source.doc.getPage(number);
        const bytes = await renderPageImage(page, dpi, chosen);
        if (pdf !== source) return;
        images.push({ name: imageName(base, number, chosen), bytes });
        run = { kind: 'working', done: images.length, total: plan.length };
      }
      run =
        images.length === 1
          ? { kind: 'done', ...images[0]!, type, signature: startedWith }
          : {
              kind: 'done',
              name: `${base}_${t.zipSuffix}.zip`,
              bytes: makeZip(images),
              type: 'application/zip',
              signature: startedWith,
            };
    } catch {
      if (pdf !== source) return;
      run = { kind: 'failed', message: t.failed };
    }
  }

  function formatSize(size: number) {
    return size < 1024 * 1024
      ? `${Math.max(1, Math.round(size / 1024))}KB`
      : `${(size / 1024 / 1024).toFixed(1)}MB`;
  }

  function selectAll(on: boolean) {
    selected = Array.from({ length: pageCount }, () => on);
  }

  function onload(loaded: LoadedPdf) {
    pdf = loaded;
    run = { kind: 'idle' };
    selectAll(false);
  }
</script>

<SinglePdfTool {onload}>
  {#snippet children({ doc })}
    <ActionBar label={t.bar}>
      {#snippet text()}
        {#if run.kind === 'working'}
          {t.working(run.done, run.total)}
        {:else if result}
          {common.action.done(result.name, formatSize(result.bytes.length))}
        {:else if run.kind === 'failed'}
          <strong>{run.message}</strong>
        {:else if pages.length === 0}
          {t.pickPages}
        {:else if pages.length === 1}
          {t.oneFile}
        {:else}
          {t.manyFiles(pages.length)}
        {/if}
      {/snippet}
      {#if result}
        <button
          type="button"
          class="primary"
          onclick={() => downloadFile(result.bytes, result.name, result.type)}
          >{common.action.download}</button
        >
      {:else}
        <button
          type="button"
          class="primary"
          disabled={pages.length === 0 || run.kind === 'working'}
          onclick={convert}>{run.kind === 'working' ? t.workingShort : t.run}</button
        >
      {/if}
    </ActionBar>

    <div class="body">
      <div class="options">
        <div class="choice" role="radiogroup" aria-label={t.modeGroup}>
          {#each MODES as option (option.id)}
            <label class:checked={mode === option.id}>
              <input type="radio" name="mode" value={option.id} bind:group={mode} />
              <span class="long">{option.label}</span>
              <span class="short">{option.short}</span>
            </label>
          {/each}
        </div>
        <div class="choice" role="radiogroup" aria-label={t.formatGroup}>
          {#each FORMATS as option (option)}
            <label class:checked={format === option}>
              <input type="radio" name="format" value={option} bind:group={format} />
              {option.toUpperCase()}
            </label>
          {/each}
        </div>
        <div class="choice" role="radiogroup" aria-label={t.qualityGroup}>
          {#each QUALITIES as option (option.id)}
            <label class:checked={quality === option.id}>
              <input type="radio" name="quality" value={option.id} bind:group={quality} />
              <span class="long">{option.label}</span>
              <span class="short">{option.short}</span>
            </label>
          {/each}
        </div>
      </div>
      <p class="help format-help">{t.formatHelp}</p>

      {#if mode === 'all'}
        <p class="help mode-help">{t.allHelp(pageCount)}</p>
        <PageSelectGrid {doc} size={88} />
      {:else}
        <div class="select-bar">
          <p class="help" aria-live="polite">{t.selectHelp(selectedPages.length)}</p>
          <button type="button" class="text" onclick={() => selectAll(true)}>{t.selectAll}</button>
          <button type="button" class="text" onclick={() => selectAll(false)}>{t.selectNone}</button
          >
        </div>
        <PageSelectGrid {doc} bind:selected size={88} />
      {/if}
    </div>
  {/snippet}
</SinglePdfTool>

<style>
  button {
    flex: none;
    height: 32px;
    min-width: 32px;
    padding: 0 10px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius);
    background: transparent;
    white-space: nowrap;
    cursor: pointer;
    transition:
      background-color 0.12s,
      border-color 0.12s;
  }
  button:hover:not(:disabled) {
    border-color: var(--color-muted);
    background: var(--color-hover);
  }
  button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  button.text {
    font-size: 14px;
  }
  button.primary {
    min-width: 120px;
    height: 40px;
    padding: 0 20px;
    border-color: var(--color-text);
    background: var(--color-text);
    color: var(--color-bg);
    font-weight: 600;
  }
  button.primary:hover:not(:disabled) {
    border-color: var(--color-accent);
    background: var(--color-accent);
  }

  .body {
    flex: 1;
    padding: 16px;
    overflow: auto;
  }
  .options {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
  /* 추출 방식·형식·화질: 라디오 버튼을 붙은 버튼 모양으로 (방향키로도 바뀐다, pdf/split과 같은 모양) */
  .choice {
    display: inline-flex;
    border: 1px solid var(--color-line);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .choice label {
    padding: 8px 14px;
    font-size: 14px;
    white-space: nowrap;
    cursor: pointer;
    transition: background-color 0.12s;
  }
  .choice label + label {
    border-left: 1px solid var(--color-line);
  }
  .choice label:hover {
    background: var(--color-hover);
  }
  .choice label.checked {
    background: var(--color-text);
    color: var(--color-bg);
    font-weight: 600;
  }
  .choice label:has(input:focus-visible) {
    outline: 2px solid var(--color-accent);
    outline-offset: -2px;
  }
  .choice input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .choice .short {
    display: none;
  }
  /* 좁은 화면: 짧은 이름으로 */
  @media (max-width: 520px) {
    .choice .long {
      display: none;
    }
    .choice .short {
      display: inline;
    }
  }
  .format-help {
    margin: 8px 0 20px;
  }
  .mode-help {
    margin-bottom: 20px;
  }
  .select-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-bottom: 20px;
  }
  .select-bar .help {
    flex: 1 1 240px;
  }
  .help {
    margin: 0;
    color: var(--color-muted);
    font-size: 13px;
  }
</style>
