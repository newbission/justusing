<!--
  글꼴 고르기 (글자 워터마크 등 글자를 PDF에 넣는 도구가 쓴다).
  글꼴마다 미리 그린 미리보기와 크기를 보여 주고, 받지 않은 글꼴은 '받기'를 눌러야 받는다.
  받은 글꼴은 바깥 페이지 보관소에 남아 다음 방문에 다시 받지 않는다 (src/frame/data.ts).
  내 글꼴을 올릴 수도 있다 (이 페이지에서만 쓰고 보관하지 않는다).
-->
<script lang="ts" module>
  import type { FontWeight } from './catalog';

  /** 고른 글꼴. 굵기마다 글꼴 파일 바이트 (확인을 거친 것) */
  export interface SelectedFont {
    id: string;
    name: string;
    files: Partial<Record<FontWeight, Uint8Array>>;
    /** 한글 음절이 일부만 있으면 그 수 */
    hangul?: number;
  }
</script>

<script lang="ts">
  import { onMount } from 'svelte';
  import { pick, frameLocale } from '../../frame/locale';
  import { FRAME_MESSAGES } from '../../frame/messages';
  import { dataStatus, loadData, missingData } from '../../frame/data';
  import { formatSize } from '../../frame/format';
  import { FONTS, fontConsent, fontPreview, type FontEntry } from './catalog';

  interface Props {
    selected?: SelectedFont;
  }

  let { selected = $bindable() }: Props = $props();
  const t = pick(FRAME_MESSAGES).fonts;
  const locale = frameLocale;

  type State =
    | { kind: 'checking' }
    | { kind: 'missing'; lowSpace: boolean }
    /** 전에 받았는데 보관본이 지워졌다 */
    | { kind: 'removed'; lowSpace: boolean }
    | { kind: 'cached' }
    | { kind: 'downloading'; percent: number }
    | { kind: 'failed' };

  let states: Record<string, State> = $state(
    Object.fromEntries(FONTS.map((font) => [font.id, { kind: 'checking' }])),
  );
  /** 이미 읽은 글꼴 (다시 고를 때 보관소에 묻지 않는다) */
  const loaded = new Map<string, SelectedFont>();
  let uploaded: SelectedFont | undefined = $state.raw();
  /** 올릴 때마다 다른 id를 붙여, 다른 글꼴을 올리면 도구가 이전 결과를 버리게 한다 */
  let uploads = 0;
  let uploadError = $state(false);

  function toSelected(font: FontEntry, bytes: Map<string, Uint8Array>): SelectedFont {
    const partial = font.files.find((file) => file.hangul < 11172)?.hangul;
    return {
      id: font.id,
      name: font.name[locale],
      files: Object.fromEntries(font.files.map((file) => [file.weight, bytes.get(file.path)!])),
      hangul: partial,
    };
  }

  /**
   * 마지막으로 고른 것의 번호. 글꼴을 받는 동안 다른 글꼴을 고르면, 먼저 고른 것이 늦게 끝나도
   * 고른 글꼴을 바꾸지 않는다 (받기는 끝까지 해서 보관해 둔다)
   */
  let picks = 0;

  /** 보관된 글꼴을 고른다 (보관소에서 바로 읽는다) */
  async function choose(font: FontEntry) {
    const ready = loaded.get(font.id);
    if (ready) {
      picks++;
      selected = ready;
      return;
    }
    await download(font);
  }

  async function download(font: FontEntry) {
    const pick = ++picks;
    const wasCached = states[font.id]?.kind === 'cached';
    states[font.id] = { kind: 'downloading', percent: 0 };
    try {
      const bytes = await loadData(font.files, fontConsent(font), (received) => {
        states[font.id] = {
          kind: 'downloading',
          percent: Math.min(99, Math.round((received / font.bytes) * 100)),
        };
      });
      const entry = toSelected(font, bytes);
      loaded.set(font.id, entry);
      states[font.id] = { kind: 'cached' };
      if (pick === picks) selected = entry;
    } catch {
      states[font.id] = wasCached ? { kind: 'cached' } : { kind: 'failed' };
    }
  }

  /** 마지막으로 시작한 올리기의 번호. 먼저 올린 큰 글꼴이 늦게 읽혀도 나중에 올린 글꼴을 덮지 않는다 */
  let uploading = 0;

  async function upload(file: File) {
    const attempt = ++uploading;
    uploadError = false;
    // 읽는 동안 다른 글꼴을 고르면 그쪽을 남긴다 (고른 순서대로)
    const pick = ++picks;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      // 브라우저가 읽을 수 있는 글꼴인지 확인한다 (파일을 어디로도 보내지 않는다)
      await new FontFace('upload-check', bytes).load();
      // 그새 다른 올리기를 시작했거나 다른 글꼴(이전에 올린 글꼴 포함)을 골랐으면 이 글꼴은 쓰지 않는다.
      // 고른 것과 화면에 보이는 '내 글꼴'이 어긋나지 않게 한다
      if (attempt !== uploading || pick !== picks) return;
      uploaded = {
        id: `upload-${uploads++}`,
        name: file.name.replace(/\.[^.]+$/, ''),
        files: { 400: bytes },
      };
      selected = uploaded;
    } catch {
      if (attempt === uploading) uploadError = true;
    }
  }

  onMount(async () => {
    for (const font of FONTS) {
      const status = await dataStatus(font.files, fontConsent(font));
      const lowSpace = status.available !== undefined && status.available < font.bytes * 2;
      const missing = missingData(font.files, status);
      states[font.id] =
        missing.bytes === 0
          ? { kind: 'cached' }
          : missing.removed
            ? { kind: 'removed', lowSpace }
            : { kind: 'missing', lowSpace };
    }
    // 받아 둔 글꼴이 있으면 목록 순서대로 첫 글꼴을 골라 둔다 (보관소에서 바로 읽는다)
    const first = FONTS.find((font) => states[font.id]?.kind === 'cached');
    // 사용자가 그새 글꼴을 고르거나 받기 시작했으면 건드리지 않는다
    if (!selected && picks === 0 && first) await choose(first);
  });
