<!--
  PDF 문서 정보 도구 화면 (격리 frame 안에서 실행).
  제목·작성자·주제·키워드를 고치거나, 만든 프로그램·날짜까지 숨은 문서 정보를 모두 지운다.
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
  import { modifyPdf, type DocumentInfo } from '../../../lib/pdf/modify';
  import SinglePdfTool, { type LoadedPdf } from '../../../lib/pdf/SinglePdfTool.svelte';

  const common = pick(FRAME_MESSAGES);
  const t = pick(MESSAGES);

  const EDITABLE = ['title', 'author', 'subject', 'keywords'] as const;

  let pdf: LoadedPdf | undefined = $state.raw();
  let info: DocumentInfo = $state({ title: '', author: '', subject: '', keywords: '' });
  let other = $state({ creator: '', producer: '', created: '', modified: '' });
  let clear = $state(false);
  let reading = $state(false);

  const signature = $derived(JSON.stringify([info, clear]));
  type Run =
    | { kind: 'idle' }
    | { kind: 'working' }
    | { kind: 'done'; name: string; bytes: Uint8Array; signature: string }
    | { kind: 'failed'; message: string };
  let run = $state<Run>({ kind: 'idle' });
  const result = $derived(run.kind === 'done' && run.signature === signature ? run : undefined);

  /** PDF 날짜(D:YYYYMMDDHHmmSS…)를 읽기 쉬운 날짜로 */
  function formatDate(value: unknown): string {
    if (typeof value !== 'string') return '';
    const match = /^D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?/.exec(value);
    if (!match) return value;
    const [, year, month = '01', day = '01', hour = '00', minute = '00'] = match;
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
    );
    return new Intl.DateTimeFormat(frameLocale, { dateStyle: 'medium', timeStyle: 'short' }).format(
      date,
    );
  }

  const text = (value: unknown) => (typeof value === 'string' ? value : '');

  async function readInfo(source: LoadedPdf) {
    reading = true;
    try {
      const { info: raw } = (await source.doc.getMetadata()) as { info: Record<string, unknown> };
      if (pdf !== source) return;
      info = {
        title: text(raw.Title),
        author: text(raw.Author),
        subject: text(raw.Subject),
        keywords: text(raw.Keywords),
      };
      other = {
        creator: text(raw.Creator),
        producer: text(raw.Producer),
        created: formatDate(raw.CreationDate),
        modified: formatDate(raw.ModDate),
      };
    } finally {
      if (pdf === source) reading = false;
    }
  }

  function onload(loaded: LoadedPdf) {
    pdf = loaded;
    clear = false;
    run = { kind: 'idle' };
    readInfo(loaded);
  }

  async function save() {
    if (!pdf || run.kind === 'working') return;
    const entitlement = await canUse('pdf/metadata');
    if (!entitlement.allowed) {
      run = { kind: 'failed', message: entitlement.reason ?? common.action.unavailable };
      return;
    }
    const source = pdf;
    const startedWith = signature;
    run = { kind: 'working' };
    try {
      const bytes = await modifyPdf(source, {
        kind: 'metadata',
        info: $state.snapshot(info),
        clear,
      });
      if (pdf !== source) return;
      run = {
        kind: 'done',
        name: `${baseName(source.name)}_${t.suffix}.pdf`,
        bytes,
        signature: startedWith,
      };
    } catch {
      if (pdf === source) run = { kind: 'failed', message: t.failed };
    }
  }
</script>

<SinglePdfTool {onload}>
  {#snippet children()}
    <ActionBar label={t.bar}>
      {#snippet text()}
        {#if reading}
          {t.reading}
        {:else if run.kind === 'working'}
          {t.working}
        {:else if result}
          {common.action.done(result.name, formatSize(result.bytes.length))}
        {:else if run.kind === 'failed'}
          <strong>{run.message}</strong>
        {:else}
          {t.ready}
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
          disabled={reading || run.kind === 'working'}
          onclick={save}>{t.run}</button
        >
      {/if}
    </ActionBar>

    <div class="tool-body">
      {#each EDITABLE as key (key)}
        <label class="field">
          {t[key]}
          <input type="text" bind:value={info[key]} disabled={clear} />
        </label>
      {/each}

      <label class="check">
        <input type="checkbox" bind:checked={clear} />
        {t.clear}
      </label>
      <p class="help">{t.clearNote}</p>

      <section class="other" aria-label={t.readOnlyGroup}>
        <h2>{t.readOnlyGroup}</h2>
        <dl>
          {#each [['creator', other.creator], ['producer', other.producer], ['created', other.created], ['modified', other.modified]] as const as [key, value] (key)}
            <dt>{t[key]}</dt>
            <dd>{value || t.empty}</dd>
          {/each}
        </dl>
      </section>
    </div>
  {/snippet}
</SinglePdfTool>

<style>
  .field {
    max-width: 480px;
  }
  .check {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
    font-size: 14px;
    cursor: pointer;
  }
  .check input {
    width: 18px;
    height: 18px;
    accent-color: var(--color-text);
  }
  .other h2 {
    margin: 8px 0;
    font-size: 15px;
  }
  dl {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 6px 16px;
    margin: 0;
    font-size: 14px;
  }
  dt {
    color: var(--color-muted);
  }
  dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
</style>
