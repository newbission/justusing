<!--
  PDF 모아찍기 도구 화면 (격리 frame 안에서 실행).
  한 장에 2·4·6·9쪽을 모아 새 PDF를 만든다. 첫 장이 어떻게 보일지 쪽 그림으로 미리 보여 준다.
  파일은 어디로도 전송되지 않는다.
-->
<script lang="ts">
  import '../../../frame/controls.css';
  import { frameLocale, pick } from '../../../frame/locale';
  import { FRAME_MESSAGES } from '../../../frame/messages';
  import { MESSAGES } from './messages';
  import ActionBar from '../../../frame/ActionBar.svelte';
  import { downloadFile } from '../../../frame/download';
  import { baseName, formatSize } from '../../../frame/format';
  import { canUse } from '../../../lib/entitlement';
  import { modifyPdf, type NUpCount, type PaperSize } from '../../../lib/pdf/modify';
  import SinglePdfTool, { type LoadedPdf } from '../../../lib/pdf/SinglePdfTool.svelte';
  import Thumbnail from '../../../lib/pdf/Thumbnail.svelte';
  import type { PDFPageProxy } from '../../../lib/pdf/pdfjs';

  const common = pick(FRAME_MESSAGES);
  const t = pick(MESSAGES);

  const COUNTS: NUpCount[] = [2, 4, 6, 9];
  const PAPERS: PaperSize[] = ['a4', 'letter'];
  /** 쪽 수 → [가로 칸, 세로 칸, 종이를 눕히는지] (워커와 같다) */
  const GRID: Record<NUpCount, [number, number, boolean]> = {
    2: [2, 1, true],
    4: [2, 2, false],
    6: [3, 2, true],
    9: [3, 3, false],
  };

  let pdf: LoadedPdf | undefined = $state.raw();
  let perSheet: NUpCount = $state(4);
  /** 영어 화면은 미국 기본 종이(Letter)부터 */
  let paper: PaperSize = $state(frameLocale === 'en' ? 'letter' : 'a4');
  let border = $state(false);

  const signature = $derived(`${perSheet}:${paper}:${border}`);
  type Run =
    | { kind: 'idle' }
    | { kind: 'working' }
    | { kind: 'done'; name: string; bytes: Uint8Array; signature: string }
    | { kind: 'failed'; message: string };
  let run = $state<Run>({ kind: 'idle' });
  const result = $derived(run.kind === 'done' && run.signature === signature ? run : undefined);

  function onload(loaded: LoadedPdf) {
    pdf = loaded;
    run = { kind: 'idle' };
  }

  async function combine() {
    if (!pdf || run.kind === 'working') return;
    const entitlement = await canUse('pdf/n-up');
    if (!entitlement.allowed) {
      run = { kind: 'failed', message: entitlement.reason ?? common.action.unavailable };
      return;
    }
    const source = pdf;
    const startedWith = signature;
    run = { kind: 'working' };
    try {
      const bytes = await modifyPdf(source, { kind: 'n-up', perSheet, paper, border });
      if (pdf !== source) return;
      run = {
        kind: 'done',
        name: `${baseName(source.name)}_${t.suffix}.pdf`,
        bytes,
        signature: startedWith,
      };
    } catch {
      if (pdf !== source) return;
      run = { kind: 'failed', message: t.failed };
    }
  }

  const grid = $derived(GRID[perSheet]);
  /** 종이 비율 (가로/세로, 세로 기준). 워커의 종이 크기와 같다 */
  const PAPER_RATIO: Record<PaperSize, number> = { a4: 595.28 / 841.89, letter: 612 / 792 };
  const sheetRatio = $derived(grid[2] ? 1 / PAPER_RATIO[paper] : PAPER_RATIO[paper]);
  /** 미리보기 종이 크기 (px). 칸 크기를 계산해 쪽 그림이 칸을 채우게 한다 */
  let sheetWidth = $state(0);
  let sheetHeight = $state(0);
  const SHEET_PADDING = 12;
  const SHEET_GAP = 6;
  const cellWidth = $derived(
    (sheetWidth - SHEET_PADDING * 2 - SHEET_GAP * (grid[0] - 1)) / grid[0],
  );
  const cellHeight = $derived(
    (sheetHeight - SHEET_PADDING * 2 - SHEET_GAP * (grid[1] - 1)) / grid[1],
  );
  /** 쪽을 칸에 맞췄을 때 긴 변 길이 (Thumbnail의 size) */
  function fitSize(page: PDFPageProxy) {
    const { width, height } = page.getViewport({ scale: 1 });
    const scale = Math.min(cellWidth / width, cellHeight / height);
    return Math.max(16, Math.floor(scale * Math.max(width, height)));
  }
