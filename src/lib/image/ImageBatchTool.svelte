<!--
  여러 이미지를 넣고 한꺼번에 처리하는 도구의 공통 화면 (이미지 압축·크기 조절).
  처음에는 파일 고르기, 넣은 뒤에는 위에서부터 개수·추가 → 실행 막대 → 설정 → 이미지 목록.
  실행 막대와 설정, 목록 줄의 설명·버튼은 도구가 그린다. 파일은 어디로도 보내지 않는다.
  결과가 있는 줄의 '비교'를 누르면 설정·목록 자리에 원본과 결과를 겹친 비교 화면이 나온다.
-->
<script lang="ts">
  import '../../frame/controls.css';
  import { onMount, type Snippet } from 'svelte';
  import { pick } from '../../frame/locale';
  import { FRAME_MESSAGES } from '../../frame/messages';
  import FileDrop from '../../frame/FileDrop.svelte';
  import { onFrameFiles } from '../../frame/drop';
  import { requestShowTool } from '../../frame/parent';
  import { formatSize } from '../../frame/format';
  import CompareSlider from '../compare/CompareSlider.svelte';
  import type { BatchItem, ImageBatch } from './batch.svelte';

  interface Props {
    batch: ImageBatch;
    /** 처리 중에는 이미지를 더하거나 뺄 수 없다 */
    busy: boolean;
    /** 실행·다운로드 막대 (ActionBar) */
    bar: Snippet;
    /** 줄이는 정도 같은 설정 */
    options: Snippet;
    /** 읽은 이미지 줄의 설명 (처리 결과 등) */
    meta: Snippet<[BatchItem]>;
    /** 줄 오른쪽 빼기 버튼 앞의 버튼 (한 장 받기 등) */
    actions?: Snippet<[BatchItem]>;
    /** 파일 고르기 버튼 아래 안내. 없으면 JPG·PNG·WebP(HEIC를 받으면 HEIC까지) 안내 */
    hint?: string;
    /** 읽지 못한 이미지 줄의 안내. 없으면 '열 수 없는 이미지' */
    broken?: string;
    /** 이미지를 뺐을 때. 도구가 그 이미지의 결과를 버린다 (안 그러면 메모리에 남는다) */
    onremove: (item: BatchItem) => void;
    /** 지금 설정으로 만든 결과. 있으면 그 줄에 '비교' 버튼이 생긴다 */
    result?: (item: BatchItem) => Uint8Array | undefined;
  }

  let { batch, busy, bar, options, meta, actions, hint, broken, onremove, result }: Props =
    $props();
  const t = pick(FRAME_MESSAGES).images;

  /** 비교 화면에 띄운 이미지와 그 결과의 blob 주소 */
  let comparing: { item: BatchItem; url: string } | undefined = $state();

  function openCompare(item: BatchItem) {
    const bytes = result?.(item);
    if (!bytes) return;
    closeCompare();
    // 결과를 한 번 더 복사하지 않고 그대로 Blob에 넘긴다 (큰 결과에서 화면이 멈추지 않게)
    comparing = { item, url: URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>])) };
  }

  function closeCompare() {
    if (comparing) URL.revokeObjectURL(comparing.url);
    comparing = undefined;
  }

  // 설정을 바꾸거나 다시 처리해 결과가 없어지면 비교 화면도 닫는다
  $effect(() => {
    if (comparing && (busy || !result?.(comparing.item))) closeCompare();
  });

  function add(files: File[]) {
    const first = batch.items.length === 0;
    if (batch.add(files) && first) requestShowTool();
  }

  onMount(() =>
    onFrameFiles((files) => {
      if (!busy) add(files);
    }),
  );
</script>

