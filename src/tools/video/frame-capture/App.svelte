<!--
  동영상 장면 캡처 도구 화면 (격리 frame 안에서 실행).
  지금 보이는 장면 한 장, 또는 구간에서 일정 간격의 장면들을 원래 크기 그대로 JPG·PNG로 저장한다.
  장면 그리기는 브라우저 <video>·canvas, 저장은 워커가 한다. 동영상은 어디로도 전송되지 않는다.
-->
<script lang="ts">
  import '../../../frame/controls.css';
  import { onMount } from 'svelte';
  import { pick } from '../../../frame/locale';
  import { MESSAGES, type Mode } from './messages';
  import ActionBar from '../../../frame/ActionBar.svelte';
  import FileDrop from '../../../frame/FileDrop.svelte';
  import { downloadFile } from '../../../frame/download';
  import { onFrameFiles } from '../../../frame/drop';
  import { baseName, formatSize } from '../../../frame/format';
  import { requestShowTool } from '../../../frame/parent';
  import { canUse } from '../../../lib/entitlement';
  import { makeZip } from '../../../lib/zip';
  import { saveStill, type StillType } from '../../../lib/video-frames/still';
  import { formatTime, intervalTimes, timeLabel } from '../../../lib/video-frames/times';
  import {
    FrameReader,
    captureBitmap,
    openVideo,
    seekVideo,
    type OpenedVideo,
  } from '../../../lib/video-frames/video';

  const t = pick(MESSAGES);

  /** 한 번에 뽑는 가장 많은 장 수 (모두 메모리에 모아 ZIP으로 묶는다) */
  const MAX_FRAMES = 200;
  const INTERVALS = [0.5, 1, 2, 5, 10];
  const FORMATS: StillType[] = ['image/jpeg', 'image/png'];
  const MODES: Mode[] = ['one', 'many'];
  const EXTENSIONS: Record<StillType, string> = { 'image/jpeg': 'jpg', 'image/png': 'png' };
  /** 1/30초씩 옮기기 (대부분의 동영상이 초당 24~30장) */
  const STEP = 1 / 30;
  /** 워커에 먼저 맡겨 두는 장면 수 (장면 찾기와 저장이 겹치게, 메모리는 이만큼만) */
  const IN_FLIGHT = 3;

  type Phase = 'idle' | 'opening' | 'error' | 'ready';
  let phase = $state<Phase>('idle');
  let video = $state.raw<OpenedVideo & { name: string }>();
  let reader: FrameReader | undefined;
  let generation = 0;

  let player: HTMLVideoElement | undefined = $state();
  /** 화면 <video>의 지금 위치 (초) */
  let position = $state(0);

  let mode = $state<Mode>('one');
  let interval = $state(1);
  let start = $state(0);
  let end = $state(0);
  let format = $state<StillType>('image/jpeg');

  type Save =
    | { kind: 'idle' }
    | { kind: 'saving' }
    | { kind: 'making'; done: number; total: number }
    | { kind: 'savedOne'; time: number; size: number }
    | { kind: 'savedMany'; count: number; size: number }
    | { kind: 'failed' };
  let save = $state.raw<Save>({ kind: 'idle' });
  let making: AbortController | undefined;

  const times = $derived(mode === 'many' ? intervalTimes(start, end, interval) : []);
  const busy = $derived(save.kind === 'saving' || save.kind === 'making');

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
      position = 0;
      start = 0;
      end = Math.floor(opened.duration * 10) / 10;
      phase = 'ready';
      requestShowTool();
    } catch {
      if (ticket === generation) phase = 'error';
    }
  }

  function close(reset = true) {
    if (reset) generation++;
    making?.abort();
    reader?.close();
    reader = undefined;
    video?.close();
    video = undefined;
    save = { kind: 'idle' };
    phase = 'idle';
  }

  function round(value: number) {
    return Math.round(value * 10) / 10;
  }

  function edited() {
    if (!busy) save = { kind: 'idle' };
  }

  function seekTo(time: number) {
    if (!player || !video || !Number.isFinite(time)) return;
    player.pause();
    player.currentTime = Math.min(Math.max(0, time), video.duration);
    edited();
  }

  function setRange(nextStart: number, nextEnd: number) {
    if (!video || !Number.isFinite(nextStart) || !Number.isFinite(nextEnd)) return;
    const duration = Math.floor(video.duration * 10) / 10;
    let s = round(Math.min(Math.max(0, nextStart), duration));
    let e = round(Math.min(Math.max(0, nextEnd), duration));
    if (e < s) [s, e] = [e, s];
    start = s;
    end = e;
    edited();
  }

  function fileName(time: number): string {
    return `${baseName(video!.name)}_${timeLabel(time)}.${EXTENSIONS[format]}`;
  }

  async function saveOne() {
    if (!player || !video) return;
    const ticket = generation;
    save = { kind: 'saving' };
    try {
      player.pause();
      // 막대를 끄는 중이면 그 장면이 나올 때까지 기다린다
      if (player.seeking) await seekVideo(player, player.currentTime);
      const time = player.currentTime;
      const wanted = format;
      const bytes = await saveStill(await captureBitmap(player), wanted);
      if (ticket !== generation) return;
      downloadFile(bytes, fileName(time), wanted);
      save = { kind: 'savedOne', time, size: bytes.length };
    } catch {
      if (ticket === generation) save = { kind: 'failed' };
    }
  }

  async function saveMany() {
    if (!reader || !video || times.length === 0 || times.length > MAX_FRAMES) return;
    const ticket = generation;
    const controller = new AbortController();
    making = controller;
    const wanted = { times, format, names: times.map(fileName), base: baseName(video.name) };
    save = { kind: 'making', done: 0, total: wanted.times.length };
    try {
      const files: { name: string; bytes: Uint8Array }[] = [];
      const pending: Promise<Uint8Array>[] = [];
      const settle = async () => {
        const bytes = await pending.shift()!;
        files.push({ name: wanted.names[files.length]!, bytes });
        if (ticket === generation && !controller.signal.aborted) {
          save = { kind: 'making', done: files.length, total: wanted.times.length };
        }
      };
      for (const time of wanted.times) {
        if (controller.signal.aborted || ticket !== generation) return;
        const bitmap = await reader.bitmap(time);
        pending.push(saveStill(bitmap, wanted.format));
        if (pending.length >= IN_FLIGHT) await settle();
      }
      while (pending.length > 0) await settle();
      if (controller.signal.aborted || ticket !== generation) return;
      const zip = await makeZip(files);
      if (ticket !== generation) return;
      downloadFile(zip, `${wanted.base}_${t.suffix}.zip`, 'application/zip');
      save = { kind: 'savedMany', count: files.length, size: zip.length };
    } catch {
      if (ticket === generation && !controller.signal.aborted) save = { kind: 'failed' };
    } finally {
      if (making === controller) making = undefined;
    }
  }

  async function run() {
    if (busy) return;
    const entitlement = await canUse('video/frame-capture');
    if (!entitlement.allowed) return;
    if (mode === 'one') await saveOne();
    else await saveMany();
  }

  function stop() {
    making?.abort();
    save = { kind: 'idle' };
  }
