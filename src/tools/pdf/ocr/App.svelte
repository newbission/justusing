<!--
  PDF 글자 인식(OCR) 도구 화면 (격리 frame 안에서 실행).
  스캔한 쪽을 그림으로 그려 글자를 읽고, 원래 쪽 위에 보이지 않는 글자를 겹쳐 검색·복사가 되는 PDF를 만든다.
  인식 엔진·언어 데이터는 처음 한 번 받아(크기를 밝히고 묻는다) 이 브라우저에 보관한다.
  파일은 어디로도 전송되지 않는다.
-->
<script lang="ts">
  import '../../../frame/controls.css';
  import { frameLocale, pick } from '../../../frame/locale';
  import { FRAME_MESSAGES } from '../../../frame/messages';
  import { MESSAGES } from './messages';
  import ActionBar from '../../../frame/ActionBar.svelte';
  import { downloadFile } from '../../../frame/download';
  import { baseName } from '../../../frame/format';
  import { canUse } from '../../../lib/entitlement';
  import { modifyPdf } from '../../../lib/pdf/modify';
  import { renderPageBitmap } from '../../../lib/pdf/render-image';
  import SinglePdfTool, { type LoadedPdf } from '../../../lib/pdf/SinglePdfTool.svelte';
  import { OcrPool } from '../../../lib/ocr/ocr';
  import { OcrData } from '../../../lib/ocr/ocr-data.svelte';
  import OcrSetup from '../../../lib/ocr/OcrSetup.svelte';

  const common = pick(FRAME_MESSAGES);
  const t = pick(MESSAGES);

  /** 인식용으로 쪽을 그리는 해상도. 글자 인식은 300 DPI 안팎에서 가장 잘 된다 */
  const OCR_DPI = 300;

  let pdf: LoadedPdf | undefined = $state.raw();
  const ocr = new OcrData();
  let skipText = $state(true);

  const signature = $derived(`${ocr.chosen.join('+')}:${skipText}`);
  type Run =
    | { kind: 'idle' }
    | { kind: 'scanning' }
    | { kind: 'starting' }
    | { kind: 'working'; done: number; total: number }
    | { kind: 'saving' }
    | { kind: 'nothing' }
    | {
        kind: 'done';
        name: string;
        bytes: Uint8Array;
        text: string;
        pages: number;
        characters: number;
        signature: string;
      }
    | { kind: 'failed'; message: string };
  let run = $state<Run>({ kind: 'idle' });
  const busy = $derived(['scanning', 'starting', 'working', 'saving'].includes(run.kind));
  const result = $derived(run.kind === 'done' && run.signature === signature ? run : undefined);

  function onload(loaded: LoadedPdf) {
    pdf = loaded;
    run = { kind: 'idle' };
  }

  /**
   * 본문 글자가 이미 있는 쪽인지 (스캔본이 아닌 쪽). 스캔한 쪽에 쪽 번호·워터마크만 글자로 더한 경우는
   * 본문이 여전히 그림이므로 다시 읽는다
   */
  const TEXT_PAGE_MIN = 50;
  async function hasText(source: LoadedPdf, index: number) {
    const page = await source.doc.getPage(index + 1);
    const content = await page.getTextContent();
    page.cleanup();
    const characters = content.items
      .map((item) => ('str' in item ? item.str.replace(/\s/g, '').length : 0))
      .reduce((sum, count) => sum + count, 0);
    return characters >= TEXT_PAGE_MIN;
  }

  async function recognize() {
    if (!pdf || busy || !ocr.ready) return;
    const entitlement = await canUse('pdf/ocr');
    if (!entitlement.allowed) {
      run = { kind: 'failed', message: entitlement.reason ?? common.action.unavailable };
      return;
    }
    const source = pdf;
    const startedWith = signature;
    const chosen = ocr.chosen;
    const total = source.doc.numPages;
    let pool: OcrPool | undefined;
    try {
      run = { kind: 'scanning' };
      const indices: number[] = [];
      for (let index = 0; index < total; index++) {
        if (!skipText || !(await hasText(source, index))) indices.push(index);
        if (pdf !== source) return;
      }
      if (indices.length === 0) {
        run = { kind: 'nothing' };
        return;
      }

      run = { kind: 'starting' };
      pool = await OcrPool.create(await ocr.bytes(chosen), chosen, indices.length);
      if (pdf !== source) return;

      const layers: (Uint8Array | null)[] = Array.from({ length: total }, () => null);
      const texts = new Map<number, string>();
      run = { kind: 'working', done: 0, total: indices.length };
      // 쪽 그리기는 화면 스레드에서 한다 (pdf.js가 잘게 나눠 그려 화면을 막지 않는다).
      // 워커 여러 개가 한꺼번에 부탁해도 한 번에 한 쪽씩만 그려 화면이 버벅이지 않게 줄 세운다
      let drawing: Promise<unknown> = Promise.resolve();
      const render = (index: number) => {
        const next = drawing.then(async () =>
          renderPageBitmap(await source.doc.getPage(index + 1), OCR_DPI),
        );
        drawing = next.catch(() => {});
        return next;
      };
      await pool.run(indices, render, (index, page) => {
        layers[index] = page.layer;
        texts.set(index, page.text.trim());
        if (pdf === source && run.kind === 'working') {
          run = { kind: 'working', done: run.done + 1, total: run.total };
        }
      });
      pool.dispose();
      pool = undefined;
      if (pdf !== source) return;

      run = { kind: 'saving' };
      const out = await modifyPdf(source, { kind: 'text-layer', layers });
      if (pdf !== source) return;
      const text = indices
        .map((index) =>
          total > 1 ? `${t.pageMark(index + 1)}\n${texts.get(index)}` : texts.get(index),
        )
        .join('\n\n');
      run = {
        kind: 'done',
        name: `${baseName(source.name)}_${t.suffix}.pdf`,
        bytes: out,
        text,
        pages: indices.length,
        characters: [...texts.values()].join('').replace(/\s/g, '').length,
        signature: startedWith,
      };
    } catch {
      if (pdf !== source) return;
      run = { kind: 'failed', message: t.failed };
    } finally {
      pool?.dispose();
    }
  }

  function saveText() {
    if (!pdf || !result) return;
    // 메모장에서도 줄이 바뀌게 CRLF로, 한글이 깨지지 않게 UTF-8 BOM을 붙인다
    const body = '﻿' + result.text.replace(/\n/g, '\r\n');
    downloadFile(
      new TextEncoder().encode(body),
      `${baseName(pdf.name)}_${t.suffix}.txt`,
      'text/plain;charset=utf-8',
    );
  }
