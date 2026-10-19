<!--
  PDF 보기 도구 화면 (격리 frame 안에서 실행).
  파일을 메모리에서 바로 열어 페이지를 세로로 이어 보여준다. 파일은 어디로도 전송되지 않는다.
-->
<script lang="ts">
  import { pick } from '../../../frame/locale';
  import { FRAME_MESSAGES } from '../../../frame/messages';
  import { MESSAGES } from './messages';

  const common = pick(FRAME_MESSAGES);
  const t = pick(MESSAGES);
  import { onMount, untrack } from 'svelte';
  import FileDrop from '../../../frame/FileDrop.svelte';
  import { onFrameFiles } from '../../../frame/drop';
  import { requestShowTool } from '../../../frame/parent';
  import PdfPage from '../../../lib/pdf/PdfPage.svelte';
  import {
    isPasswordError,
    openPdf,
    type OpenedPdf,
    type PDFPageProxy,
  } from '../../../lib/pdf/pdfjs';

  type Phase = 'idle' | 'loading' | 'password' | 'ready' | 'error';

  interface ViewFile {
    id: number;
    name: string;
    bytes: Uint8Array;
    /** 한 번 연 암호. 다른 파일을 보다 돌아와도 다시 묻지 않는다. */
    password?: string;
  }

  /** 확대·축소 단계 (1 = 100%) */
  const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
  /** 폭 맞춤일 때 페이지 양옆 여백 합계(px) */
  const SIDE_PADDING = 32;

  let phase: Phase = $state('idle');
  /** 올린 파일 목록과 지금 보고 있는 파일 */
  let files: ViewFile[] = $state([]);
  let current: ViewFile | undefined = $state();
  let nextId = 0;
  const fileName = $derived(current?.name ?? '');
  let errorMessage = $state('');
  let wrongPassword = $state(false);
  let password = $state('');

  let opened: OpenedPdf | undefined;
  let pages: PDFPageProxy[] = $state([]);

  let fitWidth = $state(true);
  let manualScale = $state(1);
  let viewerWidth = $state(0);
  let currentPage = $state(1);
  /** 전체 화면을 지원하는 브라우저인지 (아이폰 사파리 등은 지원하지 않아 버튼을 숨긴다) */
  const canFullscreen = document.fullscreenEnabled;
  let fullscreen = $state(false);
  let scroller: HTMLDivElement | undefined = $state();

  /** 폭 맞춤 배율: 첫 페이지가 화면 폭에 꼭 맞는 배율 */
  const fitScale = $derived.by(() => {
    const first = pages[0];
    if (!first || viewerWidth === 0) return 1;
    const pageWidth = first.getViewport({ scale: 1 }).width;
    return Math.max(0.25, (viewerWidth - SIDE_PADDING) / pageWidth);
  });
  const scale = $derived(fitWidth ? fitScale : manualScale);

  /** 파일들을 목록 끝에 더하고, 더한 것 중 첫 파일을 연다 */
  async function add(list: File[]) {
    if (list.length === 0) return;
    const added = await Promise.all(
      list.map(async (file) => ({
        id: nextId++,
        name: file.name,
        bytes: new Uint8Array(await file.arrayBuffer()),
      })),
    );
    files.push(...added);
    await show(files[files.length - added.length]!);
  }

  /** 목록의 파일 하나를 연다 (보던 파일은 닫는다) */
  async function show(file: ViewFile) {
    // 고른 파일을 먼저 정한다. 닫기를 기다린 뒤에 정하면 먼저 고른 파일의 늦은 닫기가 나중 선택을 덮어쓴다
    current = file;
    await closeDoc();
    if (current !== file) return;
    await load(file.password);
  }

  async function load(withPassword?: string) {
    if (!current) return;
    phase = 'loading';
    const target = current;
    try {
      // pdf.js는 받은 버퍼를 워커로 넘겨 비워 버리므로 다시 열 수 있게 복사본을 준다
      const result = await openPdf(target.bytes.slice(), withPassword);
      // 여는 사이 다른 파일을 골랐으면 늦게 열린 이 파일은 버린다
      if (current !== target) {
        await result.close();
        return;
      }
      opened = result;
      target.password = withPassword;
      const { doc } = opened;
      const loadedPages = await Promise.all(
        Array.from({ length: doc.numPages }, (_, i) => doc.getPage(i + 1)),
      );
      // 쪽을 읽는 사이 다른 파일을 골랐으면 그 파일 화면을 덮어쓰지 않는다 (이 문서는 그쪽 닫기가 닫는다)
      if (current !== target) return;
      pages = loadedPages;
      currentPage = 1;
      fitWidth = true;
      phase = 'ready';
      // 열리면 도구 칸이 화면을 꽉 채우도록 바깥 페이지를 스크롤한다
      requestShowTool();
    } catch (error) {
      if (current !== target) return;
      if (isPasswordError(error)) {
        wrongPassword = withPassword !== undefined;
        password = '';
        phase = 'password';
      } else {
        errorMessage = common.pdf.cannotOpen;
        phase = 'error';
      }
    }
  }

  /** 보고 있는 문서를 닫는다 (목록은 그대로) */
  async function closeDoc() {
    // 기다리기 전에 비운다. 기다린 뒤에 비우면, 늦게 끝난 닫기가 그사이 연 새 문서를 잊어 닫지 못한다
    const closing = opened;
    opened = undefined;
    pages = [];
    wrongPassword = false;
    await closing?.close();
  }

  /** 목록에서 뺀다. 보던 파일이면 다음(없으면 앞) 파일을 열고, 다 빼면 첫 화면으로 */
  async function remove(file: ViewFile) {
    const index = files.indexOf(file);
    files.splice(index, 1);
    if (file !== current) return;
    const next = files[index] ?? files[index - 1];
    if (next) await show(next);
    else await reset();
  }

  /** 목록을 비우고 첫 화면으로 돌아간다 */
  async function reset() {
    // 닫기를 기다리는 사이 새로 고른 파일을 지우지 않게, 상태를 먼저 비운다
    const closing = closeDoc();
    files = [];
    current = undefined;
    phase = 'idle';
    await closing;
  }

  function zoom(direction: 1 | -1) {
    const now = scale;
    const next =
      direction > 0
        ? (ZOOM_STEPS.find((step) => step > now + 0.001) ?? ZOOM_STEPS.at(-1)!)
        : (ZOOM_STEPS.findLast((step) => step < now - 0.001) ?? ZOOM_STEPS[0]!);
    manualScale = next;
    fitWidth = false;
  }

  function goTo(pageNumber: number) {
    const target = scroller?.querySelector<HTMLElement>(`[data-page="${pageNumber}"]`);
    // scrollIntoView는 바깥 페이지까지 스크롤하므로 페이지 목록 안에서만 움직인다
    if (scroller && target) scroller.scrollTop = target.offsetTop - 16;
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  }

  /** 스크롤 위치에서 지금 보고 있는 페이지(화면 위쪽 1/3에 걸친 페이지)를 찾는다 */
  function updateCurrentPage() {
    if (!scroller) return;
    const line = scroller.getBoundingClientRect().top + scroller.clientHeight / 3;
    for (const el of scroller.querySelectorAll<HTMLElement>('[data-page]')) {
      if (el.getBoundingClientRect().bottom >= line) {
        currentPage = Number(el.dataset.page);
        return;
      }
    }
  }

  // 화면 어디에 놓든 받는다. 보는 중에 놓으면 목록에 더하고 그 파일로 바뀐다.
  onMount(() => onFrameFiles(add));

  // Esc로 빠져나와도 버튼 상태가 맞도록 브라우저 신호로 상태를 맞춘다
  onMount(() => {
    const sync = () => (fullscreen = document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  });

  // 배율이 바뀌면 보고 있던 페이지를 유지한다
  $effect(() => {
    void scale;
    const keep = untrack(() => currentPage);
    requestAnimationFrame(() => goTo(keep));
  });
</script>

<div class="viewer">
  {#if files.length > 1}
    <nav class="files" aria-label={t.fileList}>
      <p class="files-title">{t.fileCount(files.length)}</p>
      <ol>
        {#each files as file (file.id)}
          <li>
            <button
              type="button"
              class="file"
              aria-current={file === current ? 'true' : undefined}
              title={file.name}
              onclick={() => file !== current && show(file)}>{file.name}</button
            >
            <button
              type="button"
              class="remove"
              onclick={() => remove(file)}
              aria-label={t.removeFile(file.name)}>×</button
            >
          </li>
        {/each}
      </ol>
    </nav>
  {/if}
  <div class="main">
    {#if files.length > 1}
      <!-- 좁은 화면에서는 왼쪽 목록 대신 고르기 상자로 파일을 바꾼다 -->
      <div class="file-select">
        <label class="visually-hidden" for="file-select">{t.fileSelect}</label>
        <select
          id="file-select"
          value={current?.id}
          onchange={(event) => {
            const file = files.find((f) => f.id === Number(event.currentTarget.value));
            if (file) show(file);
          }}
        >
          {#each files as file, i (file.id)}
            <option value={file.id}>{i + 1}. {file.name}</option>
          {/each}
        </select>
        <button
          type="button"
          class="remove"
          onclick={() => current && remove(current)}
          aria-label={t.removeCurrent}>×</button
        >
      </div>
    {/if}
    {#if phase === 'ready'}
      <div class="toolbar" role="toolbar" aria-label={t.toolbar}>
        <span class="file-name" title={fileName}>{fileName}</span>

        <div class="group">
          <button
            type="button"
            class="page-nav"
            onclick={() => goTo(currentPage - 1)}
            disabled={currentPage <= 1}
            aria-label={t.previous}>‹</button
          >
          <span class="page-count" aria-live="polite">{currentPage} / {pages.length}</span>
          <button
            type="button"
            class="page-nav"
            onclick={() => goTo(currentPage + 1)}
            disabled={currentPage >= pages.length}
            aria-label={t.next}>›</button
          >
        </div>

        <div class="group">
          <button type="button" onclick={() => zoom(-1)} aria-label={t.zoomOut}>−</button>
          <span class="zoom">{Math.round(scale * 100)}%</span>
          <button type="button" onclick={() => zoom(1)} aria-label={t.zoomIn}>+</button>
          <button
            type="button"
            class="text"
            onclick={() => (fitWidth = true)}
            aria-pressed={fitWidth}>{t.fitWidth}</button
          >
        </div>

        {#if canFullscreen}
          <button
            type="button"
            onclick={toggleFullscreen}
            aria-label={fullscreen ? t.exitFullscreen : t.fullscreen}
            aria-pressed={fullscreen}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              {#if fullscreen}
                <path d="M6 1v5H1M10 1v5h5M6 15v-5H1M10 15v-5h5" />
              {:else}
                <path d="M1 6V1h5M15 6V1h-5M1 10v5h5M15 10v5h-5" />
              {/if}
            </svg>
          </button>
        {/if}
        <!-- 보던 파일은 두고 목록에 더한다 (여러 개 고를 수 있음) -->
        <label class="add">
          {t.addFiles}
          <input
            type="file"
            class="visually-hidden"
            accept="application/pdf,.pdf"
            multiple
            onchange={(event) => {
              add([...(event.currentTarget.files ?? [])]);
              event.currentTarget.value = '';
            }}
          />
        </label>
      </div>

      <!-- 키보드 사용자가 방향키로 스크롤할 수 있도록 스크롤 영역에 포커스를 허용한다 -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        class="pages"
        bind:this={scroller}
        bind:clientWidth={viewerWidth}
        onscroll={updateCurrentPage}
        tabindex="0"
        role="document"
        aria-label={t.pageList(fileName)}
      >
        {#each pages as page (page.pageNumber)}
          <PdfPage {page} {scale} />
        {/each}
      </div>
    {:else if phase === 'loading'}
      <p class="status" role="status">{common.pdf.opening}</p>
    {:else if phase === 'password'}
      <!-- 격리 frame은 form 제출이 막혀 있어(sandbox에 allow-forms 없음) form 대신 직접 처리한다 -->
      <div class="password" role="group" aria-label={common.pdf.passwordGroup}>
        <p class="file" title={fileName}>{fileName}</p>
        <p>{common.pdf.passwordPrompt}</p>
        <p class="hint">{common.pdf.passwordNote}</p>
        <label>
          {common.pdf.passwordLabel}
          <input
            type="password"
            bind:value={password}
            autocomplete="off"
            onkeydown={(event) => {
              if (event.key === 'Enter' && password) load(password);
            }}
          />
        </label>
        {#if wrongPassword}
          <p class="error" role="alert">{common.pdf.wrongPassword}</p>
        {/if}
        <div class="actions">
          <button type="button" class="primary" disabled={!password} onclick={() => load(password)}
            >{common.pdf.open}</button
          >
          <button type="button" class="text" onclick={reset}>{common.pdf.cancel}</button>
        </div>
      </div>
    {:else}
      {#if phase === 'error'}
        <p class="error banner" role="alert">{errorMessage}</p>
      {/if}
      <div class="drop">
        <FileDrop
          accept="application/pdf,.pdf"
          label={common.pdf.chooseMany}
          hint={common.pdf.stays}
          multiple
          onfiles={add}
        />
      </div>
    {/if}
  </div>
</div>

<style>
  .viewer {
    display: flex;
    height: 100%;
    background: var(--color-surface);
  }
  .main {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }

  .file-select {
    display: none;
  }
  /* 여러 파일을 올리면 왼쪽에 목록을 둔다 */
  .files {
    display: flex;
    flex: none;
    flex-direction: column;
    width: 200px;
    border-right: 1px solid var(--color-line);
  }
  .files-title {
    display: flex;
    flex: none;
    align-items: center;
    height: 48px;
    margin: 0;
    padding: 0 12px;
    border-bottom: 1px solid var(--color-line);
    font-size: 14px;
  }
  .files ol {
    flex: 1;
    margin: 0;
    padding: 6px;
    overflow: auto;
    list-style: none;
  }
  .files li {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .files .file {
    display: block;
    flex: 1;
    min-width: 0;
    height: 36px;
    overflow: hidden;
    border-color: transparent;
    font-size: 14px;
    text-align: left;
    text-overflow: ellipsis;
  }
  .files .file:hover {
    background: var(--color-hover);
  }
  .files .file[aria-current='true'] {
    background: var(--color-accent-soft);
    color: var(--color-accent);
    font-weight: 600;
  }

  /* 도구 막대: 높이 고정 (상태가 바뀌어도 아래 내용이 밀리지 않게) */
  .toolbar {
    display: flex;
    flex: none;
    align-items: center;
    gap: 12px;
    height: 48px;
    padding: 0 12px;
    border-bottom: 1px solid var(--color-line);
  }
  .file-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    font-size: 14px;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .group {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .page-count,
  .zoom {
    min-width: 4.5em;
    font-size: 14px;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  button {
    flex: none;
    min-width: 32px;
    white-space: nowrap;
    height: 32px;
    padding: 0 8px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius);
    background: transparent;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  button.text,
  .add {
    font-size: 14px;
  }
  /* 파일 추가: 버튼처럼 보이는 파일 선택 라벨 */
  .add {
    display: inline-flex;
    flex: none;
    align-items: center;
    height: 32px;
    padding: 0 8px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius);
    white-space: nowrap;
    cursor: pointer;
  }
  .add:has(input:focus-visible) {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
  button svg {
    display: block;
    margin: auto;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
  }
  button[aria-pressed='true'] {
    border-color: var(--color-text);
  }
  button.primary {
    padding: 0 20px;
    border-color: var(--color-text);
    background: var(--color-text);
    color: var(--color-bg);
    font-weight: 600;
  }

  .pages {
    position: relative;
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 16px;
    overflow: auto;
    background: var(--color-bg);
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
  /* 어느 파일의 암호인지 (여러 파일을 넣었을 때 헷갈리지 않게) */
  .password .file {
    overflow: hidden;
    font-weight: 600;
    white-space: nowrap;
    text-overflow: ellipsis;
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

  /* 좁은 화면: 파일 이름을 숨겨 도구 막대가 한 줄(높이 고정)에 들어가게 한다 */
  @media (max-width: 520px) {
    .file-name {
      display: none;
    }
    .toolbar {
      justify-content: space-between;
      gap: 4px;
      padding: 0 8px;
    }
    .zoom {
      display: none;
    }
    .page-count {
      min-width: 3.2em;
    }
    .group {
      gap: 2px;
    }
    button {
      min-width: 30px;
      padding: 0 6px;
    }
    .add {
      padding: 0 6px;
    }
  }
  /* 아주 좁은 화면: 페이지 이동은 손가락 스크롤로 하고 버튼은 숨긴다 (쪽 번호는 그대로 보인다) */
  @media (max-width: 400px) {
    .page-nav {
      display: none;
    }
  }

  /* 좁은 화면: 왼쪽 목록을 숨기고 고르기 상자를 보인다 */
  @media (max-width: 719px) {
    .files {
      display: none;
    }
    .file-select {
      display: flex;
      gap: 6px;
      flex: none;
      padding: 8px;
      border-bottom: 1px solid var(--color-line);
    }
    .file-select select {
      flex: 1;
      min-width: 0;
      width: 100%;
      height: 36px;
      padding: 0 8px;
      border: 1px solid var(--color-line);
      border-radius: var(--radius);
      background: var(--color-bg);
      font-size: 14px;
    }
  }
  /* 목록에서 빼기 (×) */
  .remove {
    min-width: 28px;
    height: 28px;
    padding: 0;
    border-color: transparent;
    color: var(--color-muted);
    font-size: 16px;
    line-height: 1;
  }
  .remove:hover {
    background: var(--color-hover);
    color: var(--color-text);
  }
</style>