</script>

<div class="tool">
  {#if phase === 'ready' && video}
    <div class="filebar">
      <span class="name" title={video.name}>{video.name}</span>
      <span class="meta">{video.width}×{video.height} · {formatTime(video.duration)}</span>
      <button type="button" class="btn" onclick={() => close()}>{t.otherFile}</button>
    </div>

    <ActionBar label={t.bar}>
      {#snippet text()}
        {#if save.kind === 'failed'}
          <strong>{t.failed}</strong>
        {:else if save.kind === 'saving'}
          {t.saving}
        {:else if save.kind === 'making'}
          {t.making(save.done, save.total)}
        {:else if save.kind === 'savedOne'}
          {t.savedOne(formatTime(save.time), formatSize(save.size))}
        {:else if save.kind === 'savedMany'}
          {t.savedMany(save.count, formatSize(save.size))}
        {:else if mode === 'one'}
          {t.readyOne(formatTime(position), t.formats[format])}
        {:else}
          {t.readyMany(times.length, t.formats[format])}
        {/if}
      {/snippet}
      {#if save.kind === 'making'}
        <button type="button" class="btn primary" onclick={stop}>{t.stop}</button>
      {:else}
        <button
          type="button"
          class="btn primary"
          disabled={busy || (mode === 'many' && (times.length === 0 || times.length > MAX_FRAMES))}
          onclick={run}>{mode === 'one' ? t.downloadOne : t.downloadMany}</button
        >
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
            playsinline
            preload="auto"
            aria-label={t.player}
            aria-describedby="player-help"
            ontimeupdate={() => (position = player?.currentTime ?? 0)}
            onseeked={() => {
              position = player?.currentTime ?? 0;
              edited();
            }}
          ></video>
          <div class="row">
            <button type="button" class="btn" onclick={() => seekTo(position - STEP)}
              >{t.back}</button
            >
            <button type="button" class="btn" onclick={() => seekTo(position + STEP)}
              >{t.forward}</button
            >
            <label class="field inline">
              {t.position}
              <input
                type="number"
                min="0"
                max={video.duration}
                step="0.01"
                inputmode="decimal"
                value={Math.round(position * 100) / 100}
                onchange={(event) => seekTo(event.currentTarget.valueAsNumber)}
              />
            </label>
          </div>
          <p class="help" id="player-help">{t.playerHelp}</p>
        </div>

        <fieldset class="panel" disabled={busy}>
          <section aria-labelledby="mode-title">
            <h2 id="mode-title">{t.modeTitle}</h2>
            <div class="choice" role="radiogroup" aria-label={t.modeGroup}>
              {#each MODES as option (option)}
                <label class:checked={mode === option}>
                  <input
                    type="radio"
                    name="mode"
                    value={option}
                    bind:group={mode}
                    onchange={edited}
                  />
                  {t.modes[option]}
                </label>
              {/each}
            </div>

            {#if mode === 'many'}
              <div class="chips intervals" role="radiogroup" aria-label={t.intervalGroup}>
                {#each INTERVALS as option (option)}
                  <label class:checked={interval === option}>
                    <input
                      type="radio"
                      name="interval"
                      value={option}
                      bind:group={interval}
                      onchange={edited}
                    />
                    {t.interval(option)}
                  </label>
                {/each}
              </div>
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
                      setRange(event.currentTarget.valueAsNumber, end);
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
                      setRange(start, event.currentTarget.valueAsNumber);
                      event.currentTarget.value = String(end);
                    }}
                  />
                </label>
              </div>
              <div class="row">
                <button type="button" class="btn" onclick={() => setRange(position, end)}
                  >{t.setStart}</button
                >
                <button type="button" class="btn" onclick={() => setRange(start, position)}
                  >{t.setEnd}</button
                >
              </div>
              {#if times.length > MAX_FRAMES}
                <p class="problem" role="status">{t.tooMany(MAX_FRAMES)}</p>
              {:else}
                <p class="help">{t.count(times.length, MAX_FRAMES)} · {t.manyHelp}</p>
              {/if}
            {/if}
          </section>

          <section aria-labelledby="format-title">
            <h2 id="format-title">{t.formatTitle}</h2>
            <div class="choice" role="radiogroup" aria-label={t.formatGroup}>
              {#each FORMATS as option (option)}
                <label class:checked={format === option}>
                  <input
                    type="radio"
                    name="format"
                    value={option}
                    bind:group={format}
                    onchange={edited}
                  />
                  {t.formats[option]}
                </label>
              {/each}
            </div>
            <p class="help">{t.formatHelp[format]} {t.sizeNote(video.width, video.height)}</p>
          </section>
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
    max-height: 400px;
    margin-bottom: 12px;
    border-radius: var(--radius);
    background: var(--color-text);
  }
  .stage .help {
    margin: 4px 0 0;
  }
  section {
    margin: 0 0 16px;
    padding: 16px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius);
  }
  h2 {
    margin: 0 0 12px;
    font-size: 15px;
  }
  section .help,
  section .problem {
    margin: 8px 0 0;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 8px;
  }
  .field.inline {
    flex: 1 1 120px;
    margin: 0;
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
  .intervals {
    margin-top: 12px;
  }
  .fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 12px;
    margin-top: 16px;
  }
  .fields .field {
    margin-bottom: 12px;
  }
</style>
