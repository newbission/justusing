<!--
  PDF 글자 인식(OCR) 도구 화면 (격리 frame 안에서 실행).
  스캔한 쪽을 그림으로 그려 글자를 읽고, 원래 쪽 위에 보이지 않는 글자를 겹쳐 검색·복사가 되는 PDF를 만든다.
  인식 엔진·언어 데이터는 처음 한 번 받아(크기를 밝히고 묻는다) 이 브라우저에 보관한다.
  파일은 어디로도 전송되지 않는다.
-->
<script lang="ts">
  import '../../../frame/controls.css';
  import { untrack } from 'svelte';
  import { frameLocale, pick } from '../../../frame/locale';
  import { FRAME_MESSAGES } from '../../../frame/messages';
  import { MESSAGES } from './messages';
  import ActionBar from '../../../frame/ActionBar.svelte';
  import { dataStatus, loadData } from '../../../frame/data';
  import { downloadFile } from '../../../frame/download';
  import { baseName, formatSize } from '../../../frame/format';
  import { canUse } from '../../../lib/entitlement';
  import { modifyPdf } from '../../../lib/pdf/modify';
  import { renderPageBitmap } from '../../../lib/pdf/render-image';
  import SinglePdfTool, { type LoadedPdf } from '../../../lib/pdf/SinglePdfTool.svelte';
  import { OCR_CONSENT, OCR_LANGS, OcrPool, ocrFiles, type OcrLang } from '../../../lib/ocr/ocr';

  const common = pick(FRAME_MESSAGES);
  const t = pick(MESSAGES);

  /** 인식용으로 쪽을 그리는 해상도. 글자 인식은 300 DPI 안팎에서 가장 잘 된다 */
  const OCR_DPI = 300;

  let pdf: LoadedPdf | undefined = $state.raw();
  /** 한국어 화면은 한국어+영어, 영어 화면은 영어부터 */
  let langs: OcrLang[] = $state(frameLocale === 'ko' ? ['kor', 'eng'] : ['eng']);
  let skipText = $state(true);

  const files = $derived(ocrFiles(OCR_LANGS.filter((lang) => langs.includes(lang))));
  const totalBytes = $derived(files.reduce((sum, file) => sum + file.bytes, 0));

  type Data =
    | { kind: 'checking' }
    | { kind: 'missing'; removed: boolean; lowSpace: boolean }
    | { kind: 'downloading'; percent: number }
    | { kind: 'failed' }
    | { kind: 'ready' };
  let data = $state<Data>({ kind: 'checking' });

  // 고른 언어의 데이터가 보관돼 있는지 확인한다. 없으면 받지 않고 묻는다 (와이파이인지 알 수 없다)
  $effect(() => {
    const wanted = files;
    const bytes = totalBytes;
    if (wanted.length < 2) return;
    let current = true;
    untrack(() => (data = { kind: 'checking' }));
    dataStatus(wanted, OCR_CONSENT).then((status) => {
      if (!current) return;
      const lowSpace = status.available !== undefined && status.available < bytes * 2;
      data = wanted.every((file) => status.cached.has(file.path))
        ? { kind: 'ready' }
        : { kind: 'missing', removed: status.consented, lowSpace };
    });
    return () => {
      current = false;
    };
  });

  async function download() {
    const wanted = files;
    data = { kind: 'downloading', percent: 0 };
    try {
      await loadData(wanted, OCR_CONSENT, (received) => {
        if (files !== wanted) return;
        data = {
          kind: 'downloading',
          percent: Math.min(99, Math.floor((received / totalBytes) * 100)),
        };
      });
      if (files === wanted) data = { kind: 'ready' };
    } catch {
      if (files === wanted) data = { kind: 'failed' };
    }
  }

  const signature = $derived(`${langs.join('+')}:${skipText}`);
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
    if (!pdf || busy || data.kind !== 'ready' || langs.length === 0) return;
    const entitlement = await canUse('pdf/ocr');
    if (!entitlement.allowed) {
      run = { kind: 'failed', message: entitlement.reason ?? common.action.unavailable };
      return;
    }
    const source = pdf;
    const startedWith = signature;
    const chosen = OCR_LANGS.filter((lang) => langs.includes(lang));
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
      const bytes = await loadData(ocrFiles(chosen), OCR_CONSENT);
      pool = await OcrPool.create(bytes, chosen, indices.length);
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

<SinglePdfTool {onload}>
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
        {:else if langs.length === 0}
          {t.needLang}
        {:else if data.kind !== 'ready'}
          {t.needData}
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
        <button
          type="button"
          class="btn primary"
          disabled={busy || data.kind !== 'ready' || langs.length === 0}
          onclick={recognize}>{t.run}</button
        >
      {/if}
    </ActionBar>

    <div class="tool-body">
      <div class="choices">
        <fieldset class="langs">
          <legend>{t.langGroup}</legend>
          {#each OCR_LANGS as lang (lang)}
            <label class="check">
              <input
                type="checkbox"
                value={lang}
                bind:group={langs}
                disabled={busy || data.kind === 'downloading'}
              />
              {t.langs[lang]}
            </label>
          {/each}
        </fieldset>
        <label class="check">
          <input type="checkbox" bind:checked={skipText} disabled={busy} />
          {t.skipText}
        </label>
      </div>

      {#if langs.length > 0}
        <section class="data" aria-label={t.dataTitle}>
          {#if data.kind === 'ready'}
            <p>{t.dataReady}</p>
          {:else if data.kind === 'checking'}
            <p>{t.checking}</p>
          {:else}
            <h2>{t.dataTitle}</h2>
            {#if data.kind === 'missing' && data.removed}
              <p><strong>{t.dataRemoved}</strong></p>
            {/if}
            <p>{t.dataSize(formatSize(totalBytes))}</p>
            <p class="help">{t.dataNote}</p>
            {#if data.kind === 'missing' && data.lowSpace}
              <p class="help">{t.lowSpace}</p>
            {/if}
            {#if data.kind === 'failed'}
              <p><strong>{t.dataFailed}</strong></p>
            {/if}
            <button
              type="button"
              class="btn primary"
              disabled={data.kind === 'downloading'}
              onclick={download}
              >{data.kind === 'downloading'
                ? t.downloading(data.percent)
                : t.download(formatSize(totalBytes))}</button
            >
          {/if}
        </section>
      {/if}

      {#if result}
        <textarea readonly aria-label={t.textLabel} value={result.text}></textarea>
      {/if}
    </div>
  {/snippet}
</SinglePdfTool>

<style>
  .langs {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    margin: 0;
    padding: 0;
    border: 0;
  }
  .langs legend {
    float: left;
    margin-right: 4px;
    font-size: 14px;
    color: var(--color-muted);
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
  .data {
    margin: 16px 0;
    padding: 16px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius);
  }
  .data h2 {
    margin: 0 0 8px;
    font-size: 15px;
  }
  .data p {
    margin: 0 0 8px;
    font-size: 14px;
  }
  .data .btn {
    margin-top: 4px;
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
