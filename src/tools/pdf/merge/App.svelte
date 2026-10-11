<!--
  PDF 합치기 도구 화면 (격리 frame 안에서 실행).
  넣은 PDF들을 목록으로 보여주고, 정한 순서대로 하나로 합친다. 파일은 어디로도 전송되지 않는다.
-->
<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { flip } from 'svelte/animate';
  import FileDrop from '../../../frame/FileDrop.svelte';
  import { onFrameFiles } from '../../../frame/drop';
  import { requestShowTool } from '../../../frame/parent';
  import { downloadFile } from '../../../frame/download';
  import { canUse } from '../../../lib/entitlement';
  import { assemblePdf } from '../../../lib/pdf/assemble';
  import Thumbnail from '../../../lib/pdf/Thumbnail.svelte';
  import {
    isPasswordError,
    openPdf,
    type OpenedPdf,
    type PDFPageProxy,
  } from '../../../lib/pdf/pdfjs';

  interface Item {
    id: number;
    name: string;
    bytes: Uint8Array;
    status: 'loading' | 'password' | 'ready' | 'error';
    /** 암호 PDF를 연 암호. 합칠 때 같은 암호로 풀어서 넣는다. */
    password?: string;
    /** 암호 입력 칸의 값과 틀렸는지 여부 */
    passwordInput: string;
    wrongPassword: boolean;
    pageCount: number;
    firstPage?: PDFPageProxy;
    opened?: OpenedPdf;
  }

  /** 목록 썸네일 크기(px) */
  const THUMB = 56;

  let items: Item[] = $state([]);
  let nextId = 0;

  const totalPages = $derived(items.reduce((sum, item) => sum + item.pageCount, 0));
  const readyItems = $derived(items.filter((item) => item.status === 'ready'));

  /** 합치기 버튼을 누를 수 없을 때 그 이유 (누를 수 있으면 undefined) */
  const blocker = $derived.by(() => {
    if (items.some((item) => item.status === 'loading')) return '파일을 읽는 중입니다…';
    if (items.some((item) => item.status === 'password'))
      return '암호를 입력하거나 그 파일을 빼 주세요.';
    if (readyItems.length < 2) return '합칠 PDF를 2개 이상 넣어 주세요.';
    return undefined;
  });

  type Phase =
    | { kind: 'idle' }
    | { kind: 'working' }
    | { kind: 'done'; bytes: Uint8Array; fileName: string; signature: string }
    | { kind: 'failed'; message: string };
  let phase: Phase = $state({ kind: 'idle' });

  /** 목록 상태(순서·파일). 합친 뒤 목록이 바뀌면 결과는 더 이상 맞지 않는다. */
  const signature = $derived(readyItems.map((item) => item.id).join(','));
  const result = $derived(
    phase.kind === 'done' && phase.signature === signature ? phase : undefined,
  );

  async function merge() {
    if (blocker || phase.kind === 'working') return;
    const entitlement = await canUse('pdf/merge');
    if (!entitlement.allowed) {
      phase = { kind: 'failed', message: entitlement.reason ?? '지금은 사용할 수 없습니다.' };
      return;
    }

    const sources = readyItems;
    const startedWith = signature;
    phase = { kind: 'working' };
    try {
      const bytes = await assemblePdf({
        sources: sources.map(({ bytes, password }) => ({ bytes, password })),
        pages: sources.flatMap((item, source) =>
          Array.from({ length: item.pageCount }, (_, index) => ({ source, index })),
        ),
      });
      const base = sources[0]!.name.replace(/\.pdf$/i, '');
      phase = { kind: 'done', bytes, fileName: `${base}_합침.pdf`, signature: startedWith };
    } catch {
      phase = {
        kind: 'failed',
        message: '합치지 못했습니다. 손상된 파일이 있다면 빼고 다시 해 보세요.',
      };
    }
  }

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
        passwordInput: '',
        wrongPassword: false,
      };
      items.push(item);
      load(items.at(-1)!);
    }
  }

  /** 페이지 수와 첫 페이지 썸네일을 읽는다 */
  async function load(item: Item, password?: string) {
    item.status = 'loading';
    try {
      // pdf.js는 받은 버퍼를 워커로 넘겨 비워 버리므로 복사본을 준다 (원본은 합칠 때 쓴다)
      item.opened = await openPdf(item.bytes.slice(), password);
      item.password = password;
      item.pageCount = item.opened.doc.numPages;
      item.firstPage = await item.opened.doc.getPage(1);
      item.status = 'ready';
    } catch (error) {
      if (isPasswordError(error)) {
        item.wrongPassword = password !== undefined;
        item.passwordInput = '';
        item.status = 'password';
      } else {
        item.status = 'error';
      }
    }
  }

  function remove(item: Item) {
    items = items.filter((other) => other !== item);
    item.opened?.close();
  }

  /** 줄이 자리를 바꾸는 모션 시간. 움직임 줄이기 설정이면 모션 없이 바로 바꾼다. */
  const MOVE_MS = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 250;

  /** 방금 옮긴 줄. 잠깐 강조해서 무엇이 움직였는지 보이게 한다. */
  let movedId: number | undefined = $state();

  async function markMoved(id: number) {
    // 같은 줄을 연달아 옮겨도 강조가 처음부터 다시 보이도록 한 번 지웠다가 붙인다
    movedId = undefined;
    await tick();
    requestAnimationFrame(() => (movedId = id));
  }

  /** 한 칸 위(-1)나 아래(1)로 옮긴다 */
  async function move(item: Item, delta: -1 | 1) {
    const from = items.indexOf(item);
    const to = from + delta;
    if (to < 0 || to >= items.length) return;
    items.splice(to, 0, ...items.splice(from, 1));
    markMoved(item.id);
    // 줄이 옮겨지면 브라우저가 버튼 포커스를 놓치므로 같은 버튼에 다시 맞춘다.
    // 맨 위·맨 아래에 닿아 그 버튼이 꺼졌으면 반대 방향 버튼에 맞춘다.
    await tick();
    const row = document.querySelector(`[data-item="${item.id}"]`);
    const same = row?.querySelector<HTMLButtonElement>(`[data-move="${delta}"]`);
    const other = row?.querySelector<HTMLButtonElement>(`[data-move="${-delta}"]`);
    (same && !same.disabled ? same : other)?.focus();
  }

  // 끌어서 순서 바꾸기. 끄는 줄 id와 놓일 자리(0 = 맨 위, items.length = 맨 아래)
  let dragId: number | undefined = $state();
  let dropIndex: number | undefined = $state();

  function dragOver(event: DragEvent, index: number) {
    if (dragId === undefined) return; // 파일 끌기는 frame 전체가 받는다 (drop.ts)
    event.preventDefault();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    dropIndex = event.clientY < rect.top + rect.height / 2 ? index : index + 1;
  }

  function dropRow(event: DragEvent) {
    if (dragId === undefined || dropIndex === undefined) return;
    event.preventDefault();
    const from = items.findIndex((item) => item.id === dragId);
    const to = dropIndex > from ? dropIndex - 1 : dropIndex;
    items.splice(to, 0, ...items.splice(from, 1));
    markMoved(dragId);
    dragEnd();
  }

  function dragEnd() {
    dragId = undefined;
    dropIndex = undefined;
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

    <!-- 실행·다운로드 막대: 높이 고정(처리 전후 같음). 모바일 하단 고정 광고와 멀도록 목록 위에 둔다 -->
    <div class="action" role="group" aria-label="합치기">
      <p class="action-text" aria-live="polite">
        {#if phase.kind === 'working'}
          합치는 중… 파일이 크면 시간이 걸릴 수 있습니다.
        {:else if result}
          완료: {result.fileName} · {formatSize(result.bytes.length)}
        {:else if phase.kind === 'failed'}
          <strong>{phase.message}</strong>
        {:else}
          {blocker ?? '위에서부터 목록 순서대로 합칩니다.'}
        {/if}
      </p>
      {#if result}
        <button
          type="button"
          class="primary"
          onclick={() => downloadFile(result.bytes, result.fileName)}>다운로드</button
        >
      {:else}
        <button
          type="button"
          class="primary"
          disabled={blocker !== undefined || phase.kind === 'working'}
          onclick={merge}>{phase.kind === 'working' ? '합치는 중…' : 'PDF 합치기'}</button
        >
      {/if}
    </div>

    <ol class="list" aria-label="합칠 파일 목록 (위에서부터 순서대로 합칩니다)">
      {#each items as item, index (item.id)}
        <li class="item" data-item={item.id} animate:flip={{ duration: MOVE_MS }}>
          <!-- 줄 머리만 끌린다 (펼친 페이지 격자는 따로 끌기를 처리한다) -->
          <div
            class="row"
            class:moved={movedId === item.id}
            class:dragging={dragId === item.id}
            class:drop-before={dropIndex === index}
            class:drop-after={dropIndex === items.length && index === items.length - 1}
            draggable={item.status !== 'password'}
            ondragstart={(event) => {
              dragId = item.id;
              event.dataTransfer!.effectAllowed = 'move';
              // 일부 브라우저는 데이터가 없으면 끌기를 시작하지 않는다 (내용은 쓰지 않음)
              event.dataTransfer!.setData('text/plain', '');
            }}
            ondragover={(event) => dragOver(event, index)}
            ondrop={dropRow}
            ondragend={dragEnd}
          >
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
                {:else if item.status === 'password'}
                  <!-- 격리 frame은 form 제출이 막혀 있어 Enter 키와 버튼으로 직접 처리한다 -->
                  <span class="password">
                    <input
                      type="password"
                      bind:value={item.passwordInput}
                      autocomplete="off"
                      placeholder={item.wrongPassword ? '암호가 맞지 않습니다' : '암호 입력'}
                      aria-label="{item.name} 암호"
                      aria-invalid={item.wrongPassword}
                      onkeydown={(event) => {
                        if (event.key === 'Enter' && item.passwordInput)
                          load(item, item.passwordInput);
                      }}
                    />
                    <button
                      type="button"
                      disabled={!item.passwordInput}
                      onclick={() => load(item, item.passwordInput)}>열기</button
                    >
                  </span>
                {:else if item.status === 'error'}
                  <strong>열 수 없는 파일입니다. 빼고 합칩니다.</strong>
                {:else}
                  {item.pageCount}쪽 · {formatSize(item.bytes.length)}
                {/if}
              </span>
            </div>
            <!-- 암호를 넣기 전에는 끌기와 마찬가지로 순서 버튼도 숨겨 암호 칸에 자리를 준다 -->
            {#if item.status !== 'password'}
              <button
                type="button"
                class="icon"
                data-move="-1"
                onclick={() => move(item, -1)}
                disabled={index === 0}
                aria-label="{item.name} 위로">↑</button
              >
              <button
                type="button"
                class="icon"
                data-move="1"
                onclick={() => move(item, 1)}
                disabled={index === items.length - 1}
                aria-label="{item.name} 아래로">↓</button
              >
            {/if}
            <button
              type="button"
              class="icon"
              onclick={() => remove(item)}
              aria-label="{item.name} 빼기">×</button
            >
          </div>
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

  .action {
    display: flex;
    flex: none;
    align-items: center;
    gap: 12px;
    height: 64px;
    padding: 0 16px;
    border-bottom: 1px solid var(--color-line);
  }
  /* 좁은 화면에서도 안내를 다 읽을 수 있게 두 줄까지 보여 준다 (막대 높이는 그대로) */
  .action-text {
    display: -webkit-box;
    flex: 1;
    min-width: 0;
    margin: 0;
    overflow: hidden;
    color: var(--color-muted);
    font-size: 14px;
    line-height: 1.35;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }
  .action-text strong {
    color: var(--color-text);
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
  .item + .item {
    border-top: 1px solid var(--color-line);
  }
  .row[draggable='true'] {
    cursor: grab;
  }
  /* 마우스를 올리거나 키보드로 줄 안의 버튼에 있을 때 어느 파일인지 보이게 한다 */
  .row {
    transition: background-color 0.12s;
  }
  .row:hover,
  .row:focus-within {
    background: var(--color-hover);
  }
  .row.moved {
    animation: moved 1.2s ease-out;
  }
  @keyframes moved {
    from {
      background: var(--color-accent-soft);
      box-shadow: inset 3px 0 0 var(--color-accent);
    }
  }
  .row.dragging {
    opacity: 0.4;
  }
  /* 놓일 자리 표시 (테두리 대신 그림자로 그려 줄 높이가 바뀌지 않게) */
  .row.drop-before {
    box-shadow: inset 0 3px 0 var(--color-accent);
  }
  .row.drop-after {
    box-shadow: inset 0 -3px 0 var(--color-accent);
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
  .password {
    display: flex;
    gap: 4px;
  }
  /* 좁은 화면에서는 남은 폭만큼만 차지해 옆 버튼 밑으로 들어가지 않게 한다 */
  .password input {
    flex: 0 1 140px;
    min-width: 0;
    height: 28px;
    padding: 0 8px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius);
    background: var(--color-bg);
    font-size: 13px;
  }
  .password button {
    height: 28px;
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

  /* 마우스를 올린 버튼이 어느 것인지 보이게 한다 */
  button,
  .add {
    transition:
      background-color 0.12s,
      border-color 0.12s;
  }
  button:hover:not(:disabled),
  .add:hover {
    border-color: var(--color-muted);
    background: var(--color-hover);
  }
  button.primary:hover:not(:disabled) {
    border-color: var(--color-accent);
    background: var(--color-accent);
  }
</style>
