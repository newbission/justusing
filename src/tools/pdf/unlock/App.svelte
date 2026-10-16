<!--
  PDF 암호 해제 도구 화면 (격리 frame 안에서 실행).
  암호를 넣어 연 PDF(또는 인쇄·복사 제한만 걸린 PDF)를 암호·제한 없는 PDF로 저장한다.
  파일은 어디로도 전송되지 않는다.
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
  import PageSelectGrid from '../../../lib/pdf/PageSelectGrid.svelte';
  import SinglePdfTool, { type LoadedPdf } from '../../../lib/pdf/SinglePdfTool.svelte';

  const common = pick(FRAME_MESSAGES);
  const t = pick(MESSAGES);

  let pdf: LoadedPdf | undefined = $state.raw();
  /** 암호(locked)·제한(restricted)이 걸렸는지. 확인 전에는 undefined */
  let protection: 'locked' | 'restricted' | 'plain' | undefined = $state();

  type Run =
    | { kind: 'idle' }
    | { kind: 'working' }
    | { kind: 'done'; name: string; bytes: Uint8Array }
    | { kind: 'failed'; message: string };
  let run = $state<Run>({ kind: 'idle' });

  async function onload(loaded: LoadedPdf) {
    pdf = loaded;
    run = { kind: 'idle' };
    protection = undefined;
    // 사용자 암호로 열었으면 암호 PDF, 암호 없이 열렸는데 암호화돼 있으면 제한만 걸린 PDF
    const { info } = await loaded.doc.getMetadata();
    if (pdf !== loaded) return;
    const encrypted = Boolean((info as { EncryptFilterName?: string | null }).EncryptFilterName);
    protection = loaded.password ? 'locked' : encrypted ? 'restricted' : 'plain';
  }

  async function unlock() {
    if (!pdf || run.kind === 'working') return;
    const entitlement = await canUse('pdf/unlock');
    if (!entitlement.allowed) {
      run = { kind: 'failed', message: entitlement.reason ?? common.action.unavailable };
      return;
    }
    const source = pdf;
    run = { kind: 'working' };
    try {
      const bytes = await modifyPdf(source, { kind: 'unlock' });
      if (pdf !== source) return;
      run = { kind: 'done', name: `${baseName(source.name)}_${t.suffix}.pdf`, bytes };
    } catch {
      if (pdf !== source) return;
      run = { kind: 'failed', message: t.failed };
    }
  }
</script>

<SinglePdfTool {onload} saves>
  {#snippet children({ doc })}
    <ActionBar label={t.bar}>
      {#snippet text()}
        {#if run.kind === 'working'}
          {t.working}
        {:else if run.kind === 'done'}
          {common.action.done(run.name, formatSize(run.bytes.length))}
        {:else if run.kind === 'failed'}
          <strong>{run.message}</strong>
        {:else if protection}
          {t[protection]}
        {:else}
          {t.checking}
        {/if}
      {/snippet}
      {#if run.kind === 'done'}
        {@const done = run}
        <button
          type="button"
          class="btn primary"
          onclick={() => downloadFile(done.bytes, done.name)}>{common.action.download}</button
        >
      {:else}
        <button
          type="button"
          class="btn primary"
          disabled={!protection || protection === 'plain' || run.kind === 'working'}
          onclick={unlock}>{run.kind === 'working' ? t.working : t.run}</button
        >
      {/if}
    </ActionBar>

    <div class="tool-body">
      <p class="help">{t.note}</p>
      <PageSelectGrid {doc} size={88} />
    </div>
  {/snippet}
</SinglePdfTool>