</script>

<SinglePdfTool {onload} saves>
  {#snippet children({ doc })}
    <ActionBar label={t.bar}>
      {#snippet text()}
        {#if run.kind === 'scanning'}
          {t.scanning}
        {:else if run.kind === 'starting'}
          {t.starting}
        {:else if run.kind === 'working'}
          {t.working(run.done, run.total)}
        {:else if run.kind === 'saving'}
          {t.saving}
        {:else if result}
          {t.done(result.pages, result.characters.toLocaleString(frameLocale))}
        {:else if run.kind === 'failed'}
          <strong>{run.message}</strong>
        {:else if run.kind === 'nothing'}
          {t.nothing}
        {:else if ocr.chosen.length === 0}
          {common.ocr.needLang}
        {:else if !ocr.ready}
          {common.ocr.needData}
        {:else}
          {t.ready(doc.numPages)}
        {/if}
      {/snippet}
      {#if result}
        <button type="button" class="btn" onclick={saveText}>{t.downloadText}</button>
        <button
          type="button"
          class="btn primary"
          onclick={() => downloadFile(result.bytes, result.name)}>{t.downloadPdf}</button
        >
      {:else}
        <button type="button" class="btn primary" disabled={busy || !ocr.ready} onclick={recognize}
          >{t.run}</button
        >
      {/if}
    </ActionBar>

    <div class="tool-body">
      <OcrSetup data={ocr} {busy}>
        <label class="check">
          <input type="checkbox" bind:checked={skipText} disabled={busy} />
          {t.skipText}
        </label>
      </OcrSetup>

      {#if result}
        <textarea readonly aria-label={t.textLabel} value={result.text}></textarea>
      {/if}
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
  textarea {
    width: 100%;
    min-height: 240px;
    padding: 12px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius);
    background: var(--color-bg);
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 1.6;
    resize: vertical;
  }
</style>
