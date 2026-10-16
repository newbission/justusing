<!--
  PDF 암호 걸기 도구 화면 (격리 frame 안에서 실행).
  PDF에 열기 암호를 건다 (AES-256). 파일과 암호는 어디로도 전송되지 않는다.
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
  import { modifyPdf } from '../../../lib/pdf/modify';
  import SinglePdfTool, { type LoadedPdf } from '../../../lib/pdf/SinglePdfTool.svelte';

  const common = pick(FRAME_MESSAGES);
  const t = pick(MESSAGES);

  let pdf: LoadedPdf | undefined = $state.raw();
  let password = $state('');
  let confirm = $state('');

  /** 걸 수 없을 때 그 이유 */
  const problem = $derived.by(() => {
    if (!password) return t.enterPassword;
    if (password !== confirm) return t.mismatch;
    return undefined;
  });

  type Run =
    | { kind: 'idle' }
    | { kind: 'working' }
    | { kind: 'done'; name: string; bytes: Uint8Array; signature: string }
    | { kind: 'failed'; message: string };
  let run = $state<Run>({ kind: 'idle' });
  /** 암호를 바꾸면 이전 결과는 맞지 않는다 */
  const result = $derived(run.kind === 'done' && run.signature === password ? run : undefined);

  function onload(loaded: LoadedPdf) {
    pdf = loaded;
    run = { kind: 'idle' };
  }

  async function protect() {
    if (!pdf || problem || run.kind === 'working') return;
    const entitlement = await canUse('pdf/protect');
    if (!entitlement.allowed) {
      run = { kind: 'failed', message: entitlement.reason ?? common.action.unavailable };
      return;
    }
    const source = pdf;
    const chosen = password;
    run = { kind: 'working' };
    try {
      const bytes = await modifyPdf(source, { kind: 'protect', password: chosen });
      if (pdf !== source) return;
      run = {
        kind: 'done',
        name: `${baseName(source.name)}_${t.suffix}.pdf`,
        bytes,
        signature: chosen,
      };
    } catch {
      if (pdf !== source) return;
      run = { kind: 'failed', message: t.failed };
    }
  }
</script>

<SinglePdfTool {onload} saves>
  {#snippet children()}
    <ActionBar label={t.bar}>
      {#snippet text()}
        {#if run.kind === 'working'}
          {t.working}
        {:else if result}
          {common.action.done(result.name, formatSize(result.bytes.length))}
        {:else if run.kind === 'failed'}
          <strong>{run.message}</strong>
        {:else}
          {problem ?? t.ready}
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
          disabled={problem !== undefined || run.kind === 'working'}
          onclick={protect}>{run.kind === 'working' ? t.working : t.run}</button
        >
      {/if}
    </ActionBar>

    <!-- 격리 frame은 form 제출이 막혀 있어 Enter 키로 직접 처리한다 -->
    <div class="tool-body">
      <label class="field">
        {t.password}
        <input
          type="password"
          autocomplete="new-password"
          bind:value={password}
          onkeydown={(event) => event.key === 'Enter' && protect()}
        />
      </label>
      <label class="field">
        {t.confirm}
        <input
          type="password"
          autocomplete="new-password"
          bind:value={confirm}
          aria-invalid={confirm !== '' && password !== confirm}
          onkeydown={(event) => event.key === 'Enter' && protect()}
        />
      </label>
      <p class="help">{t.note}</p>
    </div>
  {/snippet}
</SinglePdfTool>
