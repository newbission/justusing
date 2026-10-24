<!--
  동영상 소리 뽑기 화면 (격리 frame 안에서 실행).
  원래 소리를 다시 인코딩 없이 꺼내거나(AAC → M4A 등), WAV·M4A로 다시 저장한다.
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
  import { EXTRACT_AAC_BITRATE, audioContainerFor } from '../../../lib/video/plan';
  import { formatTime } from '../../../lib/video/time';
  import type { AudioJob } from '../../../lib/video/types';
  import { webCodecs } from '../../../lib/video/video';

  type Target = AudioJob['target'];

  const t = pick(MESSAGES);
  const common = pick(VIDEO_MESSAGES);
  const TARGETS: Target[] = ['copy', 'wav', 'aac'];
  /** 화면에 보이는 형식 이름 */
  const FORMAT_NAMES: Record<string, string> = {
    m4a: 'M4A',
    mp3: 'MP3',
    ogg: 'OGG',
    flac: 'FLAC',
    wav: 'WAV',
  };

  let video = $state.raw<LoadedVideo>();
  let target = $state<Target>('copy');

  const runner = new VideoJobRunner();
  let now = $state(Date.now());
  const codecs = webCodecs();

  const audio = $derived(video?.info.audio);
  const copyFormat = $derived(audioContainerFor(audio?.codec));
  /** 고를 수 있는지: 그대로는 담을 그릇이 있을 때, WAV는 풀 수 있을 때, M4A는 풀고 AAC로 저장할 수 있을 때 */
  const available = $derived<Record<Target, boolean>>({
    copy: copyFormat !== undefined,
    wav: !!audio?.canDecode,
    aac: !!audio?.canDecode && !!video?.info.audioEncodable.aac && codecs.audioEncode,
  });
  const choices = $derived(
    // 원래 소리가 이미 AAC면 'M4A로 다시 저장'은 그대로 꺼내기와 같아 보이지 않는다
    TARGETS.filter((option) => !(option === 'aac' && audio?.codec === 'aac')),
  );
  const outputFormat = $derived(
    target === 'copy' ? (copyFormat ?? 'm4a') : target === 'wav' ? 'wav' : 'm4a',
  );
  const estimate = $derived.by(() => {
    if (!video || !audio) return 0;
    const seconds = video.info.duration;
    if (target === 'copy') return (audio.bitrate * seconds) / 8;
    if (target === 'wav') return audio.sampleRate * audio.channels * 2 * seconds;
    return (EXTRACT_AAC_BITRATE * seconds) / 8;
  });

  const key = $derived(target);
  const result = $derived(runner.resultFor(key));
  const failure = $derived(runner.failureFor(key));

  $effect(() => {
    if (!runner.working) return;
    const timer = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(timer);
  });

  function onload(loaded: LoadedVideo) {
    runner.reset();
    video = loaded;
    const options = available;
    target = options.copy ? 'copy' : options.aac ? 'aac' : 'wav';
  }

  function onclose() {
    runner.reset();
    video = undefined;
  }

  async function extract() {
    if (!video || runner.working || !available[target]) return;
    const entitlement = await canUse('video/extract-audio');
    if (!entitlement.allowed) return;
    await runner.start(video.file, { kind: 'audio', target }, key);
  }

  function download() {
    if (!video || !result) return;
    downloadFile(result.blob, resultName(video.name, t.suffix, result.container));
  }

  function unavailableReason(option: Target) {
    if (option === 'copy') return t.copyUnavailable;
    if (option === 'wav') return t.wavUnavailable(codecName(audio?.codec));
    return t.aacUnavailable;
  }
</script>

<SingleVideoTool needs="audio" hint={t.hint} {onload} {onclose}>
  {#snippet children(loaded)}
    {@const state = runner.state}
    {@const nothing = !TARGETS.some((option) => available[option])}
    <ActionBar label={t.bar}>
      {#snippet text()}
        {#if state.kind === 'working'}
          {progressText(state, now)}
        {:else if result}
          {t.done(
            formatTime(result.duration),
            formatSize(result.blob.size),
            FORMAT_NAMES[result.container] ?? result.container.toUpperCase(),
          )}
        {:else if failure}
          <strong>{common.failed[failure]}</strong>
        {:else if nothing}
          <strong>{t.nothing}</strong>
        {:else}
          {state.kind === 'canceled' ? `${common.canceled} ` : ''}{t.ready(
            FORMAT_NAMES[outputFormat] ?? outputFormat,
            formatSize(Math.max(1, estimate)),
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
        <button type="button" class="btn primary" disabled={!available[target]} onclick={extract}
          >{t.run}</button
        >
      {/if}
    </ActionBar>

    <div class="tool-body">
      <div class="layout">
        <div class="stage">
          {#if loaded.info.video}
            <!-- svelte-ignore a11y_media_has_caption -->
            <video
              src={loaded.url}
              controls
              playsinline
              preload="metadata"
              aria-label={t.previewLabel}
            ></video>
          {/if}
          {#if audio}
            <p class="source">
              <strong>{t.sourceTitle}</strong>
              {t.source(
                codecName(audio.codec),
                (audio.sampleRate / 1000).toLocaleString(),
                audio.channels,
              )}
            </p>
          {/if}
        </div>

        <div class="panel">
          <section aria-labelledby="format-title">
            <h2 id="format-title">{t.formatTitle}</h2>
            <div class="options" role="radiogroup" aria-label={t.formatGroup}>
              {#each choices as option (option)}
                <label class:checked={target === option}>
                  <input
                    type="radio"
                    name="target"
                    value={option}
                    checked={target === option}
                    disabled={runner.working || !available[option]}
                    onchange={() => (target = option)}
                  />
                  <span class="text">
                    <strong
                      >{option === 'copy'
                        ? t.targets.copy(FORMAT_NAMES[copyFormat ?? ''] ?? codecName(audio?.codec))
                        : t.targets[option]}</strong
                    >
                    <span
                      >{available[option] ? t.targetHelp[option] : unavailableReason(option)}</span
                    >
                  </span>
                </label>
              {/each}
            </div>
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
    max-height: 320px;
    border-radius: var(--radius);
    background: var(--color-video);
  }
  .source {
    display: grid;
    gap: 4px;
    margin: 12px 0 0;
    font-size: 14px;
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
  .options {
    display: grid;
    gap: 8px;
  }
  .options label {
    display: flex;
    gap: 10px;
    padding: 12px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius);
    font-size: 14px;
    cursor: pointer;
  }
  .options label.checked {
    border-color: var(--color-accent);
    background: var(--color-accent-soft);
  }
  .options label:has(input:disabled) {
    opacity: 0.55;
    cursor: default;
  }
  .options input {
    flex: none;
    margin-top: 3px;
    accent-color: var(--color-accent);
  }
  .text {
    display: grid;
    gap: 4px;
  }
  .text span {
    color: var(--color-muted);
    font-size: 13px;
    line-height: 1.5;
  }
</style>
