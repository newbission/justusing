<!--
  PDF 가리기(영구 삭제) 도구 화면 (격리 frame 안에서 실행).
  쪽 위에 검은 상자를 그리거나 글자를 찾아 가린다. 가린 쪽은 그림으로 바꿔 가린 글자를 파일에서 지운다.
  파일은 어디로도 전송되지 않는다.
-->
<script lang="ts">
  import '../../../frame/controls.css';
  import { tick, untrack } from 'svelte';
  import { pick } from '../../../frame/locale';
  import { FRAME_MESSAGES } from '../../../frame/messages';
  import { MESSAGES } from './messages';
  import ActionBar from '../../../frame/ActionBar.svelte';
  import { downloadFile } from '../../../frame/download';
  import { baseName, formatSize } from '../../../frame/format';
  import { canUse } from '../../../lib/entitlement';
  import { UNRENDERED_ANNOTATION } from '../../../lib/pdf/modify-errors';
  import PageSheet from '../../../lib/pdf/PageSheet.svelte';
  import { findText, redactPdf, type RedactBox } from '../../../lib/pdf/redact';
  import SinglePdfTool, { type LoadedPdf } from '../../../lib/pdf/SinglePdfTool.svelte';

  const common = pick(FRAME_MESSAGES);
  const t = pick(MESSAGES);

  /** 이보다 작게 그린 상자는 실수로 누른 것으로 보고 버린다 (쪽 비율) */
  const MIN_BOX = 0.01;

  type Box = RedactBox & { id: number };

  let pdf: LoadedPdf | undefined = $state.raw();
  let boxes: Box[] = $state([]);
  let nextId = 0;
  let selectedId: number | undefined = $state();
  let pageIndex = $state(0);
  let view = $state({ width: 0, height: 0 });
  let overlay: HTMLDivElement | undefined = $state();

  const pageBoxes = $derived(boxes.filter((box) => box.page === pageIndex));
  const pageCount = $derived(new Set(boxes.map((box) => box.page)).size);
  const signature = $derived(
    JSON.stringify(boxes.map(({ page, x, y, width, height }) => [page, x, y, width, height])),
  );

  type Run =
    | { kind: 'idle' }
    | { kind: 'working'; done: number; total: number }
    | { kind: 'saving' }
    | { kind: 'done'; name: string; bytes: Uint8Array; signature: string }
    | { kind: 'failed'; message: string; signature: string };
  let run = $state<Run>({ kind: 'idle' });
  const busy = $derived(run.kind === 'working' || run.kind === 'saving');
  const result = $derived(run.kind === 'done' && run.signature === signature ? run : undefined);
  const failure = $derived(
    run.kind === 'failed' && run.signature === signature ? run.message : undefined,
  );

  function onload(loaded: LoadedPdf) {
    pdf = loaded;
    boxes = [];
    selectedId = undefined;
    pageIndex = 0;
    search = { kind: 'idle' };
    run = { kind: 'idle' };
  }

  async function apply() {
    if (!pdf || boxes.length === 0 || busy) return;
    const entitlement = await canUse('pdf/redact');
    if (!entitlement.allowed) {
      run = { kind: 'failed', message: entitlement.reason ?? common.action.unavailable, signature };
      return;
    }
    const source = pdf;
    const startedWith = signature;
    const chosen = $state.snapshot(boxes).map(({ id: _id, ...box }) => box);
    run = { kind: 'working', done: 0, total: pageCount };
    try {
      const bytes = await redactPdf(source, chosen, (done, total) => {
        if (pdf !== source) return;
        run = done === total ? { kind: 'saving' } : { kind: 'working', done, total };
      });
      if (pdf !== source) return;
      run = {
        kind: 'done',
        name: `${baseName(source.name)}_${t.suffix}.pdf`,
        bytes,
        signature: startedWith,
      };
    } catch (error) {
      if (pdf !== source) return;
      const unrendered = error instanceof Error && error.message === UNRENDERED_ANNOTATION;
      run = {
        kind: 'failed',
        message: unrendered ? t.annotationFailed : t.failed,
        signature: startedWith,
      };
    }
  }

  // ---- 찾아서 가리기 ----
  let term = $state('');
  type Search =
    { kind: 'idle' } | { kind: 'finding' } | { kind: 'found'; count: number } | { kind: 'none' };
  let search = $state<Search>({ kind: 'idle' });

  async function find() {
    if (!pdf || !term.trim() || search.kind === 'finding') return;
    const source = pdf;
    search = { kind: 'finding' };
    try {
      const found = await findText(source.doc, term);
      if (pdf !== source) return;
      boxes.push(...found.map((box) => ({ ...box, id: nextId++ })));
      search = found.length > 0 ? { kind: 'found', count: found.length } : { kind: 'none' };
      // 찾은 곳이 있는 첫 쪽을 보여 준다
      if (found.length > 0 && !found.some((box) => box.page === pageIndex)) {
        pageIndex = found[0]!.page;
      }
    } catch {
      if (pdf === source) search = { kind: 'none' };
    }
  }

  // ---- 고르기·옮기기·그리기 ----
  // 쪽을 넘기면 고른 것을 놓는다
  $effect(() => {
    void pageIndex;
    untrack(() => (selectedId = undefined));
  });

  const clamp = (value: number, min = 0, max = 1) => Math.min(Math.max(value, min), max);

  function pointAt(event: PointerEvent) {
    const rect = overlay!.getBoundingClientRect();
    return {
      x: clamp((event.clientX - rect.left) / rect.width),
      y: clamp((event.clientY - rect.top) / rect.height),
    };
  }

  type Drag =
    | { kind: 'move'; id: number; from: { x: number; y: number }; start: { x: number; y: number } }
    | { kind: 'draw'; from: { x: number; y: number }; to: { x: number; y: number } };
  let drag: Drag | undefined = $state();

  function onSheetDown(event: PointerEvent) {
    if (event.button !== 0 || busy) return;
    event.preventDefault();
    overlay!.setPointerCapture(event.pointerId);
    selectedId = undefined;
    const point = pointAt(event);
    drag = { kind: 'draw', from: point, to: point };
  }

  function onBoxDown(event: PointerEvent, box: Box) {
    if (event.button !== 0 || busy) return;
    event.stopPropagation();
    event.preventDefault();
    selectedId = box.id;
    overlay!.setPointerCapture(event.pointerId);
    drag = { kind: 'move', id: box.id, from: pointAt(event), start: { x: box.x, y: box.y } };
  }

  function onMove(event: PointerEvent) {
    if (!drag) return;
    const point = pointAt(event);
    if (drag.kind === 'draw') {
      drag.to = point;
      return;
    }
    const move = drag;
    const box = boxes.find((other) => other.id === move.id);
    if (!box) return;
    box.x = clamp(move.start.x + point.x - move.from.x, 0, 1 - box.width);
    box.y = clamp(move.start.y + point.y - move.from.y, 0, 1 - box.height);
  }

  function onUp() {
    if (drag?.kind === 'draw') {
      const x = Math.min(drag.from.x, drag.to.x);
      const y = Math.min(drag.from.y, drag.to.y);
      const width = Math.abs(drag.to.x - drag.from.x);
      const height = Math.abs(drag.to.y - drag.from.y);
      if (width >= MIN_BOX && height >= MIN_BOX) {
        const id = nextId++;
        boxes.push({ id, page: pageIndex, x, y, width, height });
        selectedId = id;
      }
    }
    drag = undefined;
  }

  /** 키보드로도 넣을 수 있게, 쪽 가운데에 상자 하나를 넣고 고른다 (그다음 화살표로 옮긴다) */
  async function addAtCenter() {
    const id = nextId++;
    boxes.push({ id, page: pageIndex, x: 0.35, y: 0.47, width: 0.3, height: 0.06 });
    selectedId = id;
    await tick();
    overlay?.querySelector<HTMLElement>('.box.selected')?.focus();
  }

  /** 고른 상자를 키보드로: 화살표로 옮기고, Alt+화살표로 크기를 바꾸고, Delete로 지운다 */
  function onBoxKey(event: KeyboardEvent, box: Box) {
    const step = event.shiftKey ? 0.02 : 0.005;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      remove(box.id);
      return;
    }
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    selectedId = box.id;
    if (event.altKey) {
      box.width = clamp(box.width + move[0], MIN_BOX, 1 - box.x);
      box.height = clamp(box.height + move[1], MIN_BOX, 1 - box.y);
      return;
    }
    box.x = clamp(box.x + move[0], 0, 1 - box.width);
    box.y = clamp(box.y + move[1], 0, 1 - box.height);
  }

  function remove(id: number) {
    boxes = boxes.filter((box) => box.id !== id);
    if (selectedId === id) selectedId = undefined;
  }
