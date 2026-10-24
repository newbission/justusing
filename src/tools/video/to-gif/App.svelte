<!--
  동영상을 GIF로 도구 화면 (격리 frame 안에서 실행).
  동영상 하나를 브라우저 <video>로 열고, 고른 구간의 장면을 숨은 <video>로 하나씩 뽑아 워커가 GIF·움직이는 WebP로 묶는다.
  동영상은 어디로도 전송되지 않는다 (src/lib/video-frames/).
-->
<script lang="ts">
  import '../../../frame/controls.css';
  import { onMount, untrack } from 'svelte';
  import { pick } from '../../../frame/locale';
  import { MESSAGES } from './messages';
  import ActionBar from '../../../frame/ActionBar.svelte';
  import FileDrop from '../../../frame/FileDrop.svelte';
  import { downloadFile } from '../../../frame/download';
  import { onFrameFiles } from '../../../frame/drop';
  import { baseName, formatSize } from '../../../frame/format';
  import { requestShowTool } from '../../../frame/parent';
  import { canUse } from '../../../lib/entitlement';
  import {
    AnimationError,
    canEncodeWebp,
    estimateSize,
    makeAnimation,
    type AnimationFailure,
    type AnimationFormat,
    type AnimationSettings,
  } from '../../../lib/video-frames/animation';
  import { frameTimes, scaledHeight } from '../../../lib/video-frames/times';
  import { FrameReader, openVideo, type OpenedVideo } from '../../../lib/video-frames/video';

  const t = pick(MESSAGES);

  /** 구간의 가장 긴 길이 (초). GIF는 길수록 커져 이보다 길면 쓰기 어렵다 */
  const MAX_CLIP = 30;
  /** 처음 열 때 고르는 구간 길이 */
  const DEFAULT_CLIP = 5;
  const WIDTHS = [240, 320, 480, 640];
  const COLORS = [256, 128, 64, 32];
  const QUALITIES = { high: 0.9, medium: 0.75, low: 0.5 } as const;
  type Quality = keyof typeof QUALITIES;
  /** 이보다 크면 메신저·게시판에 올라가지 않을 수 있다고 알린다 */
  const BIG = 10 * 1024 * 1024;
  const FORMATS: AnimationFormat[] = ['gif', 'webp'];
  const webpSupported = canEncodeWebp();

  type Phase = 'idle' | 'opening' | 'error' | 'ready';
  let phase = $state<Phase>('idle');
  let video = $state.raw<OpenedVideo & { name: string }>();
  let reader: FrameReader | undefined;
  /** 새 동영상을 열거나 닫을 때마다 늘어난다. 늦게 끝난 예전 작업이 지금 화면을 덮어쓰지 않게 한다 */
  let generation = 0;

  let start = $state(0);
  let end = $state(DEFAULT_CLIP);
  let format = $state<AnimationFormat>('gif');
  let width = $state(480);
  let fps = $state(10);
  let colors = $state(128);
  let dither = $state(true);
  let quality = $state<Quality>('medium');
  let loop = $state(true);

  let player: HTMLVideoElement | undefined = $state();
  /** 구간 재생 중이면 끝 시각 (지나면 멈춘다) */
  let playUntil: number | undefined;

  type Make =
    | { kind: 'idle' }
    | { kind: 'making'; done: number; total: number }
    | {
        kind: 'made';
        bytes: Uint8Array;
        url: string;
        format: AnimationFormat;
        frames: number;
        saved: boolean;
      }
    | { kind: 'failed'; reason: AnimationFailure };
  let make = $state.raw<Make>({ kind: 'idle' });
  let making: AbortController | undefined;

  let estimate = $state<number | undefined>();
  /** 지금 하고 있는 용량 어림 (만들기를 누르면 그만두게 해 장면 찾기가 겹치지 않게) */
  let estimating: AbortController | undefined;

  /** 고를 수 있는 폭: 원본보다 큰 폭은 빼고, 원본이 640px보다 작으면 원본 폭을 더한다 */
  const widths = $derived.by(() => {
    if (!video) return WIDTHS;
    const fit = WIDTHS.filter((option) => option <= video!.width);
    if (video.width < WIDTHS.at(-1)! && !fit.includes(video.width)) fit.push(video.width);
    return fit;
  });

  const settings = $derived<AnimationSettings | undefined>(
    video
      ? {
          format,
          start,
          end,
          fps,
          width,
          height: scaledHeight(width, video),
          colors,
          dither,
          quality: QUALITIES[quality],
          loop,
        }
      : undefined,
  );
  const frameCount = $derived(settings ? frameTimes(settings.start, settings.end, fps).length : 0);

  onMount(() => {
    const off = onFrameFiles(([file]) => {
      if (file) open(file);
    });
    return () => {
      off();
      close();
    };
  });

  async function open(file: File) {
    const ticket = ++generation;
    close(false);
    phase = 'opening';
    try {
      const opened = await openVideo(file);
      if (ticket !== generation) {
        opened.close();
        return;
      }
      video = { ...opened, name: file.name };
      reader = new FrameReader(opened.url);
      start = 0;
      end = Math.min(Math.floor(opened.duration * 10) / 10, DEFAULT_CLIP);
      width = widths.includes(480) ? 480 : widths.at(-1)!;
      phase = 'ready';
      requestShowTool();
    } catch {
      if (ticket === generation) phase = 'error';
    }
  }

  function close(reset = true) {
    if (reset) generation++;
    making?.abort();
    clearResult();
    reader?.close();
    reader = undefined;
    video?.close();
    video = undefined;
    estimate = undefined;
    phase = 'idle';
  }

  function round(value: number) {
    return Math.round(value * 10) / 10;
  }

  function clearResult() {
    if (make.kind === 'made') URL.revokeObjectURL(make.url);
    if (make.kind !== 'making') make = { kind: 'idle' };
  }

  /** 시작·끝을 동영상 안으로, 끝은 시작 뒤 MAX_CLIP초 안으로 맞춘다 */
  function setRange(nextStart: number, nextEnd: number, moved: 'start' | 'end') {
    if (!video || !Number.isFinite(nextStart) || !Number.isFinite(nextEnd)) return;
    const duration = video.duration;
    let s = Math.min(Math.max(0, nextStart), duration);
    let e = Math.min(Math.max(0, nextEnd), duration);
    const gap = Math.min(0.1, duration);
    if (moved === 'start') {
      if (e - s < gap) e = Math.min(duration, s + gap);
      if (e - s < gap) s = Math.max(0, e - gap);
      if (e - s > MAX_CLIP) e = s + MAX_CLIP;
    } else {
      if (e - s < gap) s = Math.max(0, e - gap);
      if (e - s < gap) e = Math.min(duration, s + gap);
      if (e - s > MAX_CLIP) s = e - MAX_CLIP;
    }
    start = round(s);
    end = round(e);
    if (end > duration) end = Math.floor(duration * 10) / 10;
  }

  function playRange() {
    if (!player) return;
    player.currentTime = start;
    playUntil = end;
    void player.play();
  }

  function onTimeUpdate() {
    if (!player || playUntil === undefined) return;
    if (player.currentTime >= playUntil) {
      player.pause();
      playUntil = undefined;
    }
  }

  // 설정이 바뀌면 지난 결과를 지우고, 잠깐 기다렸다가 용량을 다시 어림한다
  $effect(() => {
    const wanted = settings;
    if (!wanted || !reader) return;
    untrack(clearResult);
    estimate = undefined;
    const controller = new AbortController();
    estimating = controller;
    const ticket = generation;
    const timer = setTimeout(async () => {
      try {
        const bytes = await estimateSize(reader!, wanted, controller.signal);
        if (!controller.signal.aborted && ticket === generation) estimate = bytes;
      } catch {
        // 어림은 실패해도 만들기는 할 수 있다 (만들 때 오류를 알린다)
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  });

  async function run() {
    if (!video || !reader || !settings || make.kind === 'making') return;
    const entitlement = await canUse('video/to-gif');
    if (!entitlement.allowed) return;
    const ticket = generation;
    const wanted = settings;
    estimating?.abort();
    const controller = new AbortController();
    making = controller;
    make = { kind: 'making', done: 0, total: frameCount };
    try {
      const bytes = await makeAnimation(
        reader,
        wanted,
        (done, total) => {
          if (ticket === generation && !controller.signal.aborted) {
            make = { kind: 'making', done, total };
          }
        },
        controller.signal,
      );
      if (ticket !== generation || controller.signal.aborted) return;
      const type = wanted.format === 'gif' ? 'image/gif' : 'image/webp';
      const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type }));
      make = { kind: 'made', bytes, url, format: wanted.format, frames: frameCount, saved: false };
    } catch (error) {
      if (ticket !== generation) return;
      if (controller.signal.aborted) make = { kind: 'idle' };
      else
        make = {
          kind: 'failed',
          reason: error instanceof AnimationError ? error.reason : 'encode',
        };
    } finally {
      if (making === controller) making = undefined;
    }
  }

  function stop() {
    making?.abort();
    make = { kind: 'idle' };
  }

  function download() {
    if (!video || make.kind !== 'made') return;
    const type = make.format === 'gif' ? 'image/gif' : 'image/webp';
    downloadFile(make.bytes, `${baseName(video.name)}.${make.format}`, type);
    make = { ...make, saved: true };
  }
