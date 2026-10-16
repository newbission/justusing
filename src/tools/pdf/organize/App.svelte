<!--
  PDF 페이지 정리 도구 화면 (격리 frame 안에서 실행).
  페이지 순서를 바꾸고 필요 없는 쪽을 빼서 새 PDF로 받는다. 파일은 어디로도 전송되지 않는다.
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
  import { assemblePdf } from '../../../lib/pdf/assemble';
  import PageGrid, { type GridPage } from '../../../lib/pdf/PageGrid.svelte';
  import SinglePdfTool, { type LoadedPdf } from '../../../lib/pdf/SinglePdfTool.svelte';

  let pdf: LoadedPdf | undefined = $state.raw();
  const pageCount = $derived(pdf?.doc.numPages ?? 0);

  /** 결과에 넣을 페이지 순서와 제외 여부 (PageGrid가 바꾼다) */
  let pages: GridPage[] = $state([]);
  const keptCount = $derived(pages.filter((page) => !page.excluded).length);
  const reordered = $derived(pages.some((page, position) => page.index !== position));
  const changed = $derived(reordered || keptCount !== pageCount);

  type Run =
    | { kind: 'idle' }
    | { kind: 'working' }
    | { kind: 'done'; name: string; bytes: Uint8Array; signature: string }
    | { kind: 'failed'; message: string };
  let run = $state<Run>({ kind: 'idle' });

  /** 결과에 넣을 쪽 순서. 정리한 뒤 바뀌면 결과는 더 이상 맞지 않는다. */
  const signature = $derived(
    pages
      .filter((page) => !page.excluded)
      .map((page) => page.index)
      .join(','),
  );
  const result = $derived(run.kind === 'done' && run.signature === signature ? run : undefined);
  /** 실행할 수 없을 때 그 이유 */
  const problem = $derived(keptCount === 0 ? t.noneKept : !changed ? t.unchanged : undefined);

  async function organize() {
    if (!pdf || problem || run.kind === 'working') return;
    const entitlement = await canUse('pdf/organize');
    if (!entitlement.allowed) {
      run = { kind: 'failed', message: entitlement.reason ?? common.action.unavailable };
      return;
    }

    const startedWith = signature;
    /** 처리하는 동안 다른 파일을 열면 이 결과는 버린다 */
    const source = pdf;
    run = { kind: 'working' };
    try {
      const output = await assemblePdf({
        sources: [{ bytes: source.bytes, password: source.password }],
        pages: pages.filter((page) => !page.excluded).map(({ index }) => ({ source: 0, index })),
      });
      if (pdf !== source) return;
      const base = source.name.replace(/\.pdf$/i, '');
      run = {
        kind: 'done',
        name: `${base}_${t.suffix}.pdf`,
        bytes: output,
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

  /** 처음 상태(원래 순서, 모두 넣음)로 */
  function resetPages() {
    pages = Array.from({ length: pageCount }, (_, index) => ({ index, excluded: false }));
  }

  function onload(loaded: LoadedPdf) {
    pdf = loaded;
    run = { kind: 'idle' };
    resetPages();
  }
</script>

<SinglePdfTool {onload} saves>
  {#snippet children({ doc, name })}
    <ActionBar label={t.bar}>
      {#snippet text()}
        {#if run.kind === 'working'}
          {t.working}
        {:else if result}
          {common.action.done(result.name, formatSize(result.bytes.length))}
        {:else if run.kind === 'failed'}
          <strong>{run.message}</strong>
        {:else if problem}
          {problem}
        {:else}
          {t.willMake(keptCount)}
        {/if}
      {/snippet}
      {#if result}
        <button
          type="button"
          class="primary"
          onclick={() => downloadFile(result.bytes, result.name)}>{common.action.download}</button
        >
      {:else}
        <button
          type="button"
          class="primary"
          disabled={problem !== undefined || run.kind === 'working'}
          onclick={organize}>{run.kind === 'working' ? t.working : t.run}</button
        >
      {/if}
    </ActionBar>

    <div class="body">
      <div class="summary">
        <span class="help" aria-live="polite">
          {#if changed}
            {t.summary(pageCount, keptCount, reordered)}
          {:else}
            {t.hint}
          {/if}
        </span>
        <button type="button" class="text" disabled={!changed} onclick={resetPages}
          >{common.action.reset}</button
        >
      </div>
      <PageGrid {doc} bind:pages label={name} size={112} />
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
  .summary {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
  }
  .summary .help {
    flex: 1 1 200px;
    color: var(--color-muted);
    font-size: 13px;
  }
</style>
