<!--
  PDF 사진 꺼내기 도구 화면 (격리 frame 안에서 실행).
  PDF를 열면 안에 든 사진을 꺼내 보여 주고, 하나씩 또는 ZIP으로 받게 한다.
  JPG는 파일 안의 원본 그대로 꺼낸다. 파일은 어디로도 전송되지 않는다.
-->
<script lang="ts">
  import '../../../frame/controls.css';
  import { untrack } from 'svelte';
  import { pick } from '../../../frame/locale';
  import { FRAME_MESSAGES } from '../../../frame/messages';
  import { MESSAGES } from './messages';
  import ActionBar from '../../../frame/ActionBar.svelte';
  import { downloadFile } from '../../../frame/download';
  import { baseName, formatSize } from '../../../frame/format';
  import { canUse } from '../../../lib/entitlement';
  import { extractImages, type ExtractedImage } from '../../../lib/pdf/extract-images';
  import SinglePdfTool, { type LoadedPdf } from '../../../lib/pdf/SinglePdfTool.svelte';
  import { makeZip } from '../../../lib/zip';

  const common = pick(FRAME_MESSAGES);
  const t = pick(MESSAGES);

  /** "아주 작은 그림 빼기"를 켰을 때 짧은 변의 최소 화소 */
  const SMALL = 50;
  const TYPES = {
    jpg: 'image/jpeg',
    png: 'image/png',
    jp2: 'image/jp2',
    jpx: 'image/jpx',
    j2k: 'image/j2c',
  } as const;

  type Shown = ExtractedImage & { url?: string; name: string };

  let pdf: LoadedPdf | undefined = $state.raw();
  let skipSmall = $state(true);
  let images: Shown[] = $state.raw([]);

  type Read =
    | { kind: 'idle' }
    | { kind: 'reading'; done: number; total: number }
    | { kind: 'done'; failed: number }
    | { kind: 'failed'; message: string };
  let read = $state<Read>({ kind: 'idle' });
  let zipping = $state(false);

  const totalSize = $derived(images.reduce((sum, image) => sum + image.bytes.length, 0));

  function clear() {
    for (const image of images) if (image.url) URL.revokeObjectURL(image.url);
    images = [];
  }

  // 파일이나 "작은 그림 빼기"가 바뀌면 다시 꺼낸다
  $effect(() => {
    const source = pdf;
    const minSide = skipSmall ? SMALL : 1;
    if (!source) return;
    let current = true;
    // 지난 결과를 지운다 (images를 읽지만 다시 꺼낼 조건으로 삼지 않는다)
    untrack(clear);
    read = { kind: 'reading', done: 0, total: 0 };
    const found: Shown[] = [];
    // 꺼내기(미리보기 포함)도 기능 사용이라 시작하기 전에 확인한다
    (async () => {
      const entitlement = await canUse('pdf/extract-images');
      if (!current) return;
      if (!entitlement.allowed) {
        read = { kind: 'failed', message: entitlement.reason ?? common.action.unavailable };
        return;
      }
      try {
        const failed = await extractImages(
          source,
          minSide,
          (image) => {
            if (!current) return;
            found.push({
              ...image,
              // 미리보기는 브라우저가 그릴 수 있는 것만
              url:
                image.ext !== 'jpg' && image.ext !== 'png'
                  ? undefined
                  : URL.createObjectURL(
                      new Blob([image.bytes as BlobPart], { type: TYPES[image.ext] }),
                    ),
              name: `${baseName(source.name)}_p${image.page + 1}_${image.index + 1}.${image.ext}`,
            });
            images = [...found];
          },
          (done, total) => {
            if (current) read = { kind: 'reading', done, total };
          },
        );
        if (current) read = { kind: 'done', failed };
      } catch {
        if (current) read = { kind: 'failed', message: t.failed };
      }
    })();
    return () => {
      current = false;
    };
  });

  // 화면을 닫을 때 미리보기 주소를 돌려준다
  $effect(() => () => clear());

  function onload(loaded: LoadedPdf) {
    pdf = loaded;
  }

  /** 다른 파일을 고르려고 닫으면 하던 꺼내기를 버리고 결과·미리보기를 지운다 */
  function onclose() {
    pdf = undefined;
    clear();
    read = { kind: 'idle' };
  }

  async function allowed() {
    const entitlement = await canUse('pdf/extract-images');
    if (!entitlement.allowed) {
      read = { kind: 'failed', message: entitlement.reason ?? common.action.unavailable };
    }
    return entitlement.allowed;
  }

  async function saveOne(image: Shown) {
    if (!(await allowed())) return;
    downloadFile(image.bytes, image.name, TYPES[image.ext]);
  }

  async function saveAll() {
    if (!pdf || images.length === 0 || zipping || !(await allowed())) return;
    if (images.length === 1) {
      saveOne(images[0]!);
      return;
    }
    const source = pdf;
    zipping = true;
    try {
      // ZIP 워커로 넘기면 바이트를 쓸 수 없게 되므로 복사본을 넘긴다 (미리보기·하나씩 받기에 쓴다)
      const zip = await makeZip(images.map(({ name, bytes }) => ({ name, bytes: bytes.slice() })));
      if (pdf === source)
        downloadFile(zip, `${baseName(source.name)}_images.zip`, 'application/zip');
    } finally {
      zipping = false;
    }
  }
