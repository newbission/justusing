<!--
  CSV 한글 깨짐 고치기 도구 화면 (격리 frame 안에서 실행).
  넣은 파일마다 인코딩을 알아내 앞부분을 '지금 열리는 모습'과 '바꾼 뒤'로 보여 주고,
  고른 형식(엑셀용 UTF-8·UTF-8·CP949)으로 다시 저장한다. 파일은 어디로도 전송되지 않는다.
-->
<script lang="ts">
  import '../../../frame/controls.css';
  import { onMount } from 'svelte';
  import { frameLocale, pick } from '../../../frame/locale';
  import { FRAME_MESSAGES } from '../../../frame/messages';
  import { MESSAGES } from './messages';
  import ActionBar from '../../../frame/ActionBar.svelte';
  import FileDrop from '../../../frame/FileDrop.svelte';
  import { onFrameFiles } from '../../../frame/drop';
  import { requestShowTool } from '../../../frame/parent';
  import { downloadFile } from '../../../frame/download';
  import { baseName, formatSize } from '../../../frame/format';
  import { canUse } from '../../../lib/entitlement';
  import { convertFile, detectFile, type Converted } from '../../../lib/text/convert';
  import {
    SOURCE_ENCODINGS,
    asCp949,
    previewRows,
    type Detection,
    type Newline,
    type SourceEncoding,
    type TargetFormat,
  } from '../../../lib/text/encoding';
  import { makeZip } from '../../../lib/zip';

  const common = pick(FRAME_MESSAGES);
  const t = pick(MESSAGES);
  const FORMATS: TargetFormat[] = ['excel', 'utf8', 'cp949'];
  const NEWLINES: Newline[] = ['keep', 'crlf', 'lf'];
  const ACCEPT = '.csv,.tsv,.txt,text/csv,text/plain,text/tab-separated-values';
  /** 엑셀이 BOM 없는 파일을 읽는 인코딩 (화면 언어의 윈도우 기본 인코딩) */
  const EXCEL_DEFAULT: SourceEncoding = frameLocale === 'ko' ? 'euc-kr' : 'windows-1252';
  /** 미리보기 표에 보여 줄 최대 칸 수 */
  const MAX_COLUMNS = 8;

  interface Item {
    id: number;
    name: string;
    file: File;
    status: 'detecting' | 'ready' | 'empty' | 'binary' | 'error';
    detection?: Detection;
    /** 미리보기용 앞부분과 그것이 파일 전체인지 */
    head?: Uint8Array;
    complete?: boolean;
    /** 지금 고른 원본 인코딩 (처음에는 알아낸 것) */
    source?: SourceEncoding;
  }

  type Outcome =
    | { state: 'working'; percent: number }
    | ({ state: 'done'; name: string } & Converted)
    /** 이미 고른 형식이라 바꾸지 않음 */
    | { state: 'kept' }
    | { state: 'failed' };

  let items: Item[] = $state([]);
  let nextId = 0;
  let format: TargetFormat = $state('excel');
  let newline: Newline = $state('keep');
  let working = $state(false);
  /** 처리 중인 파일 순서 (막대 안내) */
  let progress = $state({ index: 0, count: 0 });
  /** 파일마다 마지막 결과와 그때의 설정 */
  let outcomes: Record<number, Outcome & { key: string }> = $state({});
  let selectedId: number | undefined = $state();

  const ready = $derived(items.filter((item) => item.status === 'ready'));
  const totalSize = $derived(items.reduce((sum, item) => sum + item.file.size, 0));
  const selected = $derived(items.find((item) => item.id === selectedId) ?? ready[0]);

  const keyOf = (item: Item) => `${item.source}|${format}|${newline}`;
  const outcomeOf = (item: Item) =>
    outcomes[item.id]?.key === keyOf(item) ? outcomes[item.id] : undefined;

  function accepted(file: File) {
    return (
      /\.(csv|tsv|txt)$/i.test(file.name) ||
      ['text/csv', 'text/plain', 'text/tab-separated-values'].includes(file.type)
    );
  }

  function add(files: File[]) {
    const first = items.length === 0;
    const added = files.filter(accepted);
    for (const file of added) {
      const item: Item = { id: nextId++, name: file.name, file, status: 'detecting' };
      items.push(item);
      detect(items.at(-1)!);
    }
    if (added.length > 0 && first) requestShowTool();
  }

  async function detect(item: Item) {
    try {
      const { detection, head, complete } = await detectFile(item.file);
      if (!items.includes(item)) return;
      item.detection = detection;
      item.head = head;
      item.complete = complete;
      item.source = detection.encoding;
      item.status = detection.kind === 'text' ? 'ready' : detection.kind;
    } catch {
      item.status = 'error';
    }
  }

  function remove(item: Item) {
    items = items.filter((other) => other !== item);
    delete outcomes[item.id];
    if (selectedId === item.id) selectedId = undefined;
  }

  onMount(() =>
    onFrameFiles((files) => {
      if (!working) add(files);
    }),
  );

  /** 바꿔도 같은 파일이 나오는지 (이미 고른 형식) */
  function unchanged(item: Item): boolean {
    const detection = item.detection!;
    if (newline !== 'keep' || item.source !== detection.encoding) return false;
    if (format === 'excel') return detection.encoding === 'utf-8' && detection.bom;
    if (detection.bom) return false;
    if (detection.ascii) return true;
    return format === 'utf8' ? detection.encoding === 'utf-8' : detection.encoding === 'euc-kr';
  }

  /** 모든 파일을 지금 설정으로 처리했으면 그 결과 */
  const summary = $derived.by(() => {
    if (working || ready.length === 0) return undefined;
    let failed = false;
    let unmappable = 0;
    let broken = false;
    for (const item of ready) {
      const outcome = outcomeOf(item);
      if (!outcome || outcome.state === 'working') return undefined;
      if (outcome.state === 'failed') failed = true;
      if (outcome.state === 'done') {
        unmappable += outcome.unmappable.count;
        if (outcome.broken > 0) broken = true;
      }
    }
    const converted = ready.filter((item) => outcomeOf(item)?.state === 'done');
    const kept = ready.filter((item) => outcomeOf(item)?.state === 'kept');
    return { failed, unmappable, broken, converted, kept };
  });

  const blocker = $derived.by(() => {
    if (items.some((item) => item.status === 'detecting')) return t.detecting;
    if (ready.length === 0) return t.needOne;
    return undefined;
  });

  /** 지금 처리 중인 파일의 진행률 */
  const percent = $derived.by(() => {
    for (const item of ready) {
      const outcome = outcomeOf(item);
      if (outcome?.state === 'working') return outcome.percent;
    }
    return 0;
  });

  function resultName(item: Item): string {
    const extension = item.name.match(/\.(csv|tsv|txt)$/i)?.[0] ?? '.csv';
    return `${baseName(item.name)}_${t.suffix[format]}${extension}`;
  }

  async function run() {
    if (blocker || working) return;
    const entitlement = await canUse('text/csv-encoding');
    if (!entitlement.allowed) return;

    const targets = ready.filter((item) => {
      const state = outcomeOf(item)?.state;
      return state !== 'done' && state !== 'kept';
    });
    working = true;
    for (const [index, item] of targets.entries()) {
      const key = keyOf(item);
      progress = { index: index + 1, count: targets.length };
      if (unchanged(item)) {
        outcomes[item.id] = { state: 'kept', key };
        continue;
      }
      outcomes[item.id] = { state: 'working', percent: 0, key };
      let outcome: Outcome;
      try {
        const result = await convertFile(
          item.file,
          { source: item.source!, target: format, newline },
          (done, total) => {
            if (!items.includes(item)) return;
            const percent = total > 0 ? Math.floor((done / total) * 100) : 100;
            outcomes[item.id] = { state: 'working', percent, key };
          },
        );
        outcome = { state: 'done', name: resultName(item), ...result };
      } catch {
        outcome = { state: 'failed' };
      }
      // 처리하는 동안 목록에서 뺀 파일의 결과는 두지 않는다
      if (items.includes(item)) outcomes[item.id] = { ...outcome, key };
    }
    working = false;
  }

  /** ZIP에 들어가는 파일 수 (바꾼 것과 원본 그대로 둔 것) */
  const zipCount = $derived(
    ready.filter((item) => {
      const state = outcomeOf(item)?.state;
      return state === 'done' || state === 'kept';
    }).length,
  );

  async function downloadAll() {
    const files = await Promise.all(
      ready.map(async (item) => {
        const outcome = outcomeOf(item);
        // 바꾼 것은 결과를, 이미 고른 형식이던 것은 원본을 넣어 고른 파일이 모두 들어 있게 한다
        if (outcome?.state === 'done') {
          return { name: outcome.name, bytes: new Uint8Array(await outcome.blob.arrayBuffer()) };
        }
        if (outcome?.state === 'kept') {
          return { name: item.name, bytes: new Uint8Array(await item.file.arrayBuffer()) };
        }
        return undefined;
      }),
    );
    const zip = await makeZip(files.filter((file) => file !== undefined));
    downloadFile(zip, t.zipName, 'application/zip');
  }

  function downloadOne(item: Item) {
    const outcome = outcomeOf(item);
    if (outcome?.state === 'done') downloadFile(outcome.blob, outcome.name);
  }

  /** 목록 줄: 알아낸 인코딩 */
  function describe(item: Item): string {
    const detection = item.detection!;
    const name = t.encodings[item.source!];
    if (item.source !== detection.encoding) return t.chosen(name);
    if (detection.ascii) return t.ascii;
    if (detection.bom) return t.withBom(name);
    if (detection.encoding === 'utf-8') return t.withoutBom(name);
    return name;
  }

  /** 줄 설명 */
  function meta(item: Item): string {
    const outcome = outcomeOf(item);
    if (outcome?.state === 'working') return t.itemWorking(outcome.percent);
    if (outcome?.state === 'kept') return t.itemKept;
    if (outcome?.state === 'done') {
      const parts = [
        t.itemDone(
          t.encodings[item.source!],
          t.formats[format].short,
          formatSize(item.file.size),
          formatSize(outcome.blob.size),
        ),
      ];
      if (outcome.unmappable.count > 0) parts.push(t.itemUnmappable(outcome.unmappable.count));
      if (outcome.broken > 0) parts.push(t.itemBroken(outcome.broken));
      return parts.join(' · ');
    }
    return `${describe(item)} · ${formatSize(item.file.size)}`;
  }

  /** 미리보기: 지금 열리는 모습과 바꾼 뒤 */
  const view = $derived.by(() => {
    const item = selected;
    if (!item || item.status !== 'ready' || !item.head) return undefined;
    const source = item.source!;
    const detection = item.detection!;
    const read = previewRows(item.head, source, item.complete!, item.name);
    // CP949로 저장하면 없는 글자가 ?가 되므로 바꾼 뒤 표에도 그렇게 보인다
    const after =
      format === 'cp949'
        ? { ...read, rows: read.rows.map((row) => row.map((cell) => asCp949(cell))) }
        : read;
    // BOM이 있으면 엑셀도 그것을 따른다. 엑셀이 바로 읽는 인코딩이면 UTF-8로 읽는 곳의 모습을 보인다
    const bomRead = detection.bom && source === detection.encoding;
    const beforeEncoding = bomRead ? source : source === EXCEL_DEFAULT ? 'utf-8' : EXCEL_DEFAULT;
    const before = previewRows(item.head, beforeEncoding, item.complete!, item.name);
    const same = JSON.stringify(before.rows) === JSON.stringify(after.rows);
    const note = !same
      ? undefined
      : detection.ascii && source === detection.encoding
        ? t.asciiNote
        : bomRead
          ? t.bomNote
          : t.sameNote;
    return {
      item,
      after,
      before: same ? undefined : before,
      beforeLabel: beforeEncoding === 'utf-8' ? t.utf8View : t.excelView,
      note,
      broken: read.rows.some((row) => row.some((cell) => cell.includes('\ufffd'))),
    };
  });

  const columnName = (index: number) => String.fromCharCode(65 + index);

  function setSource(item: Item, value: string) {
    const encoding = SOURCE_ENCODINGS.find((option) => option === value);
    if (encoding) item.source = encoding;
  }
