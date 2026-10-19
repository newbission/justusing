<!--
  PDF 하나를 열어 다루는 도구의 공통 틀 (나누기·회전·정리 등).
  파일 고르기 → 여는 중 → (암호) → 파일 이름 막대 + 도구 화면. 도구는 연 PDF를 받아 화면만 그린다.
  파일은 어디로도 전송되지 않는다.
-->
<script module lang="ts">
  import type { PDFDocumentProxy } from './pdfjs';

  /** 연 PDF. 새 파일을 열 때마다 새 객체가 된다 (도구는 이걸로 이전 파일의 결과를 가린다). */
  export interface LoadedPdf {
    name: string;
    /** 원본 바이트. 결과 PDF를 만들 때 쓴다 */
    bytes: Uint8Array;
    /** 암호 PDF를 연 암호. 결과를 만들 때 같은 암호로 푼다 (결과에는 암호가 없다) */
    password?: string;
    doc: PDFDocumentProxy;
  }
</script>

<script lang="ts">
  import { pick } from '../../frame/locale';
  import { FRAME_MESSAGES } from '../../frame/messages';

  const t = pick(FRAME_MESSAGES);
  import { onMount, type Snippet } from 'svelte';
  import FileDrop from '../../frame/FileDrop.svelte';
  import { onFrameFiles } from '../../frame/drop';
  import { requestShowTool } from '../../frame/parent';
  import { isPasswordError, isSigned, openPdf, type OpenedPdf } from './pdfjs';

  interface Props {
    /** 새 PDF를 열었을 때. 도구는 여기서 화면 상태를 처음으로 되돌린다 */
    onload: (pdf: LoadedPdf) => void;
    /** 연 PDF를 닫을 때 ("다른 파일", 새 파일 열기). 도구는 진행 중인 처리를 그만둔다 */
    onclose?: () => void;
    /** 연 PDF로 그리는 도구 화면 */
    children: Snippet<[LoadedPdf]>;
    /** 고친 PDF를 저장하는 도구. 전자 서명된 PDF면 저장한 파일에서 서명이 깨진다고 알린다 */
    saves?: boolean;
  }

  let { onload, onclose, children, saves = false }: Props = $props();

  type Phase = 'idle' | 'loading' | 'password' | 'ready' | 'error';

  let phase: Phase = $state('idle');
  /** 고른 파일 이름 (암호 입력 화면에도 보인다) */
  let fileName = $state('');
  let bytes: Uint8Array | undefined;
  /** 고른 파일. 서명 확인 워커가 바이트 복사 없이 직접 읽는다 */
  let picked: File | undefined;
  let passwordInput = $state('');
  let wrongPassword = $state(false);
  let opened: OpenedPdf | undefined;
  let loaded: LoadedPdf | undefined = $state.raw();
  let signed = $state(false);

  /** 닫거나 새 파일을 열 때마다 늘어난다. 늦게 끝난 예전 열기가 지금 파일을 덮어쓰지 않게 한다 */
  let generation = 0;

  async function open(file: File) {
    // close()가 기다리기 전에 세대를 늘리므로, 기다리기 전에 받아 두어야 열기마다 다른 번호가 된다
    const closing = close();
    const ticket = generation;
    await closing;
    if (ticket !== generation) return;
    const read = new Uint8Array(await file.arrayBuffer());
    if (ticket !== generation) return;
    fileName = file.name;
    bytes = read;
    picked = file;
    await load();
  }

  async function load(withPassword?: string) {
    if (!bytes) return;
    const ticket = generation;
    const source = { name: fileName, bytes };
    const file = picked;
    phase = 'loading';
    try {
      // pdf.js는 받은 버퍼를 워커로 넘겨 비워 버리므로 복사본을 준다 (원본은 결과를 만들 때 쓴다)
      const current = await openPdf(source.bytes.slice(), withPassword);
      // 서명 안내를 보기 전에 저장하지 않게, 확인이 끝난 뒤에야 도구 화면(저장 버튼)을 연다
      const value = saves && (await isSigned(current.doc, file));
      // 여는 사이에 닫았거나 다른 파일을 열었으면 이 문서는 닫고 그만둔다
      if (ticket !== generation) {
        await current.close();
        return;
      }
      opened = current;
      signed = value;
      loaded = { ...source, password: withPassword, doc: current.doc };
      onload(loaded);
      phase = 'ready';
      requestShowTool();
    } catch (error) {
      if (ticket !== generation) return;
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
    generation++;
    onclose?.();
    // 상태는 기다리기 전에 비운다. 기다린 뒤에 비우면, 늦게 끝난 닫기가 그사이 연 새 파일의 상태를 지운다
    const closing = opened;
    opened = undefined;
    loaded = undefined;
    signed = false;
    bytes = undefined;
    picked = undefined;
    wrongPassword = false;
    phase = 'idle';
    await closing?.close();
  }

  // 화면 어디에 놓든 받는다. 처리하는 중에 새 파일을 놓으면 그 파일로 바뀐다.
  onMount(() =>
    onFrameFiles(([file]) => {
      if (file) open(file);
    }),
  );
</script>

<div class="tool">
  {#if phase === 'ready' && loaded}
    <div class="filebar">
      <span class="name" title={loaded.name}>{loaded.name}</span>
      <span class="meta">{t.pdf.pages(loaded.doc.numPages)}</span>
      <button type="button" class="text" onclick={close}>{t.pdf.otherFile}</button>
    </div>
    {#if signed}
      <p class="signed" role="note">{t.pdf.signed}</p>
    {/if}
    {@render children(loaded)}
  {:else if phase === 'loading'}
    <p class="status" role="status">{t.pdf.opening}</p>
  {:else if phase === 'password'}
    <!-- 격리 frame은 form 제출이 막혀 있어(sandbox에 allow-forms 없음) form 대신 직접 처리한다 -->
    <div class="password" role="group" aria-label={t.pdf.passwordGroup}>
      <p class="file" title={fileName}>{fileName}</p>
      <p>{t.pdf.passwordPrompt}</p>
      <p class="hint">{t.pdf.passwordNote}</p>
      <label>
        {t.pdf.passwordLabel}
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
        <p class="error" role="alert">{t.pdf.wrongPassword}</p>
      {/if}
      <div class="actions">
        <button
          type="button"
          class="primary"
          disabled={!passwordInput}
          onclick={() => load(passwordInput)}>{t.pdf.open}</button
        >
        <button type="button" class="text" onclick={close}>{t.pdf.cancel}</button>
      </div>
    </div>
  {:else}
    {#if phase === 'error'}
      <p class="error banner" role="alert">
        {t.pdf.cannotOpen}
      </p>
    {/if}
    <div class="drop">
      <FileDrop
        accept="application/pdf,.pdf"
        label={t.pdf.choose}
        hint={t.pdf.stays}
        onfiles={([file]) => file && open(file)}
      />
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
  .signed {
    flex: none;
    margin: 0;
    padding: 8px 16px;
    border-bottom: 1px solid var(--color-line);
    font-size: 13px;
    font-weight: 600;
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
  /* 어느 파일의 암호인지 (여러 번 고르다 헷갈리지 않게) */
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
</style>
