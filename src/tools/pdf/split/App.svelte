<!--
  PDF 나누기 도구 화면 (격리 frame 안에서 실행).
  PDF 하나를 범위별·한 장씩·고른 페이지만으로 나눈다. 파일은 어디로도 전송되지 않는다.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import FileDrop from '../../../frame/FileDrop.svelte';
  import { onFrameFiles } from '../../../frame/drop';
  import { requestShowTool } from '../../../frame/parent';
  import { isPasswordError, openPdf, type OpenedPdf } from '../../../lib/pdf/pdfjs';
  import PageSelectGrid from '../../../lib/pdf/PageSelectGrid.svelte';
  import { parseRanges } from '../../../lib/pdf/ranges';

  type Phase = 'idle' | 'loading' | 'password' | 'ready' | 'error';

  let phase: Phase = $state('idle');
  let fileName = $state('');
  let bytes: Uint8Array | undefined;
  /** 암호 PDF를 연 암호. 나눌 때 같은 암호로 풀어서 쓴다 (결과에는 암호가 없다). */
  let password: string | undefined;
  let passwordInput = $state('');
  let wrongPassword = $state(false);
  let opened: OpenedPdf | undefined = $state.raw();

  const pageCount = $derived(opened?.doc.numPages ?? 0);

  type Mode = 'range' | 'each' | 'select';
  const MODES: { id: Mode; label: string }[] = [
    { id: 'range', label: '범위로 나누기' },
    { id: 'each', label: '한 장씩 나누기' },
    { id: 'select', label: '고른 페이지만' },
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

  function selectAll(on: boolean) {
    selected = Array.from({ length: pageCount }, () => on);
  }

  /** 쪽마다 어느 결과 파일로 가는지 ('파일 1', 겹치면 '파일 1·2') */
  function noteFor(index: number) {
    const files = (outputs ?? []).flatMap((pages, i) => (pages.includes(index + 1) ? [i + 1] : []));
    return files.length > 0 ? `파일 ${files.join('·')}` : undefined;
  }

  async function open(file: File) {
    await close();
    fileName = file.name;
    bytes = new Uint8Array(await file.arrayBuffer());
    await load();
  }

  async function load(withPassword?: string) {
    if (!bytes) return;
    phase = 'loading';
    try {
      // pdf.js는 받은 버퍼를 워커로 넘겨 비워 버리므로 복사본을 준다 (원본은 나눌 때 쓴다)
      opened = await openPdf(bytes.slice(), withPassword);
      password = withPassword;
      selectAll(false);
      phase = 'ready';
      requestShowTool();
    } catch (error) {
      if (isPasswordError(error)) {
        wrongPassword = withPassword !== undefined;
        passwordInput = '';
        phase = 'password';
      } else {
        phase = 'error';
      }
    }
  }

  async function close() {
    await opened?.close();
    opened = undefined;
    bytes = undefined;
    password = undefined;
    wrongPassword = false;
    rangeText = '';
    phase = 'idle';
  }

  // 화면 어디에 놓든 받는다. 나누는 중에 새 파일을 놓으면 그 파일로 바뀐다.
  onMount(() =>
    onFrameFiles(([file]) => {
      if (file) open(file);
    }),
  );
</script>

<div class="split">
  {#if phase === 'ready' && opened}
    <div class="filebar">
      <span class="name" title={fileName}>{fileName}</span>
      <span class="meta">{pageCount}쪽</span>
      <button type="button" class="text" onclick={close}>다른 파일</button>
    </div>

    <div class="body">
      <div class="modes" role="radiogroup" aria-label="나누는 방법">
        {#each MODES as option (option.id)}
          <label class:checked={mode === option.id}>
            <input type="radio" name="mode" value={option.id} bind:group={mode} />
            {option.label}
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
        <PageSelectGrid doc={opened.doc} bind:selected size={88} />
      {:else}
        <PageSelectGrid doc={opened.doc} note={noteFor} size={88} />
      {/if}
    </div>
  {:else if phase === 'loading'}
    <p class="status" role="status">PDF를 여는 중…</p>
  {:else if phase === 'password'}
    <!-- 격리 frame은 form 제출이 막혀 있어(sandbox에 allow-forms 없음) form 대신 직접 처리한다 -->
    <div class="password" role="group" aria-label="암호가 걸린 PDF">
      <p>암호가 걸린 PDF입니다. 암호를 입력하세요.</p>
      <p class="hint">암호도 이 기기 안에서만 쓰이고 어디에도 전송되지 않습니다.</p>
      <label>
        PDF 암호
        <input
          type="password"
          bind:value={passwordInput}
          autocomplete="off"
          onkeydown={(event) => {
            if (event.key === 'Enter' && passwordInput) load(passwordInput);
          }}
        />
      </label>
      {#if wrongPassword}
        <p class="error" role="alert">암호가 맞지 않습니다.</p>
      {/if}
      <div class="actions">
        <button
          type="button"
          class="primary"
          disabled={!passwordInput}
          onclick={() => load(passwordInput)}>열기</button
        >
        <button type="button" class="text" onclick={close}>취소</button>
      </div>
    </div>
  {:else}
    {#if phase === 'error'}
      <p class="error banner" role="alert">
        PDF를 열 수 없습니다. 파일이 손상되었거나 PDF 파일이 아닐 수 있습니다.
      </p>
    {/if}
    <div class="drop">
      <FileDrop
        accept="application/pdf,.pdf"
        label="PDF 파일 선택"
        hint="파일은 이 기기를 떠나지 않습니다"
        onfiles={([file]) => file && open(file)}
      />
    </div>
  {/if}
</div>

<style>
  .split {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--color-surface);
  }

  .filebar {
    display: flex;
    flex: none;
    align-items: center;
    gap: 12px;
    height: 48px;
    padding: 0 16px;
    border-bottom: 1px solid var(--color-line);
    font-size: 14px;
  }
  .filebar .name {
    overflow: hidden;
    font-weight: 600;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .filebar .meta {
    flex: 1;
    color: var(--color-muted);
    white-space: nowrap;
  }

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

  .status {
    margin: auto;
    color: var(--color-muted);
  }
  .drop {
    flex: 1;
    padding: 16px;
  }
  .error {
    color: var(--color-text);
    font-weight: 600;
  }
  .banner {
    margin: 16px 16px 0;
  }

  .password {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: min(360px, 100% - 32px);
    margin: auto;
  }
  .password p {
    margin: 0;
  }
  .password .hint {
    color: var(--color-muted);
    font-size: 13px;
  }
  .password label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 14px;
  }
  .password input {
    height: 40px;
    padding: 0 12px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius);
    background: var(--color-bg);
  }
  .actions {
    display: flex;
    gap: 8px;
  }
</style>
