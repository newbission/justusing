<!--
  PDF 자르기 도구 화면 (격리 frame 안에서 실행).
  쪽 위에서 남길 영역을 고르고, 이 쪽이나 모든 쪽의 보이는 영역을 그만큼으로 줄인다.
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
  import CropEditor from '../../../lib/pdf/CropEditor.svelte';
  import { modifyPdf, type PageRect } from '../../../lib/pdf/modify';
  import SinglePdfTool, { type LoadedPdf } from '../../../lib/pdf/SinglePdfTool.svelte';

  const common = pick(FRAME_MESSAGES);
  const t = pick(MESSAGES);

  /** 처음 영역: 가장자리를 5%씩 남긴 안쪽 */
  const INITIAL: PageRect = { x: 0.05, y: 0.05, width: 0.9, height: 0.9 };

  let pdf: LoadedPdf | undefined = $state.raw();
  let pageIndex = $state(0);
  let rect: PageRect = $state({ ...INITIAL });
  type Scope = 'page' | 'all';
  const SCOPES: Scope[] = ['page', 'all'];
  let scope: Scope = $state('page');

  const pages = $derived(
    !pdf
      ? []
      : scope === 'page'
        ? [pageIndex]
        : Array.from({ length: pdf.doc.numPages }, (_, i) => i),
  );

  type Run =
    | { kind: 'idle' }
    | { kind: 'working' }
    | { kind: 'done'; name: string; bytes: Uint8Array; signature: string }
    | { kind: 'failed'; message: string };
  let run = $state<Run>({ kind: 'idle' });
  const signature = $derived(
    `${pages.join(',')}:${[rect.x, rect.y, rect.width, rect.height].map((n) => n.toFixed(4))}`,
  );
  const result = $derived(run.kind === 'done' && run.signature === signature ? run : undefined);

  function onload(loaded: LoadedPdf) {
    pdf = loaded;
    pageIndex = 0;
    rect = { ...INITIAL };
    scope = 'page';
    run = { kind: 'idle' };
  }

  async function crop() {
    if (!pdf || run.kind === 'working') return;
    const entitlement = await canUse('pdf/crop');
    if (!entitlement.allowed) {
      run = { kind: 'failed', message: entitlement.reason ?? common.action.unavailable };
      return;
    }
    const source = pdf;
    const startedWith = signature;
    const job = { kind: 'crop', rect: { ...rect }, pages } as const;
    run = { kind: 'working' };
    try {
      const bytes = await modifyPdf(source, job);
      if (pdf !== source) return;
      run = {
        kind: 'done',
        name: `${baseName(source.name)}_${t.suffix}.pdf`,
        bytes,
        signature: startedWith,
      };
    } catch {
      if (pdf !== source) return;
      run = { kind: 'failed', message: t.failed };
    }
  }
</script>

<SinglePdfTool {onload}>
  {#snippet children({ doc })}
    <ActionBar label={t.bar}>
      {#snippet text()}
        {#if run.kind === 'working'}
          {t.working}
        {:else if result}
          {common.action.done(result.name, formatSize(result.bytes.length))}
        {:else if run.kind === 'failed'}
          <strong>{run.message}</strong>
        {:else}
          {t.ready(pages.length)}
        {/if}
      {/snippet}
      {#if result}
        <button
          type="button"
          class="btn primary"
          onclick={() => downloadFile(result.bytes, result.name)}>{common.action.download}</button
        >
      {:else}
        <button type="button" class="btn primary" disabled={run.kind === 'working'} onclick={crop}
          >{run.kind === 'working' ? t.working : t.run}</button
        >
      {/if}
    </ActionBar>

    <div class="tool-body">
      <div class="choices">
        <div class="choice" role="radiogroup" aria-label={t.scopeGroup}>
          {#each SCOPES as option (option)}
            <label class:checked={scope === option}>
              <input type="radio" name="scope" value={option} bind:group={scope} />
              {t.scopes[option]}
            </label>
          {/each}
        </div>
        <button type="button" class="btn" onclick={() => (rect = { ...INITIAL })}>{t.reset}</button>
      </div>
      <p class="help">{t.note}</p>
      <CropEditor {doc} bind:pageIndex bind:rect />
    </div>
  {/snippet}
</SinglePdfTool>