</script>

<div class="tool">
  {#if phase === 'ready' && video && settings}
    <div class="filebar">
      <span class="name" title={video.name}>{video.name}</span>
      <span class="meta">{video.width}×{video.height} · {round(video.duration)}s</span>
      <button type="button" class="btn" onclick={() => close()}>{t.otherFile}</button>
    </div>

    <ActionBar label={t.bar}>
      {#snippet text()}
        {#if make.kind === 'failed'}
          <strong>{t.failed[make.reason]}</strong>
        {:else if make.kind === 'making'}
          {t.making(make.done, make.total)}
        {:else if make.kind === 'made'}
          {make.saved
            ? t.saved(t.short[make.format], formatSize(make.bytes.length))
            : t.made(
                t.short[make.format],
                formatSize(make.bytes.length),
                settings.width,
                settings.height,
                make.frames,
              )}
        {:else if estimate === undefined}
          {t.estimating}
        {:else}
          {t.ready(settings.width, settings.height, frameCount, formatSize(estimate))}
        {/if}
      {/snippet}
      {#if make.kind === 'making'}
        <button type="button" class="btn primary" onclick={stop}>{t.stop}</button>
      {:else if make.kind === 'made'}
        <button type="button" class="btn primary" onclick={download}
          >{t.download(t.short[make.format])}</button
        >
      {:else}
        <button type="button" class="btn primary" onclick={run}>{t.make(t.short[format])}</button>
      {/if}
    </ActionBar>

    <div class="tool-body">
      <div class="layout">
        <div class="stage">
          <!-- svelte-ignore a11y_media_has_caption -->
          <video
            bind:this={player}
            src={video.url}
            controls
            muted
            playsinline
            preload="auto"
            aria-label={t.player}
            ontimeupdate={onTimeUpdate}
          ></video>

          <fieldset aria-labelledby="range-title" disabled={make.kind === 'making'}>
            <h2 id="range-title">{t.rangeTitle}</h2>
            <div class="fields">
              <label class="field">
                {t.start}
                <input
                  type="number"
                  min="0"
                  max={video.duration}
                  step="0.1"
                  inputmode="decimal"
                  value={start}
                  onchange={(event) => {
                    setRange(event.currentTarget.valueAsNumber, end, 'start');
                    event.currentTarget.value = String(start);
                  }}
                />
              </label>
              <label class="field">
                {t.end}
                <input
                  type="number"
                  min="0"
                  max={video.duration}
                  step="0.1"
                  inputmode="decimal"
                  value={end}
                  onchange={(event) => {
                    setRange(start, event.currentTarget.valueAsNumber, 'end');
                    event.currentTarget.value = String(end);
                  }}
                />
              </label>
            </div>
            <div class="row">
              <button
                type="button"
                class="btn"
                onclick={() => player && setRange(player.currentTime, end, 'start')}
                >{t.setStart}</button
              >
              <button
                type="button"
                class="btn"
                onclick={() => player && setRange(start, player.currentTime, 'end')}
                >{t.setEnd}</button
              >
              <button type="button" class="btn" onclick={playRange}>{t.playRange}</button>
            </div>
            <p class="help">
              {t.rangeInfo(round(end - start).toFixed(1), MAX_CLIP)} · {t.rangeHelp}
            </p>
          </fieldset>

          {#if make.kind === 'made'}
            <section class="result" aria-labelledby="result-title">
              <h2 id="result-title">{t.resultTitle}</h2>
              <img
                src={make.url}
                alt={t.resultAlt}
                width={settings.width}
                height={settings.height}
              />
            </section>
          {/if}
        </div>

        <!-- 만드는 동안에는 설정을 바꾸지 못하게 한다 (결과가 화면의 설정과 어긋나지 않게) -->
        <fieldset class="panel" disabled={make.kind === 'making'}>
          <section aria-labelledby="format-title">
            <h2 id="format-title">{t.formatTitle}</h2>
            <div class="choice" role="radiogroup" aria-label={t.formatGroup}>
              {#each FORMATS as option (option)}
                <label
                  class:checked={format === option}
                  class:disabled={option === 'webp' && !webpSupported}
                >
                  <input
                    type="radio"
                    name="format"
                    value={option}
                    bind:group={format}
                    disabled={option === 'webp' && !webpSupported}
                  />
                  {t.formats[option]}
                </label>
              {/each}
            </div>
            <p class="help">
              {webpSupported ? t.formatHelp[format] : `${t.formatHelp.gif} ${t.noWebp}`}
            </p>
          </section>

          <section aria-labelledby="width-title">
            <h2 id="width-title">{t.widthTitle}</h2>
            <div class="chips" role="radiogroup" aria-label={t.widthGroup}>
              {#each widths as option (option)}
                <label class:checked={width === option}>
                  <input type="radio" name="width" value={option} bind:group={width} />
                  {t.widthOption(option)}
                </label>
              {/each}
            </div>
            <p class="help">{t.widthHelp(settings.width, settings.height)}</p>
          </section>

          <section aria-labelledby="fps-title">
            <h2 id="fps-title">{t.fpsTitle}</h2>
            <div class="row slider">
              <input
                id="fps"
                type="range"
                min="5"
                max="20"
                step="1"
                bind:value={fps}
                aria-label={t.fps}
                aria-valuetext={t.fpsValue(fps)}
              />
              <span class="value">{t.fpsValue(fps)}</span>
            </div>
            <p class="help">{t.fpsHelp}</p>
          </section>

          <section aria-labelledby="quality-title">
            <h2 id="quality-title">{t.qualityTitle}</h2>
            {#if format === 'gif'}
              <div class="chips" role="radiogroup" aria-label={t.colorsGroup}>
                {#each COLORS as option (option)}
                  <label class:checked={colors === option}>
                    <input type="radio" name="colors" value={option} bind:group={colors} />
                    {t.colorsOption(option)}
                  </label>
                {/each}
              </div>
              <label class="check">
                <input type="checkbox" bind:checked={dither} />
                {t.dither}
              </label>
              <p class="help">{t.colorsHelp}</p>
            {:else}
              <div class="choice" role="radiogroup" aria-label={t.qualityGroup}>
                {#each Object.keys(QUALITIES) as Quality[] as option (option)}
                  <label class:checked={quality === option}>
                    <input type="radio" name="quality" value={option} bind:group={quality} />
                    {t.qualities[option]}
                  </label>
                {/each}
              </div>
            {/if}
          </section>

          <section aria-labelledby="loop-title">
            <h2 id="loop-title">{t.loopTitle}</h2>
            <div class="choice" role="radiogroup" aria-label={t.loopGroup}>
              {#each [true, false] as option (option)}
                <label class:checked={loop === option}>
                  <input type="radio" name="loop" value={option} bind:group={loop} />
                  {option ? t.loops.forever : t.loops.once}
                </label>
              {/each}
            </div>
          </section>

          {#if estimate !== undefined && estimate > BIG}
            <p class="problem" role="status">{t.big}</p>
          {/if}
        </fieldset>
      </div>
    </div>
  {:else if phase === 'opening'}
    <p class="status" role="status">{t.opening}</p>
  {:else}
    {#if phase === 'error'}
      <p class="banner" role="alert">{t.cannotOpen}</p>
    {/if}
    <div class="drop">
      <FileDrop
        accept="video/*,.mp4,.m4v,.mov,.webm,.mkv"
        label={t.choose}
        hint={t.hint}
        onfiles={([file]) => file && open(file)}
      />
    </div>
  {/if}
</div>

<style>
  .tool {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--color-surface);
  }
  .filebar {
    display: flex;
    flex: none;
    align-items: center;
    gap: 12px;
    height: 48px;
    padding: 0 16px;
    border-bottom: 1px solid var(--color-line);
    font-size: 14px;
  }
  .filebar .name {
    overflow: hidden;
    font-weight: 600;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .filebar .meta {
    flex: 1;
    color: var(--color-muted);
    white-space: nowrap;
  }
  .status,
  .banner {
    margin: 0;
    padding: 16px;
    font-size: 14px;
  }
  .banner {
    border-bottom: 1px solid var(--color-line);
    font-weight: 600;
  }
  .drop {
    padding: 16px;
  }
  .layout {
    display: flex;
    flex-wrap: wrap;
    gap: 24px;
  }
  .stage {
    flex: 3 1 320px;
    min-width: 0;
  }
  .panel {
    flex: 2 1 280px;
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }
  video {
    display: block;
    width: 100%;
    max-height: 360px;
    margin-bottom: 16px;
    border-radius: var(--radius);
    background: var(--color-text);
  }
  section,
  .stage fieldset {
    margin: 0 0 16px;
    padding: 16px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius);
  }
  h2 {
    margin: 0 0 12px;
    font-size: 15px;
  }
  section .help {
    margin: 8px 0 0;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 12px;
  }
  .fields .field {
    margin-bottom: 12px;
  }
  /* 고를 것이 많은 묶음: 칸마다 떨어진 단추 (좁은 화면에서 줄이 바뀌어도 테두리가 깨지지 않게) */
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chips label {
    padding: 6px 10px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius);
    font-size: 14px;
    white-space: nowrap;
    cursor: pointer;
  }
  .chips label:hover {
    background: var(--color-hover);
  }
  .chips label.checked {
    border-color: var(--color-text);
    background: var(--color-text);
    color: var(--color-bg);
    font-weight: 600;
  }
  .chips label:has(input:focus-visible) {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
  .chips input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .choice label.disabled {
    opacity: 0.4;
    cursor: default;
  }
  .slider input {
    flex: 1;
    min-width: 120px;
    accent-color: var(--color-accent);
  }
  .slider .value {
    min-width: 56px;
    font-size: 14px;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
  .check {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    font-size: 14px;
    cursor: pointer;
  }
  .check input {
    accent-color: var(--color-accent);
  }
  .result img {
    display: block;
    max-width: 100%;
    height: auto;
    margin: 0 auto;
    /* 체크무늬: 투명한 곳이 보이게 */
    background: repeating-conic-gradient(var(--color-hover) 0 25%, transparent 0 50%) 0 0 / 16px
      16px;
  }
</style>
