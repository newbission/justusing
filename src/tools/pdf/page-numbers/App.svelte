<!--
  PDF 쪽 번호 넣기 도구 화면 (격리 frame 안에서 실행).
  모든 쪽에 정한 위치·모양으로 번호를 넣는다. 파일은 어디로도 전송되지 않는다.
-->
<script lang="ts">
  import '../../../frame/controls.css';
  import { pick } from '../../../frame/locale';
  import { FRAME_MESSAGES } from '../../../frame/messages';
  import { MESSAGES } from './messages';
  import ActionBar from '../../../frame/ActionBar.svelte';
  import { downloadFile } from '../../../frame/download';
  import { baseName, formatSize } from '../../../frame/format';
  import { canUse } from '../../../lib/entitlement';
  import { modifyPdf, type NumberFormat, type NumberPosition } from '../../../lib/pdf/modify';
  import PageSelectGrid from '../../../lib/pdf/PageSelectGrid.svelte';
  import SinglePdfTool, { type LoadedPdf } from '../../../lib/pdf/SinglePdfTool.svelte';

  const common = pick(FRAME_MESSAGES);
  const t = pick(MESSAGES);

  let pdf: LoadedPdf | undefined = $state.raw();
  const pageCount = $derived(pdf?.doc.numPages ?? 0);

  const POSITIONS: NumberPosition[] = ['bottom-center', 'bottom-right', 'top-right'];
  let position: NumberPosition = $state('bottom-center');

  const FORMATS: NumberFormat[] = ['plain', 'of-total', 'dashes'];
  let format: NumberFormat = $state('plain');

  /** 시작 번호 입력 (빈 칸·잘못된 값도 그대로 두고 막대에서 알린다) */
  let startText = $state('1');
  const start = $derived(/^\d{1,6}$/.test(startText.trim()) ? Number(startText) : 0);

  /** 쪽 번호 모양 (워커의 numberLabel과 같다) */
  function label(kind: NumberFormat, n: number, total: number) {
    if (kind === 'of-total') return `${n} / ${total}`;
    if (kind === 'dashes') return `- ${n} -`;
    return String(n);
  }
  const last = $derived(start + pageCount - 1);

  type Run =
    | { kind: 'idle' }
    | { kind: 'working' }
    | { kind: 'done'; name: string; bytes: Uint8Array; signature: string }
    | { kind: 'failed'; message: string };
  let run = $state<Run>({ kind: 'idle' });
  const signature = $derived(`${position}:${format}:${start}`);
  const result = $derived(run.kind === 'done' && run.signature === signature ? run : undefined);

  function onload(loaded: LoadedPdf) {
    pdf = loaded;
    run = { kind: 'idle' };
  }

  async function addNumbers() {
    if (!pdf || start < 1 || run.kind === 'working') return;
    const entitlement = await canUse('pdf/page-numbers');
    if (!entitlement.allowed) {
      run = { kind: 'failed', message: entitlement.reason ?? common.action.unavailable };
      return;
    }
    const source = pdf;
    const startedWith = signature;
    const job = { kind: 'page-numbers', position, format, start } as const;
    run = { kind: 'working' };
    try {
      const bytes = await modifyPdf(source, job);
      if (pdf !== source) return;
      run = {
        kind: 'done',
        name: `${baseName(source.name)}_${t.suffix}.pdf`,
        bytes,
        signature: startedWith,
      };
    } catch {
      if (pdf !== source) return;
      run = { kind: 'failed', message: t.failed };
    }
  }
</script>

<SinglePdfTool {onload}>
  {#snippet children({ doc })}
    <ActionBar label={t.bar}>
      {#snippet text()}
        {#if run.kind === 'working'}
          {t.working}
        {:else if result}
          {common.action.done(result.name, formatSize(result.bytes.length))}
        {:else if run.kind === 'failed'}
          <strong>{run.message}</strong>
        {:else if start < 1}
          {t.badStart}
        {:else}
          {t.ready(start, last)}
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
          disabled={start < 1 || run.kind === 'working'}
          onclick={addNumbers}>{run.kind === 'working' ? t.working : t.run}</button
        >
      {/if}
    </ActionBar>

    <div class="tool-body">
      <div class="choices">
        <div class="choice" role="radiogroup" aria-label={t.positionGroup}>
          {#each POSITIONS as option (option)}
            <label class:checked={position === option}>
              <input type="radio" name="position" value={option} bind:group={position} />
              {t.positions[option]}
            </label>
          {/each}
        </div>
        <div class="choice" role="radiogroup" aria-label={t.formatGroup}>
          {#each FORMATS as option (option)}
            <label class:checked={format === option}>
              <input type="radio" name="format" value={option} bind:group={format} />
              {label(option, 1, pageCount)}
            </label>
          {/each}
        </div>
      </div>
      <label class="field start">
        {t.start}
        <input
          type="text"
          inputmode="numeric"
          autocomplete="off"
          bind:value={startText}
          aria-invalid={start < 1}
        />
      </label>
      <p class="help">{t.preview}</p>
      <PageSelectGrid
        {doc}
        size={88}
        note={(index) => (start < 1 ? undefined : label(format, start + index, last))}
      />
    </div>
  {/snippet}
</SinglePdfTool>

<style>
  .start {
    max-width: 160px;
  }
</style>
