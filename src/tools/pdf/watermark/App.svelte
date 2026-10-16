<!--
  PDF 글자 워터마크 도구 화면 (격리 frame 안에서 실행).
  고른 한글 글꼴로 모든 쪽에 같은 글자를 비스듬히·가로로, 가운데 하나 또는 쪽 전체에 반복해 넣는다.
  쪽 위에 실제 글꼴로 미리 보여 준다. 파일은 어디로도 전송되지 않는다.
-->
<script lang="ts">
  import '../../../frame/controls.css';
  import { pick } from '../../../frame/locale';
  import { FRAME_MESSAGES } from '../../../frame/messages';
  import { MESSAGES, type Angle, type Size, type Strength, type Tint } from './messages';
  import ActionBar from '../../../frame/ActionBar.svelte';
  import { downloadFile } from '../../../frame/download';
  import { baseName, formatSize } from '../../../frame/format';
  import { canUse } from '../../../lib/entitlement';
  import FontPicker, { type SelectedFont } from '../../../lib/fonts/FontPicker.svelte';
  import type { FontWeight } from '../../../lib/fonts/catalog';
  import PageSheet from '../../../lib/pdf/PageSheet.svelte';
  import SinglePdfTool, { type LoadedPdf } from '../../../lib/pdf/SinglePdfTool.svelte';
  import {
    addWatermark,
    MissingGlyphsError,
    placements,
    type WatermarkLayout,
    type WatermarkOptions,
  } from '../../../lib/pdf/watermark';

  const common = pick(FRAME_MESSAGES);
  const t = pick(MESSAGES);

  const LAYOUTS: WatermarkLayout[] = ['center', 'tile'];
  const ANGLES: Angle[] = ['diagonal', 'flat'];
  const SIZES: Size[] = ['small', 'medium', 'large'];
  const STRENGTHS: Strength[] = ['light', 'medium', 'strong'];
  const TINTS: Tint[] = ['gray', 'red', 'blue'];
  /** 쪽의 짧은 변에 대한 글자 크기 */
  const SIZE_RATIO: Record<Size, number> = { small: 0.05, medium: 0.09, large: 0.15 };
  const OPACITY: Record<Strength, number> = { light: 0.15, medium: 0.3, strong: 0.5 };
  const COLORS: Record<Tint, [number, number, number]> = {
    gray: [0.4, 0.4, 0.4],
    red: [0.8, 0.12, 0.12],
    blue: [0.12, 0.3, 0.75],
  };
  const ANGLE_DEGREES: Record<Angle, number> = { diagonal: 45, flat: 0 };

  let pdf: LoadedPdf | undefined = $state.raw();
  let text = $state(t.defaultText);
  let layout: WatermarkLayout = $state('center');
  let angle: Angle = $state('diagonal');
  let size: Size = $state('medium');
  let strength: Strength = $state('medium');
  let tint: Tint = $state('gray');
  let weight: FontWeight = $state(700);
  let font: SelectedFont | undefined = $state.raw();

  /** 고른 굵기가 그 글꼴에 없으면 있는 굵기로 */
  const fontBytes = $derived(font ? (font.files[weight] ?? font.files[400]) : undefined);
  const hasBold = $derived(font?.files[700] !== undefined);
  const trimmed = $derived(text.trim());

  const options = $derived<WatermarkOptions | undefined>(
    fontBytes && trimmed
      ? {
          text: trimmed,
          font: fontBytes,
          size: SIZE_RATIO[size],
          angle: ANGLE_DEGREES[angle],
          opacity: OPACITY[strength],
          color: COLORS[tint],
          layout,
        }
      : undefined,
  );
  const signature = $derived(
    `${trimmed}:${font?.id}:${weight}:${layout}:${angle}:${size}:${strength}:${tint}`,
  );

  type Run =
    | { kind: 'idle' }
    | { kind: 'working' }
    | { kind: 'done'; name: string; bytes: Uint8Array; signature: string }
    | { kind: 'failed'; message: string; signature: string };
  let run = $state<Run>({ kind: 'idle' });
  const result = $derived(run.kind === 'done' && run.signature === signature ? run : undefined);
  const failure = $derived(
    run.kind === 'failed' && run.signature === signature ? run.message : undefined,
  );
  const blocker = $derived(!trimmed ? t.needText : !font ? t.needFont : undefined);

  function onload(loaded: LoadedPdf) {
    pdf = loaded;
    pageIndex = 0;
    run = { kind: 'idle' };
  }

  async function apply() {
    if (!pdf || !options || run.kind === 'working') return;
    const entitlement = await canUse('pdf/watermark');
    if (!entitlement.allowed) {
      run = {
        kind: 'failed',
        message: entitlement.reason ?? common.action.unavailable,
        signature,
      };
      return;
    }
    const source = pdf;
    const startedWith = signature;
    run = { kind: 'working' };
    try {
      const bytes = await addWatermark(source, options);
      if (pdf !== source) return;
      run = {
        kind: 'done',
        name: `${baseName(source.name)}_${t.suffix}.pdf`,
        bytes,
        signature: startedWith,
      };
    } catch (error) {
      if (pdf !== source) return;
      const message =
        error instanceof MissingGlyphsError ? t.missing(error.chars.join(' ')) : t.failed;
      run = { kind: 'failed', message, signature: startedWith };
    }
  }

  // 미리보기: 쪽 크기(pt)와 고른 글꼴을 화면 글꼴로 등록해 같은 자리 계산으로 그린다
  let pageIndex = $state(0);
  let view = $state({ width: 0, height: 0 });
  let pagePt = $state({ width: 0, height: 0 });
  let family = $state('');
  let familyId = 0;

  $effect(() => {
    const doc = pdf?.doc;
    if (!doc) return;
    doc.getPage(pageIndex + 1).then((page) => {
      const viewport = page.getViewport({ scale: 1 });
      pagePt = { width: viewport.width, height: viewport.height };
    });
  });

  $effect(() => {
    const bytes = fontBytes;
    if (!bytes) return;
    const name = `watermark-${familyId++}`;
    const face = new FontFace(name, bytes.slice());
    face.load().then(() => {
      document.fonts.add(face);
      family = name;
    });
    return () => document.fonts.delete(face);
  });

  /** 글자 폭(pt). 화면 글꼴로 잰다 (워커는 같은 글꼴의 폭으로 잰다) */
  const measure = (() => {
    const context = new OffscreenCanvas(1, 1).getContext('2d')!;
    return (value: string, fontSize: number, name: string) => {
      context.font = `${fontSize}px "${name}"`;
      return context.measureText(value).width;
    };
  })();

  const preview = $derived.by(() => {
    if (!family || !trimmed || pagePt.width === 0 || view.width === 0) return [];
    const fontSize = SIZE_RATIO[size] * Math.min(pagePt.width, pagePt.height);
    const width = measure(trimmed, fontSize, family);
    const scale = view.width / pagePt.width;
    return placements(pagePt, width, fontSize, layout, ANGLE_DEGREES[angle]).map((point) => ({
      left: (point.x / pagePt.width) * 100,
      top: (point.y / pagePt.height) * 100,
      size: fontSize * scale,
    }));
  });
  /** PDF에 넣을 색을 화면 색으로 (미리보기·색 견본이 결과와 같은 색이 되게) */
  function rgbCss(color: [number, number, number], alpha: number) {
    return `rgb(${color.map((value) => Math.round(value * 255)).join(' ')} / ${alpha})`;
  }
  const cssColor = $derived(rgbCss(COLORS[tint], OPACITY[strength]));
