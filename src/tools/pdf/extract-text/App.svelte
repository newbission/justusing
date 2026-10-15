<!--
  PDF 글자 추출 도구 화면 (격리 frame 안에서 실행).
  PDF를 열면 쪽마다 글자를 읽어 보여주고 TXT 파일로 받게 한다. 파일은 어디로도 전송되지 않는다.
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
  import SinglePdfTool, { type LoadedPdf } from '../../../lib/pdf/SinglePdfTool.svelte';

  const common = pick(FRAME_MESSAGES);
  const t = pick(MESSAGES);

  let pdf: LoadedPdf | undefined = $state.raw();

  type Read =
    | { kind: 'reading'; done: number; total: number }
    | { kind: 'done'; text: string; characters: number }
    | { kind: 'failed'; message: string };
  let read = $state<Read>({ kind: 'reading', done: 0, total: 0 });

  /**
   * 쪽마다 글자를 읽어 하나로 잇는다. pdf.js가 알려주는 줄 끝(hasEOL)에서 줄을 바꾼다.
   * 읽기는 pdf.js 워커가 하고, 여기서는 쪽마다 기다리며 그 쪽 글자만 이어 붙이고 센다
   * (전체를 한 번에 다시 훑지 않아 쪽이 많아도 화면이 멈추지 않는다).
   */
  async function extract(source: LoadedPdf) {
    const total = source.doc.numPages;
    const pages: string[] = [];
    let characters = 0;
    try {
      for (let number = 1; number <= total; number++) {
        const page = await source.doc.getPage(number);
        const content = await page.getTextContent();
        page.cleanup();
        if (pdf !== source) return;
        const text = content.items
          .map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : '') : ''))
          .join('')
          .trim();
        // 쪽 구분 줄과 공백은 빼고 센다
        characters += text.replace(/\s/g, '').length;
        pages.push(total > 1 ? `${t.pageMark(number)}\n${text}` : text);
        read = { kind: 'reading', done: number, total };
      }
      read = { kind: 'done', text: pages.join('\n\n'), characters };
    } catch {
      if (pdf !== source) return;
      read = { kind: 'failed', message: t.failed };
    }
  }

  function onload(loaded: LoadedPdf) {
    pdf = loaded;
    read = { kind: 'reading', done: 0, total: loaded.doc.numPages };
    extract(loaded);
  }

  async function save() {
    if (!pdf || read.kind !== 'done') return;
    const entitlement = await canUse('pdf/extract-text');
    if (!entitlement.allowed) {
      read = { kind: 'failed', message: entitlement.reason ?? common.action.unavailable };
      return;
    }
    // 메모장에서도 줄이 바뀌게 CRLF로, 한글이 깨지지 않게 UTF-8 BOM을 붙인다
    const body = '﻿' + read.text.replace(/\n/g, '\r\n');
    downloadFile(
      new TextEncoder().encode(body),
      `${baseName(pdf.name)}.txt`,
      'text/plain;charset=utf-8',
    );
  }
</script>

<SinglePdfTool {onload}>
  {#snippet children()}
    <ActionBar label={t.bar}>
      {#snippet text()}
        {#if read.kind === 'reading'}
          {t.reading(read.done, read.total)}
        {:else if read.kind === 'failed'}
          <strong>{read.message}</strong>
        {:else if read.characters === 0}
          {t.empty}
        {:else}
          {t.found(read.characters.toLocaleString(frameLocale))}
        {/if}
      {/snippet}
      <button
        type="button"
        class="btn primary"
        disabled={read.kind !== 'done' || read.characters === 0}
        onclick={save}>{t.download}</button
      >
    </ActionBar>

    <div class="tool-body text-body">
      {#if read.kind === 'done' && read.characters > 0}
        <textarea readonly aria-label={t.textLabel} value={read.text}></textarea>
      {/if}
    </div>
  {/snippet}
</SinglePdfTool>

<style>
  .text-body {
    display: flex;
  }
  textarea {
    flex: 1;
    min-height: 0;
    padding: 12px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius);
    background: var(--color-bg);
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 1.6;
    resize: none;
  }
</style>
