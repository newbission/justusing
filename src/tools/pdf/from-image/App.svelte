<!--
  이미지를 PDF로 도구 화면 (격리 frame 안에서 실행).
  넣은 이미지들을 목록으로 보여주고, 정한 순서대로 한 장씩 한 쪽에 넣어 PDF 하나를 만든다.
  파일은 어디로도 전송되지 않는다. 목록 모양과 순서 바꾸기는 pdf/merge와 같다.
-->
<script lang="ts">
  import { pick } from '../../../frame/locale';
  import { FRAME_MESSAGES } from '../../../frame/messages';
  import { MESSAGES } from './messages';

  const common = pick(FRAME_MESSAGES);
  const t = pick(MESSAGES);
  import { onMount, tick } from 'svelte';
  import { flip } from 'svelte/animate';
  import ActionBar from '../../../frame/ActionBar.svelte';
  import FileDrop from '../../../frame/FileDrop.svelte';
  import { onFrameFiles } from '../../../frame/drop';
  import { requestShowTool } from '../../../frame/parent';
  import { downloadFile } from '../../../frame/download';
  import { canUse } from '../../../lib/entitlement';
  import { readImageInfo } from '../../../lib/image/prepare';
  import { imagesToPdf, type PageSize } from '../../../lib/pdf/images-to-pdf';

  /** 받는 이미지 형식. 브라우저가 읽을 수 있으면 그 밖의 형식도 받는다 (읽지 못하면 '열 수 없음') */
  const ACCEPT = 'image/*';

  interface Item {
    id: number;
    name: string;
    file: File;
    status: 'loading' | 'ready' | 'error';
    width: number;
    height: number;
    /** 목록 썸네일 (blob 주소, 빼면 돌려준다) */
    thumb?: string;
  }

  let items: Item[] = $state([]);
  let nextId = 0;

  const readyItems = $derived(items.filter((item) => item.status === 'ready'));

  type Margin = 'none' | 'small';
  /** 여백 (pt). 'small'은 약 12mm */
  const MARGIN_PT: Record<Margin, number> = { none: 0, small: 36 };
  const SIZES: { id: PageSize; label: string; short: string }[] = (
    ['a4', 'letter', 'fit'] as const
  ).map((id) => ({ id, ...t.sizes[id] }));
  const MARGINS: { id: Margin; label: string; short: string }[] = (['none', 'small'] as const).map(
    (id) => ({ id, ...t.margins[id] }),
  );
  /** 영어 화면은 미국 기본 종이(Letter)부터, 그 밖에는 A4부터 */
  let size: PageSize = $state(document.documentElement.lang === 'en' ? 'letter' : 'a4');
  let margin: Margin = $state('none');

  /** 만들기 버튼을 누를 수 없을 때 그 이유 (누를 수 있으면 undefined) */
  const blocker = $derived.by(() => {
    if (items.some((item) => item.status === 'loading')) return t.reading;
    if (readyItems.length === 0) return t.needOne;
    return undefined;
  });

  type Phase =
    | { kind: 'idle' }
    | { kind: 'working'; done: number; total: number }
    | { kind: 'done'; bytes: Uint8Array; fileName: string; signature: string }
    | { kind: 'failed'; message: string };
  let phase = $state<Phase>({ kind: 'idle' });

  /**
   * 만들 내용(이미지 순서·쪽 크기·여백). 만든 뒤 바뀌면 결과는 더 이상 맞지 않는다.
   * 읽는 중인 이미지도 넣는다: 이미지를 더하자마자 이전 결과의 다운로드가 사라져야 한다.
   */
  const signature = $derived(
    `${size}:${margin}:${items.map((item) => `${item.id}-${item.status}`).join(',')}`,
  );
  const result = $derived(
    phase.kind === 'done' && phase.signature === signature ? phase : undefined,
  );

  async function create() {
    if (blocker || phase.kind === 'working') return;
    const entitlement = await canUse('pdf/from-image');
    if (!entitlement.allowed) {
      phase = { kind: 'failed', message: entitlement.reason ?? common.action.unavailable };
      return;
    }

    const sources = readyItems;
    const startedWith = signature;
    // 처리하는 동안 고른 값을 바꿔도 처음 값으로 끝까지 만든다
    const options = { size, margin: MARGIN_PT[margin] };
    phase = { kind: 'working', done: 0, total: sources.length };
    try {
      // 사진을 바로 세우고 다시 저장하는 일까지 워커가 한다 (화면이 멈추지 않게)
      const bytes = await imagesToPdf(
        { images: sources.map((item) => item.file), ...options },
        (done, total) => (phase = { kind: 'working', done, total }),
      );
      const base = sources[0]!.name.replace(/\.[^.]+$/, '');
      phase = { kind: 'done', bytes, fileName: `${base}.pdf`, signature: startedWith };
    } catch {
      phase = { kind: 'failed', message: t.failed };
    }
  }

  async function add(files: File[]) {
    const images = files.filter(
      (file) =>
        file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(file.name),
    );
    if (images.length === 0) return;
    if (items.length === 0) requestShowTool();

    for (const file of images) {
      items.push({ id: nextId++, name: file.name, file, status: 'loading', width: 0, height: 0 });
      load(items.at(-1)!);
    }
  }

  /** 크기를 읽고 썸네일을 만든다 */
  async function load(item: Item) {
    try {
      const info = await readImageInfo(item.file);
      item.width = info.width;
      item.height = info.height;
      item.thumb = URL.createObjectURL(item.file);
      item.status = 'ready';
    } catch {
      item.status = 'error';
    }
  }

  function remove(item: Item) {
    items = items.filter((other) => other !== item);
    if (item.thumb) URL.revokeObjectURL(item.thumb);
  }

  /** 줄이 자리를 바꾸는 모션 시간. 움직임 줄이기 설정이면 모션 없이 바로 바꾼다. */
  const MOVE_MS = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 250;

  /** 방금 옮긴 줄. 잠깐 강조해서 무엇이 움직였는지 보이게 한다. */
  let movedId: number | undefined = $state();

  async function markMoved(id: number) {
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
    // 줄이 옮겨지면 브라우저가 버튼 포커스를 놓치므로 같은 버튼에 다시 맞춘다
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

<div class="tool">
  {#if items.length === 0}
    <div class="drop">
      <FileDrop accept={ACCEPT} label={t.choose} multiple hint={t.hint} onfiles={add} />
    </div>
  {:else}
    <div class="summary">
      <span aria-live="polite">{t.summary(items.length)}</span>
      <label class="add">
        {t.addFiles}
        <input
          type="file"
          class="visually-hidden"
          accept={ACCEPT}
          multiple
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
        {#if phase.kind === 'working'}
          {t.working(phase.done, phase.total)}
        {:else if result}
          {common.action.done(result.fileName, formatSize(result.bytes.length))}
        {:else if phase.kind === 'failed'}
          <strong>{phase.message}</strong>
        {:else}
          {blocker ?? t.ready(readyItems.length)}
        {/if}
      {/snippet}
      {#if result}
        <button
          type="button"
          class="primary"
          onclick={() => downloadFile(result.bytes, result.fileName)}
          >{common.action.download}</button
        >
      {:else}
        <button
          type="button"
          class="primary"
          disabled={blocker !== undefined || phase.kind === 'working'}
          onclick={create}>{phase.kind === 'working' ? t.workingShort : t.run}</button
        >
      {/if}
    </ActionBar>

    <div class="options">
      <div class="choice" role="radiogroup" aria-label={t.sizeGroup}>
        {#each SIZES as option (option.id)}
          <label class:checked={size === option.id}>
            <input type="radio" name="size" value={option.id} bind:group={size} />
            <span class="long">{option.label}</span>
            <span class="short">{option.short}</span>
          </label>
        {/each}
      </div>
      <div class="choice" role="radiogroup" aria-label={t.marginGroup}>
        {#each MARGINS as option (option.id)}
          <label class:checked={margin === option.id}>
            <input type="radio" name="margin" value={option.id} bind:group={margin} />
            <span class="long">{option.label}</span>
            <span class="short">{option.short}</span>
          </label>
        {/each}
      </div>
    </div>

    <ol class="list" aria-label={t.list}>
      {#each items as item, index (item.id)}
        <li class="item" data-item={item.id} animate:flip={{ duration: MOVE_MS }}>
          <div
            class="row"
            class:moved={movedId === item.id}
            class:dragging={dragId === item.id}
            class:drop-before={dropIndex === index}
            class:drop-after={dropIndex === items.length && index === items.length - 1}
            draggable="true"
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
              {#if item.thumb}
                <img src={item.thumb} alt="" draggable="false" />
              {/if}
            </div>
            <div class="info">
              <span class="name" title={item.name}>{item.name}</span>
              <span class="meta">
                {#if item.status === 'loading'}
                  {t.itemReading}
                {:else if item.status === 'error'}
                  <strong>{t.broken}</strong>
                {:else}
                  {item.width}×{item.height} · {formatSize(item.file.size)}
                {/if}
              </span>
            </div>
            <button
              type="button"
              class="icon"
              data-move="-1"
              onclick={() => move(item, -1)}
              disabled={index === 0}
              aria-label={t.up(item.name)}>↑</button
            >
            <button
              type="button"
              class="icon"
              data-move="1"
              onclick={() => move(item, 1)}
              disabled={index === items.length - 1}
              aria-label={t.down(item.name)}>↓</button
            >
            <button
              type="button"
              class="icon"
              onclick={() => remove(item)}
              aria-label={t.remove(item.name)}>×</button
            >
          </div>
        </li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  .tool {
    position: relative;
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

  button.primary {
    min-width: 120px;
    height: 40px;
    padding: 0 20px;
    border-color: var(--color-text);
    background: var(--color-text);
    color: var(--color-bg);
    font-weight: 600;
  }

  /* 쪽 크기·여백: 라디오 버튼을 붙은 버튼 모양으로 (방향키로도 바뀐다, pdf/split과 같은 모양) */
  .options {
    display: flex;
    flex: none;
    flex-wrap: wrap;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-line);
  }
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

  .list {
    flex: 1;
    margin: 0;
    padding: 8px;
    overflow: auto;
    list-style: none;
  }
  /* 줄 높이 고정: 이미지를 읽는 동안·읽은 뒤에 목록이 흔들리지 않게 */
  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 72px;
    padding: 0 8px;
    border-radius: var(--radius);
    transition: background-color 0.12s;
  }
  .item + .item {
    border-top: 1px solid var(--color-line);
  }
  .row[draggable='true'] {
    cursor: grab;
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
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
  }
  .thumb img {
    max-width: 100%;
    max-height: 100%;
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.2);
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

  /* 좁은 화면: 짧은 이름으로 */
  @media (max-width: 520px) {
    .choice .long {
      display: none;
    }
    .choice .short {
      display: inline;
    }
  }
</style>
