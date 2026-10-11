<!--
  PDF 보기 도구 화면 (격리 frame 안에서 실행).
  파일을 메모리에서 바로 열어 페이지를 세로로 이어 보여준다. 파일은 어디로도 전송되지 않는다.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import FileDrop from '../../../frame/FileDrop.svelte';
  import PdfPage from './PdfPage.svelte';
  import {
    isPasswordError,
    openPdf,
    type OpenedPdf,
    type PDFPageProxy,
  } from '../../../lib/pdf/pdfjs';

  type Phase = 'idle' | 'loading' | 'password' | 'ready' | 'error';

  /** 확대·축소 단계 (1 = 100%) */
  const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
  /** 폭 맞춤일 때 페이지 양옆 여백 합계(px) */
  const SIDE_PADDING = 32;

  let phase: Phase = $state('idle');
  let fileName = $state('');
  let errorMessage = $state('');
  let wrongPassword = $state(false);
  let password = $state('');

  let opened: OpenedPdf | undefined;
  let bytes: Uint8Array | undefined;
  let pages: PDFPageProxy[] = $state([]);

  let fitWidth = $state(true);
  let manualScale = $state(1);
  let viewerWidth = $state(0);
  let currentPage = $state(1);
  let scroller: HTMLDivElement | undefined = $state();

  /** 폭 맞춤 배율: 첫 페이지가 화면 폭에 꼭 맞는 배율 */
  const fitScale = $derived.by(() => {
    const first = pages[0];
    if (!first || viewerWidth === 0) return 1;
    const pageWidth = first.getViewport({ scale: 1 }).width;
    return Math.max(0.25, (viewerWidth - SIDE_PADDING) / pageWidth);
  });
  const scale = $derived(fitWidth ? fitScale : manualScale);

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
      // pdf.js는 받은 버퍼를 워커로 넘겨 비워 버리므로 암호 재시도를 위해 복사본을 준다
      opened = await openPdf(bytes.slice(), withPassword);
      const { doc } = opened;
      pages = await Promise.all(Array.from({ length: doc.numPages }, (_, i) => doc.getPage(i + 1)));
      currentPage = 1;
      fitWidth = true;
      phase = 'ready';
    } catch (error) {
      if (isPasswordError(error)) {
        wrongPassword = withPassword !== undefined;
        password = '';
        phase = 'password';
      } else {
        errorMessage = 'PDF를 열 수 없습니다. 파일이 손상되었거나 PDF 파일이 아닐 수 있습니다.';
        phase = 'error';
      }
    }
  }

  async function close() {
    pages = [];
    bytes = undefined;
    wrongPassword = false;
    await opened?.close();
    opened = undefined;
    phase = 'idle';
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

  // 배율이 바뀌면 보고 있던 페이지를 유지한다
  $effect(() => {
    void scale;
    const keep = untrack(() => currentPage);
    requestAnimationFrame(() => goTo(keep));
  });
</script>

<div class="viewer">
  {#if phase === 'ready'}
    <div class="toolbar" role="toolbar" aria-label="PDF 보기 도구">
      <span class="file-name" title={fileName}>{fileName}</span>

      <div class="group">
        <button
          type="button"
          onclick={() => goTo(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="이전 페이지">‹</button
        >
        <span class="page-count" aria-live="polite">{currentPage} / {pages.length}</span>
        <button
          type="button"
          onclick={() => goTo(currentPage + 1)}
          disabled={currentPage >= pages.length}
          aria-label="다음 페이지">›</button
        >
      </div>

      <div class="group">
        <button type="button" onclick={() => zoom(-1)} aria-label="축소">−</button>
        <span class="zoom">{Math.round(scale * 100)}%</span>
        <button type="button" onclick={() => zoom(1)} aria-label="확대">+</button>
        <button type="button" class="text" onclick={() => (fitWidth = true)} aria-pressed={fitWidth}
          >폭 맞춤</button
        >
      </div>

      <button type="button" class="text" onclick={close}>다른 파일</button>
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
      aria-label="{fileName} 페이지 목록"
    >
      {#each pages as page (page.pageNumber)}
        <PdfPage {page} {scale} />
      {/each}
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
          bind:value={password}
          autocomplete="off"
          onkeydown={(event) => {
            if (event.key === 'Enter' && password) load(password);
          }}
        />
      </label>
      {#if wrongPassword}
        <p class="error" role="alert">암호가 맞지 않습니다.</p>
      {/if}
      <div class="actions">
        <button type="button" class="primary" disabled={!password} onclick={() => load(password)}
          >열기</button
        >
        <button type="button" class="text" onclick={close}>취소</button>
      </div>
    </div>
  {:else}
    {#if phase === 'error'}
      <p class="error banner" role="alert">{errorMessage}</p>
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
  .viewer {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--color-surface);
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
  button.text {
    font-size: 14px;
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
  }
</style>
