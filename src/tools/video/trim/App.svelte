<!--
  동영상 자르기 화면 (격리 frame 안에서 실행).
  남길 구간을 손잡이·숫자로 고르고 미리보기로 확인한 뒤 자른다.
  빠르게: 다시 인코딩 없이 옮긴다 (WebCodecs 없이도 된다). 정확하게: 화면을 다시 인코딩한다.
  동영상은 어디로도 전송되지 않는다.
-->
<script lang="ts">
  import '../../../frame/controls.css';
  import { pick } from '../../../frame/locale';
  import { MESSAGES } from './messages';
  import ActionBar from '../../../frame/ActionBar.svelte';
  import { downloadFile } from '../../../frame/download';
  import { formatSize } from '../../../frame/format';
  import { canUse } from '../../../lib/entitlement';
  import SingleVideoTool, { type LoadedVideo } from '../../../lib/video/SingleVideoTool.svelte';
  import { VIDEO_MESSAGES, codecName } from '../../../lib/video/messages';
  import { resultName } from '../../../lib/video/files';
  import { VideoJobRunner, progressText } from '../../../lib/video/job.svelte';
  import { formatTime, parseTime } from '../../../lib/video/time';
  import { webCodecs } from '../../../lib/video/video';
  import RangeBar from './RangeBar.svelte';

  const t = pick(MESSAGES);
  const common = pick(VIDEO_MESSAGES);

  /** 가장 짧게 남길 수 있는 길이 (초) */
  const MIN_LENGTH = 0.1;

  let video = $state.raw<LoadedVideo>();
  let start = $state(0);
  let end = $state(0);
  let exact = $state(false);
  let current = $state(0);
  let previewFailed = $state(false);
  let player: HTMLVideoElement | undefined = $state();
  /** '고른 구간 재생' 중이면 끝에서 멈춘다 */
  let playingRange = false;

  const runner = new VideoJobRunner();
  let now = $state(Date.now());

  const codecs = webCodecs();
  /** 정확하게 자르기(다시 인코딩)를 할 수 있는지 */
  const canExact = $derived(
    !!video?.info.video?.canDecode &&
      codecs.video &&
      Object.values(video.info.encodable).some((codec) => codec !== null),
  );

  const key = $derived(`${start}|${end}|${exact}`);
  const result = $derived(runner.resultFor(key));
  const failure = $derived(runner.failureFor(key));
  const length = $derived(end - start);
  const tooShort = $derived(length < MIN_LENGTH - 1e-6);

  // 진행 중에는 남은 시간을 1초마다 다시 센다
  $effect(() => {
    if (!runner.working) return;
    const timer = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(timer);
  });

  function onload(loaded: LoadedVideo) {
    runner.reset();
    video = loaded;
    start = 0;
    end = Math.round(loaded.info.duration * 100) / 100;
    current = 0;
    exact = false;
    previewFailed = false;
  }

  function onclose() {
    runner.reset();
    video = undefined;
  }

  function setRange(nextStart: number, nextEnd: number) {
    if (!video) return;
    const duration = video.info.duration;
    const s = Math.min(Math.max(0, nextStart), Math.max(0, duration - MIN_LENGTH));
    const e = Math.max(Math.min(duration, nextEnd), s + MIN_LENGTH);
    start = Math.round(s * 100) / 100;
    end = Math.round(Math.min(duration, e) * 100) / 100;
  }

  function seek(time: number) {
    current = time;
    if (player) player.currentTime = time;
  }

  function playRange() {
    if (!player) return;
    seek(start);
    playingRange = true;
    void player.play().catch(() => (playingRange = false));
  }

  function onTimeUpdate() {
    if (!player) return;
    current = player.currentTime;
    if (playingRange && current >= end) {
      player.pause();
      playingRange = false;
    }
  }

  function setField(which: 'start' | 'end', text: string) {
    const time = parseTime(text);
    if (time === undefined) return;
    if (which === 'start') setRange(time, end);
    else setRange(start, time);
  }

  async function trim() {
    if (!video || runner.working || tooShort) return;
    const entitlement = await canUse('video/trim');
    if (!entitlement.allowed) return;
    player?.pause();
    await runner.start(video.file, { kind: 'trim', start, end, exact }, key);
  }

  function download() {
    if (!video || !result) return;
    downloadFile(result.blob, resultName(video.name, t.suffix, result.container));
  }
</script>

