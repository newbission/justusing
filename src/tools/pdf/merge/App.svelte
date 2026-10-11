<!--
  PDF 합치기 도구 화면 (격리 frame 안에서 실행).
  넣은 PDF들을 목록으로 보여주고, 정한 순서대로 하나로 합친다. 파일은 어디로도 전송되지 않는다.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import FileDrop from '../../../frame/FileDrop.svelte';
  import { onFrameFiles } from '../../../frame/drop';
  import { requestShowTool } from '../../../frame/parent';
  import Thumbnail from '../../../lib/pdf/Thumbnail.svelte';
  import { openPdf, type OpenedPdf, type PDFPageProxy } from '../../../lib/pdf/pdfjs';

  interface Item {
    id: number;
    name: string;
    bytes: Uint8Array;
    status: 'loading' | 'ready' | 'error';
    pageCount: number;
    firstPage?: PDFPageProxy;
    opened?: OpenedPdf;
  }

  /** 목록 썸네일 크기(px) */
  const THUMB = 56;

  let items: Item[] = $state([]);
  let nextId = 0;

  const totalPages = $derived(items.reduce((sum, item) => sum + item.pageCount, 0));

  async function add(files: File[]) {
    const pdfs = files.filter(
      (file) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name),
    );
    if (pdfs.length === 0) return;
    if (items.length === 0) requestShowTool();

    for (const file of pdfs) {
      const item: Item = {
        id: nextId++,
        name: file.name,
        bytes: new Uint8Array(await file.arrayBuffer()),
        status: 'loading',
        pageCount: 0,
      };
      items.push(item);
      load(items.at(-1)!);
    }
  }

  /** 페이지 수와 첫 페이지 썸네일을 읽는다 */
  async function load(item: Item) {
    try {
      // pdf.js는 받은 버퍼를 워커로 넘겨 비워 버리므로 복사본을 준다 (원본은 합칠 때 쓴다)
      item.opened = await openPdf(item.bytes.slice());
      item.pageCount = item.opened.doc.numPages;
      item.firstPage = await item.opened.doc.getPage(1);
      item.status = 'ready';
    } catch {
      item.status = 'error';
    }
  }

  function remove(item: Item) {
    items = items.filter((other) => other !== item);
    item.opened?.close();
  }

  function formatSize(bytes: number) {
    return bytes < 1024 * 1024
      ? `${Math.max(1, Math.round(bytes / 1024))}KB`
      : `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  }

  onMount(() => onFrameFiles(add));
</script>

<div class="merge">
  {#if items.length === 0}
    <div class="drop">
      <FileDrop
        accept="application/pdf,.pdf"
        label="PDF 파일 선택"
        multiple
        hint="여러 파일을 한 번에 고를 수 있습니다 · 파일은 이 기기를 떠나지 않습니다"
        onfiles={add}
      />
    </div>
  {:else}
    <div class="summary">
      <span aria-live="polite">파일 {items.length}개 · 총 {totalPages}쪽</span>
      <label class="add">
        파일 추가
        <input
          type="file"
          class="visually-hidden"
          accept="application/pdf,.pdf"
          multiple
          onchange={(event) => {
            add([...(event.currentTarget.files ?? [])]);
            event.currentTarget.value = '';
          }}
        />
      </label>
    </div>

    <ol class="list" aria-label="합칠 파일 목록 (위에서부터 순서대로 합칩니다)">
      {#each items as item (item.id)}
        <li class="row">
          <div class="thumb">
            {#if item.firstPage}
              <Thumbnail page={item.firstPage} size={THUMB} />
            {/if}
          </div>
          <div class="info">
            <span class="name" title={item.name}>{item.name}</span>
            <span class="meta">
              {#if item.status === 'loading'}
                읽는 중…
              {:else if item.status === 'error'}
                <strong>열 수 없는 파일입니다. 빼고 합칩니다.</strong>
              {:else}
                {item.pageCount}쪽 · {formatSize(item.bytes.length)}
              {/if}
            </span>
          </div>
          <button
            type="button"
            class="icon"
            onclick={() => remove(item)}
            aria-label="{item.name} 빼기">×</button
          >
        </li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  .merge {
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

  .list {
    flex: 1;
    margin: 0;
    padding: 8px;
    overflow: auto;
    list-style: none;
  }
  /* 줄 높이 고정: 파일을 읽는 동안·읽은 뒤에 목록이 흔들리지 않게 */
  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 72px;
    padding: 0 8px;
    border-radius: var(--radius);
  }
  .row + .row {
    border-top: 1px solid var(--color-line);
  }
  .thumb {
    flex: none;
    width: 56px;
    height: 56px;
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
    color: var(--color-muted);
    font-size: 13px;
  }
  .meta strong {
    color: var(--color-text);
  }

  .add {
    display: inline-flex;
    align-items: center;
    height: 32px;
    padding: 0 12px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius);
    font-size: 14px;
    cursor: pointer;
  }
  .add:has(input:focus-visible) {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  button {
    flex: none;
    height: 32px;
    min-width: 32px;
    padding: 0 8px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius);
    background: transparent;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  button.icon {
    font-size: 18px;
    line-height: 1;
  }
</style>