</script>

<SinglePdfTool {onload}>
  {#snippet children({ doc })}
    {@const sheets = Math.ceil(doc.numPages / perSheet)}
    {@const firstCount = Math.min(perSheet, doc.numPages)}
    <ActionBar label={t.bar}>
      {#snippet text()}
        {#if run.kind === 'working'}
          {t.working}
        {:else if result}
          {common.action.done(result.name, formatSize(result.bytes.length))}
        {:else if run.kind === 'failed'}
          <strong>{run.message}</strong>
        {:else}
          {t.ready(doc.numPages, sheets)}
        {/if}
      {/snippet}
      {#if result}
        <button
          type="button"
          class="btn primary"
          onclick={() => downloadFile(result.bytes, result.name)}>{common.action.download}</button
        >
      {:else}
        <button
          type="button"
          class="btn primary"
          disabled={run.kind === 'working'}
          onclick={combine}>{run.kind === 'working' ? t.working : t.run}</button
        >
      {/if}
    </ActionBar>

    <div class="tool-body">
      <div class="choices">
        <div class="choice" role="radiogroup" aria-label={t.countGroup}>
          {#each COUNTS as option (option)}
            <label class:checked={perSheet === option}>
              <input type="radio" name="count" value={option} bind:group={perSheet} />
              {t.counts[option]}
            </label>
          {/each}
        </div>
        <div class="choice" role="radiogroup" aria-label={t.paperGroup}>
          {#each PAPERS as option (option)}
            <label class:checked={paper === option}>
              <input type="radio" name="paper" value={option} bind:group={paper} />
              {t.papers[option]}
            </label>
          {/each}
        </div>
        <label class="check">
          <input type="checkbox" bind:checked={border} />
          {t.border}
        </label>
      </div>

      <p class="help">{t.preview}</p>
      <figure class="sheet-wrap">
        <div
          class="sheet"
          class:landscape={grid[2]}
          style:grid-template-columns="repeat({grid[0]}, 1fr)"
          style:grid-template-rows="repeat({grid[1]}, 1fr)"
          style:aspect-ratio={sheetRatio}
          bind:clientWidth={sheetWidth}
          bind:clientHeight={sheetHeight}
          aria-label={t.sheetLabel(1, firstCount)}
          role="img"
        >
          {#each Array.from({ length: perSheet }, (_, i) => i) as slot (`${perSheet}-${slot}`)}
            <div class="cell" class:border>
              {#if slot < doc.numPages}
                {#await doc.getPage(slot + 1) then page}
                  {#if sheetWidth > 0}
                    <Thumbnail {page} size={fitSize(page)} />
                  {/if}
                {/await}
              {/if}
            </div>
          {/each}
        </div>
      </figure>
    </div>
  {/snippet}
</SinglePdfTool>

<style>
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
  .sheet-wrap {
    display: flex;
    justify-content: center;
    margin: 0;
  }
  /* 종이 모양 (A4 비율), 칸 사이·가장자리 간격은 워커와 비슷하게 */
  .sheet {
    display: grid;
    gap: 6px; /* SHEET_GAP */
    width: min(100%, 320px);
    padding: 12px; /* SHEET_PADDING */
    background: var(--color-paper);
    box-shadow: var(--shadow-page);
  }
  .sheet.landscape {
    width: min(100%, 440px);
  }
  .cell {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }
  .cell.border :global(canvas) {
    outline: 1px solid var(--color-line);
  }
</style>
