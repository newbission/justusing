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
  /** 암호나 인쇄·복사 제한이 걸린 PDF (결과에서는 풀린다) */
  let encrypted = $state(false);

  const signature = $derived(JSON.stringify([info, clear]));
  type Run =
    | { kind: 'idle' }
    | { kind: 'working' }
    | { kind: 'done'; name: string; bytes: Uint8Array; signature: string }
    | { kind: 'failed'; message: string };
  let run = $state<Run>({ kind: 'idle' });
  const result = $derived(run.kind === 'done' && run.signature === signature ? run : undefined);

  /**
   * PDF 날짜(D:YYYYMMDDHHmmSS + 시간대 Z·+09'00')를 읽기 쉬운 날짜로.
   * 시간대가 있으면 그 순간을 이 기기의 시각으로 바꿔 보여 준다
   */
  function formatDate(value: unknown): string {
    if (typeof value !== 'string' || !value) return '';
    // XMP 날짜만 (2025-05-06, 2025-05): 시간대가 없으니 그날 그대로 보여 준다
    // (new Date는 이를 세계 표준시 자정으로 읽어 서쪽 나라에서는 전날이 된다)
    // 연도만·연월만 적혔으면 그만큼만 보여 준다 (없는 월·일을 만들지 않는다)
    const dateOnly = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(value);
    if (dateOnly) {
      const [, year, month, date] = dateOnly;
      const at = new Date(Number(year), Number(month ?? 1) - 1, Number(date ?? 1));
      const style: Intl.DateTimeFormatOptions = date
        ? { dateStyle: 'medium' }
        : month
          ? { year: 'numeric', month: 'long' }
          : { year: 'numeric' };
      return new Intl.DateTimeFormat(frameLocale, style).format(at);
    }
    // XMP 날짜와 시각 (2026-01-02T03:04:05+09:00)
    if (/^\d{4}-\d{2}/.test(value)) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return value;
      return new Intl.DateTimeFormat(frameLocale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
    }
    const match =
      /^D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?(?:(Z)|([+-])(\d{2})'?(\d{2})?'?)?/.exec(
        value,
      );
    if (!match) return value;
    // 연도·월·일까지만 적혔으면 그만큼만 보여 준다 (시각이 없으면 시간대도 따지지 않는다)
    if (match[4] === undefined) {
      const [, onlyYear, onlyMonth, onlyDay] = match;
      return formatDate(
        [onlyYear, onlyMonth, onlyDay].filter((part) => part !== undefined).join('-'),
      );
    }
    const [, year, month = '01', day = '01', hour = '00', minute = '00', second = '00'] = match;
    const [zulu, sign, offsetHour = '00', offsetMinute = '00'] = match.slice(7);
    const fields = [year, month, day, hour, minute, second].map(Number);
    const [y, mo, d, h, mi, se] = fields as [number, number, number, number, number, number];
    // 시간대가 없으면(규격상 알 수 없음) 이 기기의 시각으로 본다
    const date =
      zulu || sign
        ? new Date(
            Date.UTC(y, mo - 1, d, h, mi, se) -
              (sign === '-' ? -1 : 1) * (Number(offsetHour) * 60 + Number(offsetMinute)) * 60_000,
          )
        : new Date(y, mo - 1, d, h, mi, se);
    return new Intl.DateTimeFormat(frameLocale, { dateStyle: 'medium', timeStyle: 'short' }).format(
      date,
    );
  }

  const text = (value: unknown) => (typeof value === 'string' ? value : '');

  async function readInfo(source: LoadedPdf) {
    reading = true;
    try {
      const { info: raw, metadata } = (await source.doc.getMetadata()) as {
        info: Record<string, unknown>;
        metadata: { get: (name: string) => unknown } | null;
      };
      if (pdf !== source) return;
      // pdf.js는 암호화된 PDF에 암호화 방식 이름을 알려 준다 (열 암호 없이 제한만 걸린 PDF 포함)
      encrypted = !!raw.EncryptFilterName;
      // Info에 없고 XMP에만 있는 값도 읽는다 (저장하면 XMP를 지우므로, 읽지 않으면 그 값이 사라진다)
      const xmp = (name: string) => {
        const value = metadata?.get(name);
        return Array.isArray(value)
          ? value.filter((item) => typeof item === 'string').join(', ')
          : text(value);
      };
      info = {
        title: text(raw.Title) || xmp('dc:title'),
        author: text(raw.Author) || xmp('dc:creator'),
        subject: text(raw.Subject) || xmp('dc:description'),
        // 키워드는 pdf:Keywords 또는 Dublin Core의 dc:subject(목록)에 있다
        keywords: text(raw.Keywords) || xmp('pdf:keywords') || xmp('dc:subject'),
      };
      other = {
        // PDF/A 등은 이 값들을 XMP에만 적기도 한다 (pdf.js는 XMP 이름을 소문자로 준다)
        creator: text(raw.Creator) || xmp('xmp:creatortool'),
        producer: text(raw.Producer) || xmp('pdf:producer'),
        created: formatDate(raw.CreationDate) || formatDate(xmp('xmp:createdate')),
        modified: formatDate(raw.ModDate) || formatDate(xmp('xmp:modifydate')),
      };
    } finally {
      if (pdf === source) reading = false;
    }
  }

  function onload(loaded: LoadedPdf) {
    pdf = loaded;
    clear = false;
    encrypted = false;
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
      {#if encrypted}
        <p class="help"><strong>{t.encryptedNote}</strong></p>
      {/if}

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
