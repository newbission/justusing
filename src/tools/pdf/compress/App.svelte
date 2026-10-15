<!--
  PDF 압축 도구 화면 (격리 frame 안에서 실행).
  줄이는 정도를 고르면 PDF 안의 사진을 다시 저장해 용량을 줄인다. 파일은 어디로도 전송되지 않는다.
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
  import { compressPdf, type CompressLevel } from '../../../lib/pdf/compress';
  import PageSelectGrid from '../../../lib/pdf/PageSelectGrid.svelte';
  import SinglePdfTool, { type LoadedPdf } from '../../../lib/pdf/SinglePdfTool.svelte';

  const common = pick(FRAME_MESSAGES);
  const t = pick(MESSAGES);

  const LEVELS: CompressLevel[] = ['light', 'balanced', 'strong'];
  let level: CompressLevel = $state('balanced');

  let pdf: LoadedPdf | undefined = $state.raw();

  type Run =
    | { kind: 'idle' }
    /** total이 없으면 아직 파일에서 사진을 찾는 중 */
    | { kind: 'working'; done: number; total?: number }
    | { kind: 'done'; name: string; bytes: Uint8Array; level: CompressLevel }
    /** 원본보다 작아지지 않았다. 받을 파일이 없다 */
    | { kind: 'no-gain'; level: CompressLevel }
    | { kind: 'failed'; message: string };
  let run = $state<Run>({ kind: 'idle' });

  /** 줄이는 정도를 바꾸면 이전 결과는 더 이상 맞지 않는다 */
  const result = $derived(run.kind === 'done' && run.level === level ? run : undefined);
  const noGain = $derived(run.kind === 'no-gain' && run.level === level);

  /** 진행 중인 압축. 연 PDF를 닫으면 그만둔다 (안 그러면 쓰지 않을 결과로 워커가 계속 바쁘다) */
  let controller: AbortController | undefined;

  /** 연 PDF를 닫으면 진행 중인 압축을 그만두고 결과도 버린다 */
  function onclose() {
    controller?.abort();
    controller = undefined;
    pdf = undefined;
  }

  function onload(loaded: LoadedPdf) {
    pdf = loaded;
    run = { kind: 'idle' };
  }

  async function compress() {
    if (!pdf || run.kind === 'working') return;
    const entitlement = await canUse('pdf/compress');
    if (!entitlement.allowed) {
      run = { kind: 'failed', message: entitlement.reason ?? common.action.unavailable };
      return;
    }
    const source = pdf;
    const chosen = level;
    run = { kind: 'working', done: 0 };
    controller = new AbortController();
    try {
      const bytes = await compressPdf(
        source,
        chosen,
        (done, total) => {
          if (pdf === source) run = { kind: 'working', done, total };
        },
        controller.signal,
      );
      if (pdf !== source) return;
      run =
        bytes.length < source.bytes.length
          ? {
              kind: 'done',
              name: `${baseName(source.name)}_${t.suffix}.pdf`,
              bytes,
              level: chosen,
            }
          : { kind: 'no-gain', level: chosen };
    } catch {
      if (pdf !== source) return;
      run = { kind: 'failed', message: t.failed };
    }
  }

  function percentSaved(before: number, after: number) {
    return Math.max(1, Math.round((1 - after / before) * 100));
  }
</script>

<SinglePdfTool {onload} {onclose}>
  {#snippet children({ doc, bytes })}
    <ActionBar label={t.bar}>
      {#snippet text()}
        {#if run.kind === 'working'}
          {run.total === undefined ? t.reading : t.working(run.done, run.total)}
        {:else if result}
          {t.done(
            result.name,
            formatSize(bytes.length),
            formatSize(result.bytes.length),
            percentSaved(bytes.length, result.bytes.length),
          )}
        {:else if noGain}
          {t.noGain}
        {:else if run.kind === 'failed'}
          <strong>{run.message}</strong>
        {:else}
          {t.ready(formatSize(bytes.length))}
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
          disabled={run.kind === 'working' || noGain}
          onclick={compress}>{run.kind === 'working' ? t.workingShort : t.run}</button
        >
      {/if}
    </ActionBar>

    <div class="tool-body">
      <div class="choices">
        <div class="choice" role="radiogroup" aria-label={t.levelGroup}>
          {#each LEVELS as option (option)}
            <label class:checked={level === option}>
              <input
                type="radio"
                name="level"
                value={option}
                bind:group={level}
                disabled={run.kind === 'working'}
              />
              <span class="long">{t.levels[option].label}</span>
              <span class="short">{t.levels[option].short}</span>
            </label>
          {/each}
        </div>
      </div>
      <p class="help">{t.levelHelp[level]} {t.note}</p>
      <PageSelectGrid {doc} size={88} />
    </div>
  {/snippet}
</SinglePdfTool>