</script>

<SinglePdfTool {onload} {onclose}>
  {#snippet children()}
    <ActionBar label={t.bar}>
      {#snippet text()}
        {#if read.kind === 'reading'}
          {read.total === 0 ? t.scanning : t.reading(read.done, read.total)}
        {:else if read.kind === 'failed'}
          <strong>{read.message}</strong>
        {:else if read.kind === 'done' && images.length === 0}
          {t.none}
        {:else}
          {t.found(images.length, formatSize(totalSize))}
        {/if}
      {/snippet}
      <button
        type="button"
        class="btn primary"
        disabled={read.kind !== 'done' || images.length === 0 || zipping}
        onclick={saveAll}>{images.length === 1 ? common.action.download : t.downloadAll}</button
      >
    </ActionBar>

    <div class="tool-body">
      <label class="check">
        <input type="checkbox" bind:checked={skipSmall} disabled={read.kind === 'reading'} />
        {t.skipSmall}
      </label>
      {#if read.kind === 'done' && read.failed > 0}
        <p class="help">{t.failedNote(read.failed)}</p>
      {/if}

      <ul class="grid">
        {#each images as image (image.index)}
          <li>
            <figure>
              <div class="thumb">
                {#if image.url}
                  <img src={image.url} alt={t.imageLabel(image.index + 1)} />
                {:else}
                  <span class="nopreview">{t.jp2}</span>
                {/if}
              </div>
              <figcaption>
                {t.caption(
                  image.page + 1,
                  image.width,
                  image.height,
                  image.ext.toUpperCase(),
                  formatSize(image.bytes.length),
                )}
              </figcaption>
            </figure>
            <button
              type="button"
              class="btn"
              aria-label={`${t.imageLabel(image.index + 1)} ${t.download}`}
              onclick={() => saveOne(image)}>{t.download}</button
            >
          </li>
        {/each}
      </ul>
    </div>
  {/snippet}
</SinglePdfTool>

<style>
  .check {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 12px;
    font-size: 14px;
    cursor: pointer;
  }
  .check input {
    width: 18px;
    height: 18px;
    accent-color: var(--color-text);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 16px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  figure {
    margin: 0;
  }
  .thumb {
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1;
    border: 1px solid var(--color-line);
    border-radius: var(--radius);
    /* 투명한 사진도 보이게 종이색 바탕 */
    background: var(--color-paper);
    overflow: hidden;
  }
  img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
  .nopreview {
    padding: 8px;
    color: var(--color-muted);
    font-size: 12px;
    text-align: center;
  }
  figcaption {
    margin-top: 4px;
    color: var(--color-muted);
    font-size: 12px;
    line-height: 1.4;
  }
  li .btn {
    align-self: flex-start;
  }
</style>
