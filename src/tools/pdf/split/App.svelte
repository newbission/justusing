<!--
  PDF 나누기 도구 화면 (격리 frame 안에서 실행).
  PDF 하나를 범위별·한 장씩·고른 페이지만으로 나눈다. 파일은 어디로도 전송되지 않는다.
-->
<script lang="ts">
  import ActionBar from '../../../frame/ActionBar.svelte';
  import { downloadFile } from '../../../frame/download';
  import { canUse } from '../../../lib/entitlement';
  import { assemblePdfs } from '../../../lib/pdf/assemble';
  import { makeZip } from '../../../lib/zip';
  import PageSelectGrid from '../../../lib/pdf/PageSelectGrid.svelte';
  import { parseRanges, rangeLabel } from '../../../lib/pdf/ranges';
  import SinglePdfTool, { type LoadedPdf } from '../../../lib/pdf/SinglePdfTool.svelte';

  let pdf: LoadedPdf | undefined = $state.raw();
  const pageCount = $derived(pdf?.doc.numPages ?? 0);

  type Mode = 'range' | 'each' | 'select';
  /** short: 좁은 화면에서 쓰는 짧은 이름 (긴 이름은 두 줄로 깨진다) */
  const MODES: { id: Mode; label: string; short: string }[] = [
    { id: 'range', label: '범위로 나누기', short: '범위' },
    { id: 'each', label: '한 장씩 나누기', short: '한 장씩' },
    { id: 'select', label: '고른 페이지만', short: '고른 쪽' },
  ];
  let mode: Mode = $state('range');

  /** 범위 입력 (예: 1-3, 4-6, 7) */
  let rangeText = $state('');
  const rangeResult = $derived(parseRanges(rangeText, pageCount));

  /** '고른 페이지만'에서 쪽마다 선택 여부 (index 0 = 1쪽) */
  let selected: boolean[] = $state([]);
  const selectedPages = $derived(selected.flatMap((on, index) => (on ? [index + 1] : [])));

  /** 결과 파일마다 넣을 쪽 번호(1부터). 아직 나눌 수 없으면 undefined */
  const outputs: number[][] | undefined = $derived.by(() => {
    if (mode === 'each') return Array.from({ length: pageCount }, (_, i) => [i + 1]);
    if (mode === 'select') return selectedPages.length > 0 ? [selectedPages] : undefined;
    return rangeResult.ok ? rangeResult.ranges : undefined;
  });
  /** 나눌 수 없을 때 그 이유 */
  const problem = $derived.by(() => {
    if (mode === 'range' && !rangeResult.ok) return rangeResult.message;
    if (mode === 'select' && selectedPages.length === 0) return '뽑을 페이지를 눌러 고르세요.';
    return undefined;
  });

  type Run =
    | { kind: 'idle' }
    | { kind: 'working'; done: number; total: number }
    | { kind: 'done'; name: string; bytes: Uint8Array; type: string; signature: string }
    | { kind: 'failed'; message: string };
  let run = $state<Run>({ kind: 'idle' });

  /** 나눌 내용(방법·결과 파일별 쪽). 나눈 뒤 바뀌면 결과는 더 이상 맞지 않는다. */
  const signature = $derived(`${mode}:${JSON.stringify(outputs ?? [])}`);
  const result = $derived(run.kind === 'done' && run.signature === signature ? run : undefined);

  /** 결과 파일 이름. 한 장씩이면 정렬되도록 앞에 0을 채운다 (01, 02 … 10) */
  function outputName(name: string, pages: number[]) {
    const base = name.replace(/\.pdf$/i, '');
    if (mode === 'select') return `${base}_발췌.pdf`;
    if (mode === 'each')
      return `${base}_${String(pages[0]).padStart(String(pageCount).length, '0')}.pdf`;
    return `${base}_${rangeLabel(pages)}.pdf`;
  }

  async function split() {
    if (!outputs || !pdf || run.kind === 'working') return;
    const entitlement = await canUse('pdf/split');
    if (!entitlement.allowed) {
      run = { kind: 'failed', message: entitlement.reason ?? '지금은 사용할 수 없습니다.' };
      return;
    }

    const plan = outputs;
    const startedWith = signature;
    /** 처리하는 동안 다른 파일을 열면 이 결과는 버린다 */
    const source = pdf;
    run = { kind: 'working', done: 0, total: plan.length };
    try {
      const files = await assemblePdfs(
        {
          sources: [{ bytes: source.bytes, password: source.password }],
          outputs: plan.map((pages) => pages.map((page) => ({ source: 0, index: page - 1 }))),
        },
        (done, total) => {
          if (pdf === source) run = { kind: 'working', done, total };
        },
      );
      if (pdf !== source) return;
      const named = files.map((file, i) => ({
        name: outputName(source.name, plan[i]!),
        bytes: file,
      }));
      const base = source.name.replace(/\.pdf$/i, '');
      run =
        named.length === 1
          ? { kind: 'done', ...named[0]!, type: 'application/pdf', signature: startedWith }
          : {
              kind: 'done',
              name: `${base}_나눔.zip`,
              bytes: makeZip(named),
              type: 'application/zip',
              signature: startedWith,
            };
    } catch {
      if (pdf !== source) return;
      run = { kind: 'failed', message: '나누지 못했습니다. 파일이 손상되었을 수 있습니다.' };
    }
  }

  function formatSize(size: number) {
    return size < 1024 * 1024
      ? `${Math.max(1, Math.round(size / 1024))}KB`
      : `${(size / 1024 / 1024).toFixed(1)}MB`;
  }

  function selectAll(on: boolean) {
    selected = Array.from({ length: pageCount }, () => on);
  }

  /** 쪽마다 어느 결과 파일로 가는지 ('파일 1', 겹치면 '파일 1·2') */
  function noteFor(index: number) {
    const files = (outputs ?? []).flatMap((pages, i) => (pages.includes(index + 1) ? [i + 1] : []));
    return files.length > 0 ? `파일 ${files.join('·')}` : undefined;
  }

  function onload(loaded: LoadedPdf) {
    pdf = loaded;
    run = { kind: 'idle' };
    rangeText = '';
    selectAll(false);
  }