<div class="tool">
  {#if batch.items.length === 0}
    <div class="drop">
      <FileDrop
        accept={batch.accept}
        label={t.choose}
        multiple
        hint={hint ?? (batch.heic ? t.hintHeic : t.hint)}
        onfiles={add}
      />
    </div>
  {:else}
    <div class="summary">
      <span aria-live="polite">{t.summary(batch.items.length, formatSize(batch.totalSize))}</span>
      <label class="btn" class:disabled={busy}>
        {t.add}
        <input
          type="file"
          class="visually-hidden"
          accept={batch.accept}
          multiple
          disabled={busy}
          onchange={(event) => {
            add([...(event.currentTarget.files ?? [])]);
            event.currentTarget.value = '';
          }}
        />
      </label>
    </div>

    <!-- 모바일 하단 고정 광고와 멀도록 목록 위에 둔다 -->
    {@render bar()}

    {#if comparing}
      {@const bytes = result?.(comparing.item)}
      <div class="compare">
        <div class="compare-head">
          <span class="name" title={comparing.item.name}>{comparing.item.name}</span>
          <button type="button" class="btn" onclick={closeCompare}>{t.back}</button>
        </div>
        <div class="compare-body">
          <CompareSlider
            before={{
              src: comparing.item.thumb!,
              label: t.original,
              detail: formatSize(comparing.item.file.size),
            }}
            after={{
              src: comparing.url,
              label: t.result,
              detail: bytes ? formatSize(bytes.length) : undefined,
            }}
            sliderLabel={t.slider}
            zoomIn={t.zoomIn}
            zoomOut={t.zoomOut}
          />
        </div>
      </div>
    {:else}
      <div class="options">
        {@render options()}
      </div>

      <ul class="list" aria-label={t.list}>
        {#each batch.items as item (item.id)}
          <li class="row">
            <div class="thumb">
              {#if item.thumb}
                <img src={item.thumb} alt="" />
              {/if}
            </div>
            <div class="info">
              <span class="name" title={item.name}>{item.name}</span>
              <span class="meta">
                {#if item.status === 'loading'}
                  {t.reading}
                {:else if item.status === 'error'}
                  <strong>{broken ?? t.broken}</strong>
                {:else}
                  {@render meta(item)}
                {/if}
              </span>
            </div>
            {#if result?.(item)}
              <button
                type="button"
                class="btn"
                onclick={() => openCompare(item)}
                aria-label={t.compare(item.name)}>{t.compareShort}</button
              >
            {/if}
            {@render actions?.(item)}
            <button
              type="button"
              class="btn icon"
              disabled={busy}
              onclick={() => {
                if (comparing?.item === item) closeCompare();
                batch.remove(item);
                onremove(item);
              }}
              aria-label={t.remove(item.name)}>×</button
            >
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</div>

<style>
  .tool {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--color-surface);
  }
  .drop {
    flex: 1;
    padding: 16px;
  }
  .summary {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: space-between;
    height: 48px;
    padding: 0 16px;
    border-bottom: 1px solid var(--color-line);
    font-size: 14px;
  }
  label.disabled {
    opacity: 0.4;
    cursor: default;
  }
  .options {
    display: flex;
    flex: none;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-line);
  }
  .options :global(.help) {
    flex-basis: 100%;
    margin: 0;
  }
  .compare {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  }
  .compare-head {
    display: flex;
    flex: none;
    align-items: center;
    gap: 12px;
    padding: 8px 16px;
    border-bottom: 1px solid var(--color-line);
  }
  .compare-head .name {
    flex: 1;
    min-width: 0;
  }
  .compare-body {
    flex: 1;
    min-height: 0;
    padding: 12px 16px;
  }
  .list {
    flex: 1;
    margin: 0;
    padding: 8px;
    overflow: auto;
    list-style: none;
  }
  /* 줄 높이 고정: 읽는 동안·처리한 뒤에 목록이 흔들리지 않게 */
  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 72px;
    padding: 0 8px;
  }
  .row + .row {
    border-top: 1px solid var(--color-line);
  }
  .thumb {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
  }
  .thumb img {
    max-width: 100%;
    max-height: 100%;
    box-shadow: var(--shadow-page);
  }
  .info {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .name {
    overflow: hidden;
    font-size: 15px;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .meta {
    overflow: hidden;
    color: var(--color-muted);
    font-size: 13px;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .meta :global(strong) {
    color: var(--color-text);
  }
  .row :global(.btn.icon) {
    font-size: 18px;
    line-height: 1;
  }
</style>