</script>

<SinglePdfTool {onload}>
  {#snippet children({ doc })}
    <ActionBar label={t.bar}>
      {#snippet text()}
        {#if run.kind === 'working'}
          {t.working}
        {:else if result}
          {common.action.done(result.name, formatSize(result.bytes.length))}
        {:else if failure}
          <strong>{failure}</strong>
        {:else}
          {blocker ?? t.ready(doc.numPages)}
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
          disabled={blocker !== undefined || run.kind === 'working'}
          onclick={apply}>{run.kind === 'working' ? t.working : t.run}</button
        >
      {/if}
    </ActionBar>

    <div class="tool-body">
      <label class="field">
        {t.text}
        <input
          type="text"
          maxlength="60"
          autocomplete="off"
          bind:value={text}
          aria-invalid={!trimmed}
        />
      </label>

      <div class="choices">
        <div class="choice" role="radiogroup" aria-label={t.layoutGroup}>
          {#each LAYOUTS as option (option)}
            <label class:checked={layout === option}>
              <input type="radio" name="layout" value={option} bind:group={layout} />
              {t.layouts[option]}
            </label>
          {/each}
        </div>
        <div class="choice" role="radiogroup" aria-label={t.angleGroup}>
          {#each ANGLES as option (option)}
            <label class:checked={angle === option}>
              <input type="radio" name="angle" value={option} bind:group={angle} />
              {t.angles[option]}
            </label>
          {/each}
        </div>
        <div class="choice" role="radiogroup" aria-label={t.sizeGroup}>
          {#each SIZES as option (option)}
            <label class:checked={size === option}>
              <input type="radio" name="size" value={option} bind:group={size} />
              {t.sizes[option]}
            </label>
          {/each}
        </div>
        <div class="choice" role="radiogroup" aria-label={t.strengthGroup}>
          {#each STRENGTHS as option (option)}
            <label class:checked={strength === option}>
              <input type="radio" name="strength" value={option} bind:group={strength} />
              {t.strengths[option]}
            </label>
          {/each}
        </div>
        <div class="choice" role="radiogroup" aria-label={t.tintGroup}>
          {#each TINTS as option (option)}
            <label class:checked={tint === option}>
              <input type="radio" name="tint" value={option} bind:group={tint} />
              <span class="swatch" style:background={rgbCss(COLORS[option], 1)}></span>
              {t.tints[option]}
            </label>
          {/each}
        </div>
        {#if hasBold}
          <div class="choice" role="radiogroup" aria-label={t.weightGroup}>
            {#each [400, 700] as const as option (option)}
              <label class:checked={weight === option}>
                <input type="radio" name="weight" value={option} bind:group={weight} />
                {t.weights[option]}
              </label>
            {/each}
          </div>
        {/if}
      </div>

      <div class="sheet">
        <PageSheet {doc} bind:pageIndex bind:view help={t.preview}>
          <div class="overlay" aria-hidden="true">
            {#each preview as mark, i (i)}
              <span
                class="mark"
                style:left="{mark.left}%"
                style:top="{mark.top}%"
                style:font-size="{mark.size}px"
                style:font-family={`"${family}"`}
                style:color={cssColor}
                style:transform="translate(-50%, -50%) rotate({-ANGLE_DEGREES[angle]}deg)"
                >{trimmed}</span
              >
            {/each}
          </div>
        </PageSheet>
      </div>

      <FontPicker bind:selected={font} />
    </div>
  {/snippet}
</SinglePdfTool>

<style>
  .field input {
    max-width: 360px;
  }
  .sheet {
    margin-bottom: 24px;
  }
  .overlay {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }
  .mark {
    position: absolute;
    line-height: 1;
    white-space: pre;
  }
  .swatch {
    display: inline-block;
    width: 10px;
    height: 10px;
    margin-right: 4px;
    border-radius: 50%;
    vertical-align: 0;
  }
</style>
