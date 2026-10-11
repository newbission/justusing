<!--
  PDF 회전 도구 화면 (격리 frame 안에서 실행).
  쪽마다 또는 전체를 90°씩 돌려 새 PDF로 받는다. 파일은 어디로도 전송되지 않는다.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import FileDrop from '../../../frame/FileDrop.svelte';
  import { onFrameFiles } from '../../../frame/drop';
  import { requestShowTool } from '../../../frame/parent';
  import { downloadFile } from '../../../frame/download';
  import { canUse } from '../../../lib/entitlement';
  import { assemblePdf } from '../../../lib/pdf/assemble';
  import { isPasswordError, openPdf, type OpenedPdf } from '../../../lib/pdf/pdfjs';
  import RotateGrid, { normalize } from './RotateGrid.svelte';

  type Phase = 'idle' | 'loading' | 'password' | 'ready' | 'error';

  let phase: Phase = $state('idle');
  let fileName = $state('');
  let bytes: Uint8Array | undefined;
  /** 암호 PDF를 연 암호. 돌릴 때 같은 암호로 풀어서 쓴다 (결과에는 암호가 없다). */
  let password: string | undefined;
  let passwordInput = $state('');
  let wrongPassword = $state(false);
  let opened: OpenedPdf | undefined = $state.raw();

  const pageCount = $derived(opened?.doc.numPages ?? 0);

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
  let run: Run = $state({ kind: 'idle' });

  /** 쪽마다 실제 각도. 돌린 뒤 바뀌면 결과는 더 이상 맞지 않는다. */
  const signature = $derived(rotations.map(normalize).join(','));
  const result = $derived(run.kind === 'done' && run.signature === signature ? run : undefined);

  async function rotate() {
    if (!bytes || turnedCount === 0 || run.kind === 'working') return;
    const entitlement = await canUse('pdf/rotate');
    if (!entitlement.allowed) {
      run = { kind: 'failed', message: entitlement.reason ?? '지금은 사용할 수 없습니다.' };
      return;
    }

    const startedWith = signature;
    run = { kind: 'working' };
    try {
      const output = await assemblePdf({
        sources: [{ bytes, password }],
        pages: rotations.map((angle, index) => ({ source: 0, index, rotate: normalize(angle) })),
      });
      const base = fileName.replace(/\.pdf$/i, '');
      run = { kind: 'done', name: `${base}_회전.pdf`, bytes: output, signature: startedWith };
    } catch {
      run = { kind: 'failed', message: '돌리지 못했습니다. 파일이 손상되었을 수 있습니다.' };
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
      // pdf.js는 받은 버퍼를 워커로 넘겨 비워 버리므로 복사본을 준다 (원본은 돌릴 때 쓴다)
      opened = await openPdf(bytes.slice(), withPassword);
      password = withPassword;
      rotations = Array.from({ length: opened.doc.numPages }, () => 0);
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
    run = { kind: 'idle' };
    phase = 'idle';
  }

  // 화면 어디에 놓든 받는다. 돌리는 중에 새 파일을 놓으면 그 파일로 바뀐다.
  onMount(() =>
    onFrameFiles(([file]) => {
      if (file) open(file);
    }),
  );
</script>

<div class="rotate">
  {#if phase === 'ready' && opened}
    <div class="filebar">
      <span class="name" title={fileName}>{fileName}</span>
      <span class="meta">{pageCount}쪽</span>
      <button type="button" class="text" onclick={close}>다른 파일</button>
    </div>

    <!-- 실행·다운로드 막대: 높이 고정(처리 전후 같음). 모바일 하단 고정 광고와 멀도록 위에 둔다 -->
    <div class="action" role="group" aria-label="회전">
      <p class="action-text" aria-live="polite">
        {#if run.kind === 'working'}
          돌리는 중…
        {:else if result}
          완료: {result.name} · {formatSize(result.bytes.length)}
        {:else if run.kind === 'failed'}
          <strong>{run.message}</strong>
        {:else if turnedCount === 0}
          돌린 쪽이 없습니다.
        {:else}
          {turnedCount}쪽을 돌린 PDF를 만듭니다.
        {/if}
      </p>
      {#if result}
        <button
          type="button"
          class="primary"
          onclick={() => downloadFile(result.bytes, result.name)}>다운로드</button
        >
      {:else}
        <button
          type="button"
          class="primary"
          disabled={turnedCount === 0 || run.kind === 'working'}
          onclick={rotate}>{run.kind === 'working' ? '돌리는 중…' : 'PDF 회전'}</button
        >
      {/if}
    </div>

    <div class="body">
      <div class="all" role="group" aria-label="모든 쪽">
        <span class="help" aria-live="polite">
          {turnedCount > 0 ? `${turnedCount}쪽을 돌렸습니다.` : '돌릴 쪽의 ↺ ↻를 누르세요.'}
        </span>
        <button type="button" class="text" onclick={() => rotateAll(-90)}>전체 ↺</button>
        <button type="button" class="text" onclick={() => rotateAll(90)}>전체 ↻</button>
        <button type="button" class="text" disabled={turnedCount === 0} onclick={resetAll}
          >되돌리기</button
        >
      </div>
      <RotateGrid doc={opened.doc} bind:rotations />
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
  .rotate {
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

  .action {
    display: flex;
    flex: none;
    align-items: center;
    gap: 12px;
    height: 64px;
    padding: 0 16px;
    border-bottom: 1px solid var(--color-line);
  }
  /* 좁은 화면에서도 안내를 다 읽을 수 있게 두 줄까지 보여 준다 (막대 높이는 그대로) */
  .action-text {
    display: -webkit-box;
    flex: 1;
    min-width: 0;
    margin: 0;
    overflow: hidden;
    color: var(--color-muted);
    font-size: 14px;
    line-height: 1.35;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }
  .action-text strong {
    color: var(--color-text);
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

  /* 좁은 화면: 안내를 위 줄, 버튼을 아래 줄에 둔다 (높이는 처리 전후 같음) */
  @media (max-width: 520px) {
    .action {
      flex-wrap: wrap;
      align-content: center;
      row-gap: 8px;
      height: 112px;
    }
    .action-text {
      flex-basis: 100%;
    }
    .action button {
      flex: 1;
    }
  }
</style>
