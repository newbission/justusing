<!--
  PDF 편집 도구 화면 (격리 frame 안에서 실행).
  쪽 위에 글자 상자를 넣고, 흰색으로 가리고, 형광펜을 칠한다. 넣은 것은 골라서 옮기고 고치고 지울 수 있다.
  글자는 고른 한글 글꼴로 미리 보여 준다. 파일은 어디로도 전송되지 않는다.
-->
<script lang="ts">
  import '../../../frame/controls.css';
  import { tick, untrack } from 'svelte';
  import { pick } from '../../../frame/locale';
  import { FRAME_MESSAGES } from '../../../frame/messages';
  import { MESSAGES, type Mode, type Tint } from './messages';
  import ActionBar from '../../../frame/ActionBar.svelte';
  import { downloadFile } from '../../../frame/download';
  import { baseName, formatSize } from '../../../frame/format';
  import { canUse } from '../../../lib/entitlement';
  import FontPicker, { type SelectedFont } from '../../../lib/fonts/FontPicker.svelte';
  import PageSheet from '../../../lib/pdf/PageSheet.svelte';
  import SinglePdfTool, { type LoadedPdf } from '../../../lib/pdf/SinglePdfTool.svelte';
  import {
    BASELINE,
    editPdf,
    HIGHLIGHT,
    LINE_HEIGHT,
    MissingGlyphsError,
    type EditItem,
  } from '../../../lib/pdf/edit';

  const common = pick(FRAME_MESSAGES);
  const t = pick(MESSAGES);

  const MODES: Mode[] = ['select', 'text', 'whiteout', 'highlight'];
  const TINTS: Tint[] = ['black', 'blue', 'red'];
  const COLORS: Record<Tint, [number, number, number]> = {
    black: [0, 0, 0],
    blue: [0.1, 0.25, 0.75],
    red: [0.8, 0.1, 0.1],
  };
  /**
   * 글자 상자를 화면에서 올릴 양 (글자 크기 대비). 줄 높이 LINE_HEIGHT로 그리면 첫 줄 바닥선이
   * 칸 위에서 약 (줄 높이 - 1)/2 + 0.88만큼 아래인데, 워커는 BASELINE에 그리므로 그 차이만큼 올린다
   */
  const TEXT_SHIFT = (LINE_HEIGHT - 1) / 2 + 0.88 - BASELINE;
  /** 이보다 작게 그린 사각형은 실수로 누른 것으로 보고 버린다 (쪽 비율) */
  const MIN_RECT = 0.01;

  type Item = EditItem & { id: number };

  let pdf: LoadedPdf | undefined = $state.raw();
  let items: Item[] = $state([]);
  let nextId = 0;
  let selectedId: number | undefined = $state();
  let mode: Mode = $state('text');
  let font: SelectedFont | undefined = $state.raw();
  /** 새 글자 상자의 크기와 색 (마지막으로 고른 값을 다음에도 쓴다) */
  let textSize = $state(14);
  let textTint: Tint = $state('black');

  const selected = $derived(items.find((item) => item.id === selectedId));
  const cleaned = $derived(items.filter((item) => item.kind !== 'text' || item.text.trim() !== ''));
  const needsFont = $derived(cleaned.some((item) => item.kind === 'text'));
  const blocker = $derived(
    cleaned.length === 0 ? t.needItems : needsFont && !font ? t.needFont : undefined,
  );
  const signature = $derived(JSON.stringify(cleaned) + (needsFont ? font?.id : ''));

  type Run =
    | { kind: 'idle' }
    | { kind: 'working' }
    | { kind: 'done'; name: string; bytes: Uint8Array; signature: string }
    | { kind: 'failed'; message: string; signature: string };
  let run = $state<Run>({ kind: 'idle' });
  const result = $derived(run.kind === 'done' && run.signature === signature ? run : undefined);
  const failure = $derived(
    run.kind === 'failed' && run.signature === signature ? run.message : undefined,
  );

  function onload(loaded: LoadedPdf) {
    pdf = loaded;
    items = [];
    selectedId = undefined;
    pageIndex = 0;
    run = { kind: 'idle' };
  }

  async function apply() {
    if (!pdf || blocker || run.kind === 'working') return;
    const entitlement = await canUse('pdf/edit');
    if (!entitlement.allowed) {
      run = { kind: 'failed', message: entitlement.reason ?? common.action.unavailable, signature };
      return;
    }
    const source = pdf;
    const startedWith = signature;
    const fontBytes =
      needsFont && font ? (font.files[400] ?? Object.values(font.files)[0]) : undefined;
    run = { kind: 'working' };
    try {
      const bytes = await editPdf(source, {
        items: $state.snapshot(cleaned).map(({ id: _id, ...item }) => item as EditItem),
        font: fontBytes,
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
      const message =
        error instanceof MissingGlyphsError ? t.missing(error.chars.join(' ')) : t.failed;
      run = { kind: 'failed', message, signature: startedWith };
    }
  }

  // ---- 쪽과 미리보기 ----
  let pageIndex = $state(0);
  let view = $state({ width: 0, height: 0 });
  let pagePt = $state({ width: 0, height: 0 });
  let family = $state('');
  let familyId = 0;
  let overlay: HTMLDivElement | undefined = $state();
  let textArea: HTMLTextAreaElement | undefined = $state();

  const pageItems = $derived(items.filter((item) => item.page === pageIndex));
  /** pt를 화면 px로 */
  const scale = $derived(pagePt.width === 0 ? 0 : view.width / pagePt.width);

  $effect(() => {
    const doc = pdf?.doc;
    if (!doc) return;
    // 쪽을 빠르게 넘기면 이전 쪽 크기가 늦게 올 수 있어 지금 쪽의 것만 쓴다
    let current = true;
    doc.getPage(pageIndex + 1).then((page) => {
      if (!current) return;
      const viewport = page.getViewport({ scale: 1 });
      pagePt = { width: viewport.width, height: viewport.height };
    });
    return () => {
      current = false;
    };
  });

  // 쪽을 넘기면 고른 것을 놓는다
  $effect(() => {
    void pageIndex;
    untrack(deselect);
  });

  $effect(() => {
    const bytes = font ? (font.files[400] ?? Object.values(font.files)[0]) : undefined;
    if (!bytes) return;
    const name = `edit-${familyId++}`;
    const face = new FontFace(name, bytes.slice());
    // 그새 다른 글꼴로 바꿨으면 늦게 끝난 이전 글꼴은 쓰지 않는다
    let current = true;
    face.load().then(() => {
      if (!current) return;
      document.fonts.add(face);
      family = name;
    });
    return () => {
      current = false;
      document.fonts.delete(face);
    };
  });

  // ---- 고르기·옮기기·그리기 ----
  const clamp = (value: number, min = 0, max = 1) => Math.min(Math.max(value, min), max);

  function pointAt(event: PointerEvent) {
    const rect = overlay!.getBoundingClientRect();
    return {
      x: clamp((event.clientX - rect.left) / rect.width),
      y: clamp((event.clientY - rect.top) / rect.height),
    };
  }

  /** 빈 글자 상자는 놓을 때 버린다 */
  function deselect() {
    if (selectedId === undefined) return;
    items = items.filter(
      (item) => item.id !== selectedId || item.kind !== 'text' || item.text.trim() !== '',
    );
    selectedId = undefined;
  }

  async function select(id: number) {
    if (selectedId !== id) deselect();
    selectedId = id;
  }

  type Drag =
    | { kind: 'move'; id: number; from: { x: number; y: number }; start: { x: number; y: number } }
    | {
        kind: 'draw';
        rect: 'whiteout' | 'highlight';
        from: { x: number; y: number };
        to: { x: number; y: number };
      };
  let drag: Drag | undefined = $state();

  async function onSheetDown(event: PointerEvent) {
    if (event.button !== 0) return;
    const point = pointAt(event);
    if (mode === 'text') {
      deselect();
      const id = nextId++;
      items.push({
        id,
        kind: 'text',
        page: pageIndex,
        x: point.x,
        y: point.y,
        text: '',
        size: textSize,
        color: COLORS[textTint],
      });
      selectedId = id;
      await tick();
      textArea?.focus();
      return;
    }
    if (mode === 'whiteout' || mode === 'highlight') {
      event.preventDefault();
      overlay!.setPointerCapture(event.pointerId);
      deselect();
      drag = { kind: 'draw', rect: mode, from: point, to: point };
      return;
    }
    deselect();
  }

  function onItemDown(event: PointerEvent, item: Item) {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    select(item.id);
    overlay!.setPointerCapture(event.pointerId);
    drag = { kind: 'move', id: item.id, from: pointAt(event), start: { x: item.x, y: item.y } };
  }

  function onMove(event: PointerEvent) {
    if (!drag) return;
    const point = pointAt(event);
    if (drag.kind === 'draw') {
      drag.to = point;
      return;
    }
    const move = drag;
    const item = items.find((other) => other.id === move.id);
    if (!item) return;
    const width = item.kind === 'text' ? 0 : item.width;
    const height = item.kind === 'text' ? 0 : item.height;
    item.x = clamp(move.start.x + point.x - move.from.x, 0, 1 - width);
    item.y = clamp(move.start.y + point.y - move.from.y, 0, 1 - height);
  }

  function onUp() {
    if (drag?.kind === 'draw') {
      const x = Math.min(drag.from.x, drag.to.x);
      const y = Math.min(drag.from.y, drag.to.y);
      const width = Math.abs(drag.to.x - drag.from.x);
      const height = Math.abs(drag.to.y - drag.from.y);
      if (width >= MIN_RECT && height >= MIN_RECT) {
        const id = nextId++;
        items.push({ id, kind: drag.rect, page: pageIndex, x, y, width, height });
        selectedId = id;
      }
    }
    drag = undefined;
  }

  /** 고른 것을 키보드로: 화살표로 옮기고 Delete로 지운다 */
  function onItemKey(event: KeyboardEvent, item: Item) {
    const step = event.shiftKey ? 0.02 : 0.005;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      remove(item.id);
      return;
    }
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    select(item.id);
    const width = item.kind === 'text' ? 0 : item.width;
    const height = item.kind === 'text' ? 0 : item.height;
    item.x = clamp(item.x + move[0], 0, 1 - width);
    item.y = clamp(item.y + move[1], 0, 1 - height);
  }

  function remove(id: number) {
    items = items.filter((item) => item.id !== id);
    if (selectedId === id) selectedId = undefined;
  }

  function describe(item: Item) {
    return item.kind === 'text' ? t.item.text(item.text.split('\n')[0]!) : t.item[item.kind];
  }

  const rgbCss = (color: [number, number, number], alpha = 1) =>
    `rgb(${color.map((value) => Math.round(value * 255)).join(' ')} / ${alpha})`;
</script>

<SinglePdfTool {onload}>
  {#snippet children({ doc })}
    <ActionBar label={t.bar}>
      {#snippet text()}
        {#if run.kind === 'working'}
          {t.working}
        {:else if result}
          {common.action.done(result.name, formatSize(result.bytes.length))}
        {:else if failure}
          <strong>{failure}</strong>
        {:else}
          {blocker ?? t.ready(cleaned.length)}
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
          disabled={blocker !== undefined || run.kind === 'working'}
          onclick={apply}>{run.kind === 'working' ? t.working : t.run}</button
        >
      {/if}
    </ActionBar>

    <div class="tool-body">
      <div class="choices">
        <div class="choice" role="radiogroup" aria-label={t.modeGroup}>
          {#each MODES as option (option)}
            <label class:checked={mode === option}>
              <input type="radio" name="mode" value={option} bind:group={mode} />
              <span class="long">{t.modes[option].label}</span>
              <span class="short">{t.modes[option].short}</span>
            </label>
          {/each}
        </div>
      </div>
      {#if mode === 'whiteout'}
        <p class="problem">{t.whiteoutNote}</p>
      {/if}

      <div class="sheet">
        <PageSheet {doc} bind:pageIndex bind:view help={t.help[mode]}>
          <!-- 쪽 위의 편집 칸. 끌기·누르기를 받는다 -->
          <div
            class="overlay mode-{mode}"
            bind:this={overlay}
            role="presentation"
            onpointerdown={onSheetDown}
            onpointermove={onMove}
            onpointerup={onUp}
            onpointercancel={onUp}
          >
            {#each pageItems as item (item.id)}
              {#if item.kind === 'text'}
                <div
                  class="item text"
                  class:selected={item.id === selectedId}
                  role="button"
                  tabindex="0"
                  aria-label={describe(item)}
                  style:left="{item.x * 100}%"
                  style:top="{item.y * 100}%"
                  style:font-size="{item.size * scale}px"
                  style:margin-top="{-item.size * scale * TEXT_SHIFT}px"
                  style:font-family={family ? `"${family}"` : undefined}
                  style:color={rgbCss(item.color)}
                  onpointerdown={(event) => onItemDown(event, item)}
                  onkeydown={(event) => onItemKey(event, item)}
                >
                  {#each item.text.split('\n') as line, i (i)}<span class="line"
                      >{line || '\u00a0'}</span
                    >{/each}
                </div>
              {:else}
                <div
                  class="item rect {item.kind}"
                  class:selected={item.id === selectedId}
                  role="button"
                  tabindex="0"
                  aria-label={describe(item)}
                  style:left="{item.x * 100}%"
                  style:top="{item.y * 100}%"
                  style:width="{item.width * 100}%"
                  style:height="{item.height * 100}%"
                  style:background={item.kind === 'highlight'
                    ? rgbCss(HIGHLIGHT.color, HIGHLIGHT.opacity)
                    : undefined}
                  onpointerdown={(event) => onItemDown(event, item)}
                  onkeydown={(event) => onItemKey(event, item)}
                ></div>
              {/if}
            {/each}
            {#if drag?.kind === 'draw'}
              <div
                class="item rect drawing {drag.rect}"
                style:left="{Math.min(drag.from.x, drag.to.x) * 100}%"
                style:top="{Math.min(drag.from.y, drag.to.y) * 100}%"
                style:width="{Math.abs(drag.to.x - drag.from.x) * 100}%"
                style:height="{Math.abs(drag.to.y - drag.from.y) * 100}%"
                style:background={drag.rect === 'highlight'
                  ? rgbCss(HIGHLIGHT.color, HIGHLIGHT.opacity)
                  : undefined}
              ></div>
            {/if}
          </div>
        </PageSheet>
      </div>

      <div class="items-bar">
        <span>{t.count(cleaned.length)}</span>
        <button
          type="button"
          class="btn"
          disabled={items.length === 0}
          onclick={() => remove(items.at(-1)!.id)}>{t.undo}</button
        >
      </div>

      {#if selected}
        <fieldset class="panel">
          <legend>{t.selected}: {describe(selected)}</legend>
          {#if selected.kind === 'text'}
            <label class="field">
              {t.textLabel}
              <textarea rows="3" bind:this={textArea} bind:value={selected.text}></textarea>
            </label>
            <div class="row">
              <label class="field size">
                {t.sizeLabel}
                <input
                  type="number"
                  min="4"
                  max="200"
                  inputmode="numeric"
                  value={selected.size}
                  oninput={(event) => {
                    const value = Number(event.currentTarget.value);
                    if (value >= 4 && value <= 200) {
                      selected.size = value;
                      textSize = value;
                    }
                  }}
                />
              </label>
              <div class="choice" role="radiogroup" aria-label={t.tintGroup}>
                {#each TINTS as option (option)}
                  <label class:checked={selected.color.join() === COLORS[option].join()}>
                    <input
                      type="radio"
                      name="tint"
                      checked={selected.color.join() === COLORS[option].join()}
                      onchange={() => {
                        selected.color = COLORS[option];
                        textTint = option;
                      }}
                    />
                    {t.tints[option]}
                  </label>
                {/each}
              </div>
            </div>
          {/if}
          <button type="button" class="btn" onclick={() => remove(selected.id)}>{t.remove}</button>
        </fieldset>
      {/if}

      {#if needsFont || mode === 'text' || items.some((item) => item.kind === 'text')}
        <FontPicker bind:selected={font} />
      {/if}
    </div>
  {/snippet}
</SinglePdfTool>

<style>
  .sheet {
    margin-bottom: 12px;
  }
  .overlay {
    position: absolute;
    inset: 0;
    overflow: hidden;
    touch-action: none;
  }
  .overlay.mode-text {
    cursor: text;
  }
  .overlay.mode-whiteout,
  .overlay.mode-highlight {
    cursor: crosshair;
  }
  .item {
    position: absolute;
    cursor: move;
  }
  /* 사각형을 그리는 도구에서는 넣은 것 위에서도 새로 그린다 (끌어도 넣은 것이 옮겨지지 않게) */
  .mode-whiteout .item,
  .mode-highlight .item {
    pointer-events: none;
  }
  /* 글자 도구에서는 가린 자리·형광펜 위를 눌러도 새 글자 상자를 만든다 (가리고 고쳐 쓰기) */
  .mode-text .item.rect {
    pointer-events: none;
  }
  .item:focus-visible,
  .item.selected {
    outline: 2px solid var(--color-accent);
    outline-offset: 1px;
  }
  .text {
    min-width: 8px;
    line-height: 1.25;
  }
  .text .line {
    display: block;
    white-space: pre;
  }
  /* 흰색 가리기: 결과는 흰색이지만 흰 종이 위에서도 보이게 점선 테두리를 둔다 (테두리는 결과에 없다) */
  .rect.whiteout {
    background: var(--color-paper);
    box-shadow: inset 0 0 0 1px var(--color-line);
  }
  .rect.drawing {
    outline: 1px dashed var(--color-accent);
  }
  .items-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
    font-size: 14px;
  }
  .panel {
    margin: 0 0 16px;
    padding: 12px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius);
  }
  .panel legend {
    padding: 0 4px;
    font-size: 14px;
    font-weight: 600;
  }
  .panel textarea {
    padding: 8px 12px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius);
    background: var(--color-bg);
    font: inherit;
    font-size: 15px;
    font-weight: 400;
    resize: vertical;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 12px;
    margin-bottom: 12px;
  }
  .row .field {
    margin-bottom: 0;
  }
  .size input {
    width: 100px;
  }
</style>
