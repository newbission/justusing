<!--
  PDF 머리말·꼬리말 도구 화면 (격리 frame 안에서 실행).
  고른 한글 글꼴로 쪽마다 위·아래에 글자를 넣는다. {쪽}·{전체}·{날짜} 자리표시를 쪽마다 채운다.
  쪽 위에 실제 글꼴로 미리 보여 준다. 파일은 어디로도 전송되지 않는다.
-->
<script lang="ts">
  import '../../../frame/controls.css';
  import { frameLocale, pick } from '../../../frame/locale';
  import { FRAME_MESSAGES } from '../../../frame/messages';
  import { MESSAGES, type Size, type Tint } from './messages';
  import ActionBar from '../../../frame/ActionBar.svelte';
  import { downloadFile } from '../../../frame/download';
  import { baseName, formatSize } from '../../../frame/format';
  import { canUse } from '../../../lib/entitlement';
  import FontPicker, { type SelectedFont } from '../../../lib/fonts/FontPicker.svelte';
  import PageSheet from '../../../lib/pdf/PageSheet.svelte';
  import SinglePdfTool, { type LoadedPdf } from '../../../lib/pdf/SinglePdfTool.svelte';
  import {
    addHeaderFooter,
    fillTemplate,
    fitSize,
    linePosition,
    MissingGlyphsError,
    type Align,
    type HeaderFooterOptions,
  } from '../../../lib/pdf/header-footer';

  const common = pick(FRAME_MESSAGES);
  const t = pick(MESSAGES);

  const ALIGNS: Align[] = ['left', 'center', 'right'];
  const SIZES: Size[] = ['small', 'medium', 'large'];
  const TINTS: Tint[] = ['gray', 'black'];
  const SIZE_PT: Record<Size, number> = { small: 9, medium: 11, large: 14 };
  const COLORS: Record<Tint, [number, number, number]> = {
    gray: [0.35, 0.35, 0.35],
    black: [0, 0, 0],
  };
  /** 자리표시 이름은 화면 언어대로 보여 준다 (두 언어 모두 알아듣는다) */
  const TOKENS =
    frameLocale === 'ko' ? ['{쪽}', '{전체}', '{날짜}'] : ['{page}', '{total}', '{date}'];
  const formatToday = () => new Intl.DateTimeFormat(frameLocale).format(new Date());
  /** 탭을 오래 열어 두어도 실행한 날의 날짜가 들어가게, 실행할 때와 탭으로 돌아올 때 다시 계산한다 */
  let today = $state(formatToday());
  $effect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') today = formatToday();
    };
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  });

  let pdf: LoadedPdf | undefined = $state.raw();
  let header = $state('');
  let headerAlign: Align = $state('left');
  let footer = $state(`${TOKENS[0]} / ${TOKENS[1]}`);
  let footerAlign: Align = $state('center');
  let size: Size = $state('medium');
  let tint: Tint = $state('gray');
  let skipFirst = $state(false);
  let font: SelectedFont | undefined = $state.raw();

  const hasText = $derived(header.trim() !== '' || footer.trim() !== '');
  const blocker = $derived(!hasText ? t.needText : !font ? t.needFont : undefined);
  /** 글꼴 바이트만 따로 둔다. 글자를 칠 때마다 미리보기 글꼴을 다시 불러오지 않게 */
  const fontBytes = $derived(font ? (font.files[400] ?? Object.values(font.files)[0]) : undefined);
  const options = $derived<HeaderFooterOptions | undefined>(
    fontBytes && hasText
      ? {
          header: { text: header.trim(), align: headerAlign },
          footer: { text: footer.trim(), align: footerAlign },
          font: fontBytes,
          size: SIZE_PT[size],
          color: COLORS[tint],
          skipFirst,
          date: today,
        }
      : undefined,
  );
  const signature = $derived(
    [header, headerAlign, footer, footerAlign, size, tint, skipFirst, font?.id, today].join(
      '\u0000',
    ),
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

  function onload(loaded: LoadedPdf) {
    pdf = loaded;
    pageIndex = 0;
    run = { kind: 'idle' };
  }

  async function apply() {
    today = formatToday();
    if (!pdf || !options || run.kind === 'working') return;
    const entitlement = await canUse('pdf/header-footer');
    if (!entitlement.allowed) {
      run = { kind: 'failed', message: entitlement.reason ?? common.action.unavailable, signature };
      return;
    }
    const source = pdf;
    const startedWith = signature;
    run = { kind: 'working' };
    try {
      const bytes = await addHeaderFooter(source, options);
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

  // 미리보기: 지금 쪽의 크기(pt)와 고른 글꼴로, 워커와 같은 자리 계산을 써서 그린다
  let pageIndex = $state(0);
  let view = $state({ width: 0, height: 0 });
  let pagePt = $state({ width: 0, height: 0 });
  let family = $state('');
  let familyId = 0;

  $effect(() => {
    const doc = pdf?.doc;
    if (!doc) return;
    // 쪽을 빠르게 넘기면 이전 쪽 크기가 늦게 올 수 있어 지금 쪽의 것만 쓴다
    let current = true;
    doc.getPage(pageIndex + 1).then((page) => {
      if (!current) return;
      const viewport = page.getViewport({ scale: 1 });
      pagePt = { width: viewport.width, height: viewport.height };
    });
    return () => {
      current = false;
    };
  });

  $effect(() => {
    const bytes = fontBytes;
    if (!bytes) return;
    const name = `header-${familyId++}`;
    const face = new FontFace(name, bytes.slice());
    // 그새 다른 글꼴로 바꿨으면 늦게 끝난 이전 글꼴은 쓰지 않는다 (미리보기와 결과 글꼴이 달라지지 않게)
    let current = true;
    face.load().then(() => {
      if (!current) return;
      document.fonts.add(face);
      family = name;
    });
    return () => {
      current = false;
      document.fonts.delete(face);
    };
  });

  const measure = (() => {
    const context = new OffscreenCanvas(1, 1).getContext('2d')!;
    return (value: string, fontSize: number, name: string) => {
      context.font = `${fontSize}px "${name}"`;
      return context.measureText(value).width;
    };
  })();

  const preview = $derived.by(() => {
    if (!family || !pdf || pagePt.width === 0 || view.width === 0) return [];
    if (skipFirst && pageIndex === 0) return [];
    const fontSize = SIZE_PT[size];
    const scale = view.width / pagePt.width;
    const total = pdf.doc.numPages;
    return (
      [
        [header, headerAlign, 'top'],
        [footer, footerAlign, 'bottom'],
      ] as const
    ).flatMap(([template, align, edge]) => {
      const text = fillTemplate(template.trim(), pageIndex + 1, total, today).trim();
      if (!text) return [];
      // 쪽 폭보다 길면 워커와 같이 줄여서 그린다
      const lineSize = fitSize(measure(text, fontSize, family), fontSize, pagePt);
      const at = linePosition(pagePt, measure(text, lineSize, family), lineSize, align, edge);
      return [
        {
          text,
          left: (at.x / pagePt.width) * 100,
          // 바닥선에서 글자 높이만큼 위가 글자 칸의 위쪽 (line-height 1 기준)
          top: ((at.y - lineSize * 0.88) / pagePt.height) * 100,
          size: lineSize * scale,
        },
      ];
    });
  });
  const cssColor = $derived(
    `rgb(${COLORS[tint].map((value) => Math.round(value * 255)).join(' ')})`,
  );
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
      {#each [{ label: t.header, placeholder: t.headerPlaceholder, key: 'header' }, { label: t.footer, placeholder: t.footerPlaceholder, key: 'footer' }] as const as line (line.key)}
        <div class="line">
          <label class="field">
            {line.label}
            {#if line.key === 'header'}
              <input
                type="text"
                maxlength="120"
                autocomplete="off"
                placeholder={line.placeholder}
                bind:value={header}
              />
            {:else}
              <input
                type="text"
                maxlength="120"
                autocomplete="off"
                placeholder={line.placeholder}
                bind:value={footer}
              />
            {/if}
          </label>
          <div class="choice" role="radiogroup" aria-label={t.alignGroup(line.label)}>
            {#each ALIGNS as option (option)}
              {#if line.key === 'header'}
                <label class:checked={headerAlign === option}>
                  <input type="radio" name="header-align" value={option} bind:group={headerAlign} />
                  {t.aligns[option]}
                </label>
              {:else}
                <label class:checked={footerAlign === option}>
                  <input type="radio" name="footer-align" value={option} bind:group={footerAlign} />
                  {t.aligns[option]}
                </label>
              {/if}
            {/each}
          </div>
        </div>
      {/each}
      <p class="help">{t.tokens}</p>

      <div class="choices">
        <div class="choice" role="radiogroup" aria-label={t.sizeGroup}>
          {#each SIZES as option (option)}
            <label class:checked={size === option}>
              <input type="radio" name="size" value={option} bind:group={size} />
              {t.sizes[option]}
            </label>
          {/each}
        </div>
        <div class="choice" role="radiogroup" aria-label={t.tintGroup}>
          {#each TINTS as option (option)}
            <label class:checked={tint === option}>
              <input type="radio" name="tint" value={option} bind:group={tint} />
              {t.tints[option]}
            </label>
          {/each}
        </div>
        <label class="check">
          <input type="checkbox" bind:checked={skipFirst} />
          {t.skipFirst}
        </label>
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
                style:color={cssColor}>{mark.text}</span
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
  .line {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 8px 12px;
    margin-bottom: 12px;
  }
  .line .field {
    flex: 1 1 260px;
    margin-bottom: 0;
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
</style>