</script>

<fieldset class="fonts">
  <legend>{t.group}</legend>
  <p class="help">{t.note}</p>
  <ul class="list">
    {#each FONTS as font (font.id)}
      {@const state = states[font.id]!}
      {@const bold = font.files.some((file) => file.weight === 700)}
      {@const partial = font.files.find((file) => file.hangul < 11172)?.hangul}
      <li class="row" class:checked={selected?.id === font.id}>
        <div class="head">
          <label class="name">
            <input
              type="radio"
              name="font"
              checked={selected?.id === font.id}
              disabled={state.kind !== 'cached'}
              aria-label={t.choose(font.name[locale])}
              onchange={() => choose(font)}
            />
            <strong>{font.name[locale]}</strong>
            <span class="meta">{t.weights(bold)} · {formatSize(font.bytes)}</span>
          </label>
          {#if state.kind === 'cached'}
            <span class="ready">{t.ready}</span>
          {:else if state.kind === 'downloading'}
            <span class="meta" aria-live="polite">{t.downloading(state.percent)}</span>
          {:else if state.kind !== 'checking'}
            <button
              type="button"
              class="btn"
              aria-label={t.download(font.name[locale])}
              onclick={() => download(font)}>{t.downloadShort}</button
            >
          {/if}
        </div>
        <img class="preview" src={fontPreview(font, locale)} alt={t.preview(font.name[locale])} />
        {#if font.source}
          <p class="note">{t.source(font.source)}</p>
        {/if}
        {#if partial}
          <p class="note">{t.partial(partial)}</p>
        {/if}
        {#if state.kind === 'removed'}
          <p class="note"><strong>{t.removed}</strong></p>
        {:else if state.kind === 'failed'}
          <p class="note"><strong>{t.failed}</strong></p>
        {/if}
        {#if (state.kind === 'missing' || state.kind === 'removed') && state.lowSpace}
          <p class="note">{t.lowSpace}</p>
        {/if}
      </li>
    {/each}
    <li class="row" class:checked={selected !== undefined && selected.id === uploaded?.id}>
      <div class="head">
        <label class="name">
          <input
            type="radio"
            name="font"
            checked={selected !== undefined && selected.id === uploaded?.id}
            disabled={!uploaded}
            aria-label={uploaded ? t.mine(uploaded.name) : t.mineEmpty}
            onchange={() => {
              picks++;
              selected = uploaded;
            }}
          />
          <strong>{uploaded ? t.mine(uploaded.name) : t.mineEmpty}</strong>
        </label>
        <label class="btn">
          {t.upload}
          <input
            type="file"
            class="visually-hidden"
            accept=".ttf,.otf,.woff,font/ttf,font/otf,font/woff"
            onchange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) upload(file);
              event.currentTarget.value = '';
            }}
          />
        </label>
      </div>
      <p class="note">{t.uploadNote}</p>
      {#if uploadError}
        <p class="note"><strong>{t.uploadFailed}</strong></p>
      {/if}
    </li>
  </ul>
</fieldset>

<style>
  .fonts {
    min-width: 0;
    margin: 0 0 16px;
    padding: 0;
    border: 0;
  }
  legend {
    margin-bottom: 6px;
    padding: 0;
    font-size: 14px;
    font-weight: 600;
  }
  .help {
    margin: 0 0 12px;
  }
  .list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .row {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
    padding: 10px 12px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius);
  }
  .row.checked {
    border-color: var(--color-accent);
    box-shadow: inset 0 0 0 1px var(--color-accent);
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .name {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 8px;
    min-width: 0;
    font-size: 15px;
    cursor: pointer;
  }
  .name input {
    align-self: center;
    accent-color: var(--color-accent);
  }
  .meta {
    color: var(--color-muted);
    font-size: 13px;
  }
  .ready {
    flex: none;
    color: var(--color-accent);
    font-size: 13px;
    font-weight: 600;
  }
  /* 미리보기는 종이처럼 두 테마 모두 흰 바탕 위에 그린다 (그림 글자색이 검정이라) */
  .preview {
    display: block;
    width: 100%;
    height: auto;
    padding: 8px;
    border-radius: 4px;
    background: var(--color-paper);
  }
  .note {
    margin: 0;
    color: var(--color-muted);
    font-size: 12px;
  }
  .note strong {
    color: var(--color-text);
  }
</style>