<SingleVideoTool needs="video" hint={t.hint} {onload} {onclose}>
  {#snippet children(loaded)}
    {@const state = runner.state}
    <ActionBar label={t.bar}>
      {#snippet text()}
        {#if state.kind === 'working'}
          {progressText(state, now)}
        {:else if result}
          {t.done(formatTime(result.duration), formatSize(result.blob.size))}{result.droppedAudio
            ? t.droppedAudio
            : ''}
        {:else if failure}
          <strong>{failure === 'copy' ? t.keyframeTooFar : common.failed[failure]}</strong>
        {:else if tooShort}
          <strong>{t.tooShort}</strong>
        {:else}
          {state.kind === 'canceled' ? `${common.canceled} ` : ''}{t.ready(
            formatTime(start),
            formatTime(end),
            formatTime(length),
          )}
        {/if}
      {/snippet}
      {#if state.kind === 'working'}
        <button type="button" class="btn primary" onclick={() => runner.cancel()}
          >{common.cancel}</button
        >
      {:else if result}
        <button type="button" class="btn primary" onclick={download}>{common.download}</button>
      {:else}
        <button type="button" class="btn primary" disabled={tooShort} onclick={trim}>{t.run}</button
        >
      {/if}
    </ActionBar>

    <div class="tool-body">
      <div class="layout">
        <div class="stage">
          <!-- svelte-ignore a11y_media_has_caption -->
          <video
            bind:this={player}
            src={loaded.url}
            controls
            playsinline
            preload="metadata"
            aria-label={t.previewLabel}
            ontimeupdate={onTimeUpdate}
            onpause={() => (playingRange = false)}
            onerror={() => (previewFailed = true)}
          ></video>
          {#if previewFailed}
            <p class="help" role="status">{common.previewFailed}</p>
          {/if}
          <RangeBar
            duration={loaded.info.duration}
            {start}
            {end}
            {current}
            minLength={MIN_LENGTH}
            label={t.timeline}
            help={t.timelineHelp}
            startLabel={t.startHandle}
            endLabel={t.endHandle}
            onchange={setRange}
            onseek={seek}
          />
          <div class="row">
            <button
              type="button"
              class="btn"
              onclick={() => setRange(Math.min(current, end - MIN_LENGTH), end)}
              >{t.setStart}</button
            >
            <button
              type="button"
              class="btn"
              onclick={() => setRange(start, Math.max(current, start + MIN_LENGTH))}
              >{t.setEnd}</button
            >
            <button type="button" class="btn" disabled={previewFailed} onclick={playRange}
              >{t.playRange}</button
            >
          </div>
        </div>

        <div class="panel">
          <section aria-labelledby="time-title">
            <h2 id="time-title">{t.timeline}</h2>
            <div class="fields">
              {#each ['start', 'end'] as const as which (`${which}-${which === 'start' ? start : end}`)}
                <label class="field">
                  {which === 'start' ? t.start : t.end}
                  <input
                    type="text"
                    inputmode="decimal"
                    autocomplete="off"
                    spellcheck="false"
                    value={formatTime(which === 'start' ? start : end, 2)}
                    onchange={(event) => {
                      setField(which, event.currentTarget.value);
                      event.currentTarget.value = formatTime(which === 'start' ? start : end, 2);
                    }}
                    onkeydown={(event) => {
                      if (event.key === 'Enter') event.currentTarget.blur();
                    }}
                  />
                </label>
              {/each}
            </div>
            <p class="help">{t.timeHelp} {t.length(formatTime(length, 2))}</p>
          </section>

          <section aria-labelledby="mode-title">
            <h2 id="mode-title">{t.modeTitle}</h2>
            <div class="modes" role="radiogroup" aria-label={t.modeGroup}>
              {#each [false, true] as option (option)}
                {@const mode = option ? t.modes.exact : t.modes.fast}
                <label class="mode" class:checked={exact === option}>
                  <input
                    type="radio"
                    name="mode"
                    value={option ? 'exact' : 'fast'}
                    checked={exact === option}
                    disabled={(option && !canExact) || runner.working}
                    onchange={() => (exact = option)}
                  />
                  <span class="mode-text">
                    <strong>{mode.label}</strong>
                    <span>{mode.help}</span>
                  </span>
                </label>
              {/each}
            </div>
            {#if !canExact}
              <p class="help">
                {loaded.info.video && !loaded.info.video.canDecode && codecs.video
                  ? common.cannotDecode(codecName(loaded.info.video.codec))
                  : t.exactUnavailable}
              </p>
            {/if}
          </section>
        </div>
      </div>
    </div>
  {/snippet}
</SingleVideoTool>

<style>
  .layout {
    display: flex;
    flex-wrap: wrap;
    gap: 24px;
  }
  .stage {
    flex: 3 1 340px;
    min-width: 0;
  }
  .panel {
    flex: 2 1 280px;
    min-width: 0;
  }
  video {
    display: block;
    width: 100%;
    max-height: 360px;
    border-radius: var(--radius);
    background: var(--color-video);
  }
  .stage .help {
    margin: 8px 0 0;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }
  section {
    margin-bottom: 16px;
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
  .fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 12px;
  }
  .fields input {
    font-variant-numeric: tabular-nums;
  }
  .modes {
    display: grid;
    gap: 8px;
  }
  .mode {
    display: flex;
    gap: 10px;
    padding: 12px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius);
    font-size: 14px;
    cursor: pointer;
  }
  .mode.checked {
    border-color: var(--color-accent);
    background: color-mix(in srgb, var(--color-accent) 8%, transparent);
  }
  .mode:has(input:disabled) {
    opacity: 0.5;
    cursor: default;
  }
  .mode input {
    flex: none;
    margin-top: 3px;
    accent-color: var(--color-accent);
  }
  .mode-text {
    display: grid;
    gap: 4px;
  }
  .mode-text span {
    color: var(--color-muted);
    font-size: 13px;
    line-height: 1.5;
  }
</style>