</script>

<SinglePdfTool {onload}>
  {#snippet children({ doc })}
    <ActionBar label="나누기">
      {#snippet text()}
        {#if run.kind === 'working'}
          나누는 중… {run.done}/{run.total}
        {:else if result}
          완료: {result.name} · {formatSize(result.bytes.length)}
        {:else if run.kind === 'failed'}
          <strong>{run.message}</strong>
        {:else if problem || !outputs}
          {problem ?? ''}
        {:else if outputs.length === 1}
          파일 1개({outputs[0]!.length}쪽)로 만듭니다.
        {:else}
          파일 {outputs.length}개로 나눕니다. ZIP 하나로 받습니다.
        {/if}
      {/snippet}
      {#if result}
        <button
          type="button"
          class="primary"
          onclick={() => downloadFile(result.bytes, result.name, result.type)}>다운로드</button
        >
      {:else}
        <button
          type="button"
          class="primary"
          disabled={!outputs || run.kind === 'working'}
          onclick={split}>{run.kind === 'working' ? '나누는 중…' : 'PDF 나누기'}</button
        >
      {/if}
    </ActionBar>

    <div class="body">
      <div class="modes" role="radiogroup" aria-label="나누는 방법">
        {#each MODES as option (option.id)}
          <label class:checked={mode === option.id}>
            <input type="radio" name="mode" value={option.id} bind:group={mode} />
            <span class="long">{option.label}</span>
            <span class="short">{option.short}</span>
          </label>
        {/each}
      </div>

      {#if mode === 'range'}
        <div class="range">
          <label for="range-input">나눌 범위</label>
          <input
            id="range-input"
            type="text"
            inputmode="numeric"
            autocomplete="off"
            placeholder="예: 1-3, 4-6, 7"
            bind:value={rangeText}
            aria-describedby="range-help"
            aria-invalid={rangeText.trim() !== '' && problem !== undefined}
          />
          <p id="range-help" class="help">
            쉼표로 구분한 범위마다 파일 하나가 됩니다. 1-3은 1~3쪽, 5-는 5쪽부터 끝까지입니다.
          </p>
          {#if rangeText.trim() && problem}
            <p class="error" role="alert">{problem}</p>
          {/if}
        </div>
      {:else if mode === 'each'}
        <p class="help mode-help">모든 쪽을 한 장씩, {pageCount}개 파일로 나눕니다.</p>
      {:else}
        <div class="select-bar">
          <p class="help" aria-live="polite">
            뽑을 페이지를 누르세요. 고른 페이지가 파일 하나로 나옵니다. ({selectedPages.length}쪽
            고름)
          </p>
          <button type="button" class="text" onclick={() => selectAll(true)}>전체 선택</button>
          <button type="button" class="text" onclick={() => selectAll(false)}>선택 해제</button>
        </div>
      {/if}

      {#if mode === 'select'}
        <PageSelectGrid {doc} bind:selected size={88} />
      {:else}
        <PageSelectGrid {doc} note={noteFor} size={88} />
      {/if}
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
  /* 나누는 방법: 라디오 버튼을 붙은 버튼 모양으로 (방향키로도 바뀐다) */
  .modes {
    display: inline-flex;
    margin-bottom: 16px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .modes label {
    padding: 8px 14px;
    font-size: 14px;
    cursor: pointer;
    transition: background-color 0.12s;
  }
  .modes label + label {
    border-left: 1px solid var(--color-line);
  }
  .modes label:hover {
    background: var(--color-hover);
  }
  .modes label.checked {
    background: var(--color-text);
    color: var(--color-bg);
    font-weight: 600;
  }
  .modes label:has(input:focus-visible) {
    outline: 2px solid var(--color-accent);
    outline-offset: -2px;
  }
  .modes input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .modes .short {
    display: none;
  }
  .modes label {
    white-space: nowrap;
  }
  /* 좁은 화면: 짧은 이름으로, 셋이 폭을 똑같이 나눈다 */
  @media (max-width: 520px) {
    .modes {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
    }
    .modes label {
      text-align: center;
    }
    .modes .long {
      display: none;
    }
    .modes .short {
      display: inline;
    }
  }
  .mode-help {
    margin-bottom: 20px;
  }
  .select-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-bottom: 20px;
  }
  .select-bar .help {
    flex: 1 1 240px;
  }

  .range {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-width: 480px;
    margin-bottom: 20px;
  }
  .range label {
    font-size: 14px;
    font-weight: 600;
  }
  .range input {
    height: 40px;
    padding: 0 12px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius);
    background: var(--color-bg);
    font-size: 15px;
  }
  .range input[aria-invalid='true'] {
    border-color: var(--color-text);
  }
  .help {
    margin: 0;
    color: var(--color-muted);
    font-size: 13px;
  }
  .range .error {
    margin: 0;
    font-size: 13px;
  }

  .error {
    color: var(--color-text);
    font-weight: 600;
  }
</style>
