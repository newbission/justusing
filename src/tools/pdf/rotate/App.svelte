<!--
  PDF 회전 도구 화면 (격리 frame 안에서 실행).
  쪽마다 또는 전체를 90°씩 돌려 새 PDF로 받는다. 파일은 어디로도 전송되지 않는다.
-->
<script lang="ts">
  import { pick } from '../../../frame/locale';
  import { FRAME_MESSAGES } from '../../../frame/messages';
  import { MESSAGES } from './messages';

  const common = pick(FRAME_MESSAGES);
  const t = pick(MESSAGES);
  import ActionBar from '../../../frame/ActionBar.svelte';
  import { downloadFile } from '../../../frame/download';
  import { canUse } from '../../../lib/entitlement';
  import { assemblePdf } from '../../../lib/pdf/assemble';
  import SinglePdfTool, { type LoadedPdf } from '../../../lib/pdf/SinglePdfTool.svelte';
  import RotateGrid, { normalize } from './RotateGrid.svelte';

  let pdf: LoadedPdf | undefined = $state.raw();

  /** 쪽마다 누적 회전 각도 (RotateGrid 참고) */
  let rotations: number[] = $state([]);
  /** 실제로 돌린 쪽 수 (0·360처럼 제자리면 빼고) */
  const turnedCount = $derived(rotations.filter((angle) => normalize(angle) !== 0).length);

  function rotateAll(delta: -90 | 90) {
    rotations = rotations.map((angle) => angle + delta);
  }

  type Run =
    | { kind: 'idle' }
    | { kind: 'working' }
    | { kind: 'done'; name: string; bytes: Uint8Array; signature: string }
    | { kind: 'failed'; message: string };
  let run = $state<Run>({ kind: 'idle' });

  /** 쪽마다 실제 각도. 돌린 뒤 바뀌면 결과는 더 이상 맞지 않는다. */
  const signature = $derived(rotations.map(normalize).join(','));
  const result = $derived(run.kind === 'done' && run.signature === signature ? run : undefined);

  async function rotate() {
    if (!pdf || turnedCount === 0 || run.kind === 'working') return;
    const entitlement = await canUse('pdf/rotate');
    if (!entitlement.allowed) {
      run = { kind: 'failed', message: entitlement.reason ?? common.action.unavailable };
      return;
    }

    const startedWith = signature;
    /** 처리하는 동안 다른 파일을 열면 이 결과는 버린다 */
    const source = pdf;
    run = { kind: 'working' };
    try {
      const output = await assemblePdf({
        sources: [{ bytes: source.bytes, password: source.password }],
        pages: rotations.map((angle, index) => ({ source: 0, index, rotate: normalize(angle) })),
      });
      if (pdf !== source) return;
      const base = source.name.replace(/\.pdf$/i, '');
      run = {
        kind: 'done',
        name: `${base}_${t.suffix}.pdf`,
        bytes: output,
        signature: startedWith,
      };
    } catch {
      if (pdf !== source) return;
      run = { kind: 'failed', message: t.failed };
    }
  }

  function formatSize(size: number) {
    return size < 1024 * 1024
      ? `${Math.max(1, Math.round(size / 1024))}KB`
      : `${(size / 1024 / 1024).toFixed(1)}MB`;
  }

  /** 모두 원래 방향으로. 각 쪽이 가까운 쪽으로 돌아가게 한다 (360°인 쪽이 한 바퀴 도는 모션 방지) */
  function resetAll() {
    rotations = rotations.map((angle) => {
      const offset = normalize(angle);
      return offset <= 180 ? angle - offset : angle + 360 - offset;
    });
  }

  function onload(loaded: LoadedPdf) {
    pdf = loaded;
    run = { kind: 'idle' };
    rotations = Array.from({ length: loaded.doc.numPages }, () => 0);
  }
</script>

<SinglePdfTool {onload} saves>
  {#snippet children({ doc })}
    <ActionBar label={t.bar}>
      {#snippet text()}
        {#if run.kind === 'working'}
          {t.working}
        {:else if result}
          {common.action.done(result.name, formatSize(result.bytes.length))}
        {:else if run.kind === 'failed'}
          <strong>{run.message}</strong>
        {:else if turnedCount === 0}
          {t.nothing}
        {:else}
          {t.willMake(turnedCount)}
        {/if}
      {/snippet}
      {#if result}
        <button
          type="button"
          class="primary"
          onclick={() => downloadFile(result.bytes, result.name)}>{common.action.download}</button
        >
      {:else}
        <button
          type="button"
          class="primary"
          disabled={turnedCount === 0 || run.kind === 'working'}
          onclick={rotate}>{run.kind === 'working' ? t.working : t.run}</button
        >
      {/if}
    </ActionBar>

    <div class="body">
      <div class="all" role="group" aria-label={t.allGroup}>
        <span class="help" aria-live="polite">
          {turnedCount > 0 ? t.turned(turnedCount) : t.hint}
        </span>
        <button type="button" class="text" onclick={() => rotateAll(-90)}>{t.allLeft}</button>
        <button type="button" class="text" onclick={() => rotateAll(90)}>{t.allRight}</button>
        <button type="button" class="text" disabled={turnedCount === 0} onclick={resetAll}
          >{common.action.reset}</button
        >
      </div>
      <RotateGrid {doc} bind:rotations />
    </div>
  {/snippet}
</SinglePdfTool>

<style>
  button {
    flex: none;
    height: 32px;
    min-width: 32px;
    padding: 0 10px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius);
    background: transparent;
    white-space: nowrap;
    cursor: pointer;
    transition:
      background-color 0.12s,
      border-color 0.12s;
  }
  button:hover:not(:disabled) {
    border-color: var(--color-muted);
    background: var(--color-hover);
  }
  button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  button.text {
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
  button.primary:hover:not(:disabled) {
    border-color: var(--color-accent);
    background: var(--color-accent);
  }

  .body {
    flex: 1;
    padding: 16px;
    overflow: auto;
  }

  .all {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
  }
  .all .help {
    flex: 1 1 200px;
    color: var(--color-muted);
    font-size: 13px;
  }

  /* 좁은 화면: 안내는 한 줄 전체로, 전체 돌리기 버튼 셋은 그 아래 한 줄에 */
  @media (max-width: 520px) {
    .all .help {
      flex-basis: 100%;
    }
  }
</style>