</script>

<SinglePdfTool {onload} saves>
  {#snippet children({ doc })}
    <ActionBar label={t.bar}>
      {#snippet text()}
        {#if run.kind === 'working'}
          {t.working(run.done, run.total)}
        {:else if run.kind === 'saving'}
          {t.saving}
        {:else if result}
          {common.action.done(result.name, formatSize(result.bytes.length))}
        {:else if failure}
          <strong>{failure}</strong>
        {:else if boxes.length === 0}
          {t.needBoxes}
        {:else}
          {t.ready(pageCount)}
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
          disabled={busy || boxes.length === 0}
          onclick={apply}>{t.run}</button
        >
      {/if}
    </ActionBar>

    <div class="tool-body">
      <p class="note">{t.note}</p>

      <div class="find">
        <label class="field">
          {t.findLabel}
          <input
            type="search"
            placeholder={t.findPlaceholder}
            bind:value={term}
            onkeydown={(event) => {
              if (event.key === 'Enter') find();
            }}
          />
        </label>
        <button
          type="button"
          class="btn"
          disabled={!term.trim() || search.kind === 'finding' || busy}
          onclick={find}>{search.kind === 'finding' ? t.finding : t.find}</button
        >
      </div>
      {#if search.kind === 'found'}
        <p class="help" role="status">{t.found(search.count)}</p>
      {:else if search.kind === 'none'}
        <p class="help" role="status">{t.notFound}</p>
      {/if}

      <div class="sheet">
        <!-- 결과는 인쇄할 때 보이는 모습으로 만들므로 미리보기도 같게 그린다 (인쇄 전용 주석도 보고 가릴 수 있게) -->
        <PageSheet {doc} bind:pageIndex bind:view help={t.help} intent="print">
          <!-- 쪽 위의 가리기 칸. 끌어서 상자를 그리고, 상자를 끌어 옮긴다 -->
          <div
            class="overlay"
            bind:this={overlay}
            role="presentation"
            onpointerdown={onSheetDown}
            onpointermove={onMove}
            onpointerup={onUp}
            onpointercancel={onUp}
          >
            {#each pageBoxes as box (box.id)}
              <div
                class="box"
                class:selected={box.id === selectedId}
                role="button"
                tabindex="0"
                aria-label={t.box(boxes.indexOf(box) + 1)}
                style:left="{box.x * 100}%"
                style:top="{box.y * 100}%"
                style:width="{box.width * 100}%"
                style:height="{box.height * 100}%"
                onpointerdown={(event) => onBoxDown(event, box)}
                onkeydown={(event) => onBoxKey(event, box)}
                onfocus={() => (selectedId = box.id)}
              ></div>
            {/each}
            {#if drag?.kind === 'draw'}
              <div
                class="box drawing"
                style:left="{Math.min(drag.from.x, drag.to.x) * 100}%"
                style:top="{Math.min(drag.from.y, drag.to.y) * 100}%"
                style:width="{Math.abs(drag.to.x - drag.from.x) * 100}%"
                style:height="{Math.abs(drag.to.y - drag.from.y) * 100}%"
              ></div>
            {/if}
          </div>
        </PageSheet>
      </div>

      <div class="items-bar">
        <span>{t.count(boxes.length, pageCount)}</span>
        <button type="button" class="btn" disabled={busy} onclick={addAtCenter}
          >{t.addCenter}</button
        >
        <button
          type="button"
          class="btn"
          disabled={boxes.length === 0 || busy}
          onclick={() => remove(boxes.at(-1)!.id)}>{t.undo}</button
        >
        <button
          type="button"
          class="btn"
          disabled={boxes.length === 0 || busy}
          onclick={() => {
            boxes = [];
            selectedId = undefined;
          }}>{t.clear}</button
        >
      </div>
      <p class="help keys">{t.keys}</p>
    </div>
  {/snippet}
</SinglePdfTool>

<style>
  .note {
    margin: 0 0 12px;
    padding: 10px 12px;
    border-radius: var(--radius);
    background: var(--color-accent-soft);
    font-size: 14px;
    line-height: 1.6;
  }
  .find {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 8px;
    margin-bottom: 8px;
  }
  .find .field {
    flex: 1 1 220px;
    margin-bottom: 0;
  }
  /* 입력 칸과 같은 높이로 나란히 */
  .find .btn {
    height: 40px;
  }
  .sheet {
    margin: 12px 0;
  }
  .overlay {
    position: absolute;
    inset: 0;
    overflow: hidden;
    cursor: crosshair;
    touch-action: none;
  }
  .box {
    position: absolute;
    background: var(--color-redact);
    cursor: move;
  }
  .box.drawing {
    opacity: 0.6;
  }
  .box:focus-visible,
  .box.selected {
    outline: 2px solid var(--color-accent);
    outline-offset: 1px;
  }
  .items-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    margin-bottom: 8px;
    font-size: 14px;
  }
  .items-bar span {
    margin-right: auto;
  }
  .keys {
    margin: 0 0 16px;
  }
</style>
