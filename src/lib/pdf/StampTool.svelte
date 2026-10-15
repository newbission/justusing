<!--
  이미지를 쪽 위에 찍는 도구의 공통 화면 (이미지 넣기·서명 넣기).
  연 PDF와 찍을 이미지를 받아: 넣을 쪽(이 쪽만·모든 쪽) 고르기 → 배치 화면 → 실행·다운로드.
  이미지가 아직 없으면 도구가 준 picker를 보여 준다. 파일은 어디로도 전송되지 않는다.
-->
<script module lang="ts">
  import type { EmbeddableImage } from '../image/prepare';
  import type { StampPlace } from './modify';

  /** 찍을 이미지. 새 이미지마다 새 객체가 된다 (이전 결과를 가린다) */
  export interface StampImage {
    /** 화면에 보여 줄 blob 주소 */
    url: string;
    embed: EmbeddableImage;
  }

  /** 도구마다 다른 문구 */
  export interface StampMessages {
    bar: string;
    needImage: string;
    ready: (pages: number) => string;
    working: string;
    run: string;
    failed: string;
    /** 결과 파일 이름 뒤에 붙는 말 */
    suffix: string;
    scopeGroup: string;
    scopes: { page: string; all: string };
  }

  export type { StampPlace };
</script>

<script lang="ts">
  import '../../frame/controls.css';
  import { untrack, type Snippet } from 'svelte';
  import { pick } from '../../frame/locale';
  import { FRAME_MESSAGES } from '../../frame/messages';
  import ActionBar from '../../frame/ActionBar.svelte';
  import { downloadFile } from '../../frame/download';
  import { baseName, formatSize } from '../../frame/format';
  import { canUse } from '../entitlement';
  import { modifyPdf } from './modify';
  import PlacementEditor from './PlacementEditor.svelte';
  import type { LoadedPdf } from './SinglePdfTool.svelte';

  const common = pick(FRAME_MESSAGES);

  interface Props {
    pdf: LoadedPdf;
    image: StampImage | undefined;
    /** 이용 권한 확인에 쓰는 도구 ID (예: 'pdf/sign') */
    toolId: string;
    t: StampMessages;
    /** 처음 놓을 자리 */
    initialPlace: StampPlace;
    /** 이미지가 없을 때 보여 줄 고르기 화면 */
    picker: Snippet;
    /** 고르기 줄 옆에 붙일 단추 (예: 다른 이미지) */
    actions: Snippet;
  }

  let { pdf, image, toolId, t, initialPlace, picker, actions }: Props = $props();

  let pageIndex = $state(0);
  // 처음 자리만 쓴다 (그 뒤로는 사용자가 옮긴다)
  let place: StampPlace = $state(untrack(() => ({ ...initialPlace })));
  type Scope = 'page' | 'all';
  const SCOPES: Scope[] = ['page', 'all'];
  let scope: Scope = $state('page');

  const pages = $derived(
    scope === 'page' ? [pageIndex] : Array.from({ length: pdf.doc.numPages }, (_, i) => i),
  );

  type Run =
    | { kind: 'idle' }
    | { kind: 'working' }
    | { kind: 'done'; name: string; bytes: Uint8Array; signature: string }
    | { kind: 'failed'; message: string };
  let run = $state<Run>({ kind: 'idle' });

  /** 이미지마다 다른 번호 (같은 자리라도 이미지가 바뀌면 결과는 맞지 않다) */
  let imageIds = new WeakMap<StampImage, number>();
  let nextImageId = 0;
  function imageId(value: StampImage) {
    let id = imageIds.get(value);
    if (id === undefined) imageIds.set(value, (id = nextImageId++));
    return id;
  }

  const signature = $derived(
    image
      ? `${imageId(image)}:${pages.join(',')}:${place.x.toFixed(4)}:${place.y.toFixed(4)}:${place.width.toFixed(4)}`
      : '',
  );
  const result = $derived(run.kind === 'done' && run.signature === signature ? run : undefined);

  // 새 PDF를 열면 처음 상태로
  $effect(() => {
    void pdf;
    pageIndex = 0;
    scope = 'page';
    run = { kind: 'idle' };
  });

  async function stamp() {
    if (!image || run.kind === 'working') return;
    const entitlement = await canUse(toolId);
    if (!entitlement.allowed) {
      run = { kind: 'failed', message: entitlement.reason ?? common.action.unavailable };
      return;
    }
    const source = pdf;
    const startedWith = signature;
    const job = {
      kind: 'stamp-image',
      image: { kind: image.embed.kind, bytes: image.embed.bytes },
      place: { ...place },
      pages,
    } as const;
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

<ActionBar label={t.bar}>
  {#snippet text()}
    {#if run.kind === 'working'}
      {t.working}
    {:else if result}
      {common.action.done(result.name, formatSize(result.bytes.length))}
    {:else if run.kind === 'failed'}
      <strong>{run.message}</strong>
    {:else if !image}
      {t.needImage}
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
    <button
      type="button"
      class="btn primary"
      disabled={!image || run.kind === 'working'}
      onclick={stamp}>{run.kind === 'working' ? t.working : t.run}</button
    >
  {/if}
</ActionBar>

<div class="tool-body">
  {#if image}
    <div class="choices">
      <div class="choice" role="radiogroup" aria-label={t.scopeGroup}>
        {#each SCOPES as option (option)}
          <label class:checked={scope === option}>
            <input type="radio" name="scope" value={option} bind:group={scope} />
            {t.scopes[option]}
          </label>
        {/each}
      </div>
      {@render actions()}
    </div>
    <PlacementEditor
      doc={pdf.doc}
      image={{ url: image.url, width: image.embed.width, height: image.embed.height }}
      bind:pageIndex
      bind:place
    />
  {:else}
    {@render picker()}
  {/if}
</div>
