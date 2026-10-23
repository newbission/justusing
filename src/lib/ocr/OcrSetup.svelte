<!--
  글자 인식 도구의 언어 고르기와 데이터 받기 칸 (PDF·이미지 글자 인식).
  데이터가 없으면 받을 크기를 밝히고 "데이터 받기"를 누를 때만 받는다. 언어 옆에 도구의 다른 설정을 둘 수 있다.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { pick } from '../../frame/locale';
  import { FRAME_MESSAGES } from '../../frame/messages';
  import { formatSize } from '../../frame/format';
  import { OCR_LANGS } from './ocr';
  import type { OcrData } from './ocr-data.svelte';

  interface Props {
    data: OcrData;
    /** 인식하는 동안 언어를 바꾸지 못하게 한다 */
    busy: boolean;
    /** 언어 옆에 둘 도구의 다른 설정 */
    children?: Snippet;
  }

  let { data, busy, children }: Props = $props();
  const t = pick(FRAME_MESSAGES).ocr;
</script>

<div class="choices">
  <fieldset class="langs">
    <legend>{t.langGroup}</legend>
    {#each OCR_LANGS as lang (lang)}
      <label class="check">
        <input
          type="checkbox"
          value={lang}
          bind:group={data.langs}
          disabled={busy || data.state.kind === 'downloading'}
        />
        {t.langs[lang]}
      </label>
    {/each}
  </fieldset>
  {@render children?.()}
</div>

{#if data.langs.length > 0}
  <section class="data" aria-label={t.dataTitle}>
    {#if data.state.kind === 'ready'}
      <p>{t.dataReady}</p>
    {:else if data.state.kind === 'checking'}
      <p>{t.checking}</p>
    {:else}
      <h2>{t.dataTitle}</h2>
      {#if data.state.kind === 'missing' && data.state.removed}
        <p><strong>{t.dataRemoved}</strong></p>
      {/if}
      <p>{t.dataSize(formatSize(data.needBytes))}</p>
      <p class="help">{t.dataNote}</p>
      {#if data.state.kind === 'missing' && data.state.lowSpace}
        <p class="help">{t.lowSpace}</p>
      {/if}
      {#if data.state.kind === 'failed'}
        <p><strong>{t.dataFailed}</strong></p>
      {/if}
      <button
        type="button"
        class="btn primary"
        disabled={data.state.kind === 'downloading'}
        onclick={() => data.download()}
        >{data.state.kind === 'downloading'
          ? t.downloading(data.state.percent)
          : t.download(formatSize(data.needBytes))}</button
      >
    {/if}
  </section>
{/if}

<style>
  .langs {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    margin: 0;
    padding: 0;
    border: 0;
  }
  .langs legend {
    float: left;
    margin-right: 4px;
    font-size: 14px;
    color: var(--color-muted);
  }
  .check {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    cursor: pointer;
  }
  .check input {
    width: 18px;
    height: 18px;
    accent-color: var(--color-text);
  }
  .data {
    margin: 16px 0;
    padding: 16px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius);
  }
  .data h2 {
    margin: 0 0 8px;
    font-size: 15px;
  }
  .data p {
    margin: 0 0 8px;
    font-size: 14px;
  }
  .data .btn {
    margin-top: 4px;
  }
</style>