</script>

{#snippet table(label: string, preview: { rows: string[][]; more: boolean }, out: boolean)}
  {@const columns = Math.min(
    MAX_COLUMNS,
    preview.rows.reduce((max, row) => Math.max(max, row.length), 0),
  )}
  <figure class="sheet" class:out>
    <figcaption>{label}</figcaption>
    {#if preview.rows.length === 0}
      <p class="help">{t.previewEmpty}</p>
    {:else}
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th scope="col" class="corner"></th>
              {#each { length: columns } as _, column (column)}
                <th scope="col">{columnName(column)}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each preview.rows as row, index (index)}
              <tr>
                <th scope="row">{index + 1}</th>
                {#each { length: columns } as _, column (column)}
                  <td title={row[column] ?? ''}>{row[column] ?? ''}</td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </figure>
{/snippet}

<div class="tool">
  {#if items.length === 0}
    <div class="drop">
      <FileDrop accept={ACCEPT} label={t.choose} multiple hint={t.hint} onfiles={add} />
    </div>
  {:else}
    <div class="summary">
      <span aria-live="polite">{t.summary(items.length, formatSize(totalSize))}</span>
      <label class="btn" class:disabled={working}>
        {t.add}
        <input
          type="file"
          class="visually-hidden"
          accept={ACCEPT}
          multiple
          disabled={working}
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
        {#if working}
          {t.working(percent, progress.index, progress.count)}
        {:else if summary?.failed}
          <strong>{t.failed}</strong>
        {:else if summary && summary.converted.length === 0}
          {t.nothing}
        {:else if summary && summary.unmappable > 0}
          <strong>{t.doneUnmappable(summary.unmappable)}</strong>
        {:else if summary?.broken}
          <strong>{t.doneBroken}</strong>
        {:else if summary}
          {t.done(summary.converted.length)}
        {:else}
          {blocker ?? t.ready(ready.length, t.formats[format].label)}
        {/if}
      {/snippet}
      {#if summary && summary.converted.length > 0 && ready.length === 1}
        <button type="button" class="btn primary" onclick={() => downloadOne(summary.converted[0]!)}
          >{common.action.download}</button
        >
      {:else if summary && summary.converted.length > 0}
        <button type="button" class="btn primary" onclick={downloadAll}
          >{t.downloadAll(zipCount)}</button
        >
      {:else}
        <button
          type="button"
          class="btn primary"
          disabled={blocker !== undefined || working || summary !== undefined}
          onclick={run}>{working ? t.workingShort : t.run}</button
        >
      {/if}
    </ActionBar>

    <div class="tool-body">
      <div class="options">
        <div class="option">
          <span class="option-name">{t.formatGroup}</span>
          <div class="choice" role="radiogroup" aria-label={t.formatGroup}>
            {#each FORMATS as option (option)}
              <label class:checked={format === option}>
                <input
                  type="radio"
                  name="format"
                  value={option}
                  bind:group={format}
                  disabled={working}
                />
                <span class="long">{t.formats[option].label}</span>
                <span class="short">{t.formats[option].short}</span>
              </label>
            {/each}
          </div>
        </div>
        <p class="help">{t.formatHelp[format]}</p>
        <div class="option">
          <span class="option-name">{t.newlineGroup}</span>
          <div class="choice" role="radiogroup" aria-label={t.newlineGroup}>
            {#each NEWLINES as option (option)}
              <label class:checked={newline === option}>
                <input
                  type="radio"
                  name="newline"
                  value={option}
                  bind:group={newline}
                  disabled={working}
                />
                <span class="long">{t.newlines[option].label}</span>
                <span class="short">{t.newlines[option].short}</span>
              </label>
            {/each}
          </div>
        </div>
      </div>

      <ul class="list" aria-label={t.list}>
        {#each items as item (item.id)}
          {@const outcome = outcomeOf(item)}
          <li class="row" class:selected={view?.item === item}>
            <div class="info">
              <span class="name" title={item.name}>{item.name}</span>
              <span class="meta">
                {#if item.status === 'detecting'}
                  {t.detecting}
                {:else if item.status === 'empty'}
                  <strong>{t.empty}</strong>
                {:else if item.status === 'binary'}
                  <strong>{t.binary}</strong>
                {:else if item.status === 'error'}
                  <strong>{t.unreadable}</strong>
                {:else if outcome?.state === 'failed'}
                  <strong>{t.itemFailed}</strong>
                {:else}
                  {meta(item)}
                {/if}
              </span>
            </div>
            {#if item.status === 'ready'}
              <button
                type="button"
                class="btn"
                aria-pressed={view?.item === item}
                aria-label={t.previewOf(item.name)}
                onclick={() => (selectedId = item.id)}>{t.previewShort}</button
              >
            {/if}
            {#if outcome?.state === 'done'}
              <button
                type="button"
                class="btn icon"
                onclick={() => downloadOne(item)}
                aria-label={t.download(item.name)}>↓</button
              >
            {/if}
            <button
              type="button"
              class="btn icon"
              disabled={working}
              onclick={() => remove(item)}
              aria-label={t.remove(item.name)}>×</button
            >
          </li>
        {/each}
      </ul>

      {#if view}
        {@const outcome = outcomeOf(view.item)}
        <section class="preview" aria-label={t.previewOf(view.item.name)}>
          <div class="preview-head">
            <h2 class="preview-title" title={view.item.name}>{t.previewOf(view.item.name)}</h2>
            <label class="source">
              <span>{t.sourceLabel}</span>
              <select
                value={view.item.source}
                disabled={working}
                onchange={(event) => setSource(view.item, event.currentTarget.value)}
              >
                {#each SOURCE_ENCODINGS as encoding (encoding)}
                  <option value={encoding}
                    >{encoding === view.item.detection!.encoding
                      ? t.auto(t.encodings[encoding])
                      : t.encodings[encoding]}</option
                  >
                {/each}
              </select>
            </label>
          </div>
          <p class="help">{t.sourceHelp}</p>
          {#if view.broken}
            <p class="problem">{t.brokenNote(t.encodings[view.item.source!])}</p>
          {/if}
          {#if outcome?.state === 'done' && outcome.unmappable.count > 0}
            <p class="problem">
              {t.unmappableList(
                outcome.unmappable.examples
                  .map((example) => t.unmappableExample(example.char, example.line))
                  .join(', '),
              )}
            </p>
          {/if}
          {#if view.before}
            {@render table(view.beforeLabel, view.before, false)}
            {@render table(t.afterView, view.after, true)}
          {:else}
            {@render table(t.sameView, view.after, true)}
            {#if view.note}<p class="help">{view.note}</p>{/if}
          {/if}
          {#if view.after.more}<p class="help">{t.more}</p>{/if}
        </section>
      {/if}
    </div>
  {/if}
</div>

<style>
  .tool {
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
  label.disabled {
    opacity: 0.4;
    cursor: default;
  }
  /* 한글은 낱말 단위로 줄을 바꾼다 */
  .tool-body {
    word-break: keep-all;
  }
  .options {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px 24px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--color-line);
  }
  .options .help {
    flex-basis: 100%;
    margin: 0;
  }
  .option {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
  }
  .option-name {
    font-size: 14px;
    font-weight: 600;
  }
  .list {
    margin: 0;
    padding: 8px 0;
    list-style: none;
    border-bottom: 1px solid var(--color-line);
  }
  /* 줄 높이 고정: 살피는 동안·처리한 뒤에 목록이 흔들리지 않게 */
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 56px;
    padding: 0 8px;
    border-radius: var(--radius);
  }
  .row.selected {
    background: var(--color-accent-soft);
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
  .row :global(.btn.icon) {
    font-size: 18px;
    line-height: 1;
  }
  .row .btn[aria-pressed='true'] {
    border-color: var(--color-text);
    font-weight: 600;
  }
  .preview {
    padding-top: 16px;
  }
  .preview-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 16px;
    margin-bottom: 8px;
  }
  .preview-title {
    min-width: 0;
    margin: 0;
    overflow: hidden;
    font-size: 15px;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .source {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
  }
  .source select {
    height: 36px;
    max-width: 100%;
    padding: 0 8px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius);
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 14px;
  }
  .preview .help,
  .preview .problem {
    margin-bottom: 12px;
  }
  .sheet {
    margin: 0 0 16px;
  }
  figcaption {
    margin-bottom: 6px;
    color: var(--color-muted);
    font-size: 13px;
    font-weight: 600;
  }
  .sheet.out figcaption {
    color: var(--color-accent);
  }
  .scroll {
    overflow-x: auto;
    border: 1px solid var(--color-line);
    border-radius: var(--radius);
    background: var(--color-bg);
  }
  .sheet.out .scroll {
    border-color: var(--color-accent);
  }
  table {
    min-width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  th,
  td {
    max-width: 180px;
    height: 30px;
    padding: 0 10px;
    overflow: hidden;
    border-right: 1px solid var(--color-line);
    border-bottom: 1px solid var(--color-line);
    text-align: left;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  th {
    color: var(--color-muted);
    font-weight: 400;
    text-align: center;
  }
  thead th {
    background: var(--color-hover);
  }
  tbody th {
    width: 32px;
    background: var(--color-hover);
  }
  tr > :last-child {
    border-right: none;
  }
  tbody tr:last-child > * {
    border-bottom: none;
  }
</style>
