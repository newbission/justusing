<!--
  동영상 용량 줄이기 화면 (격리 frame 안에서 실행).
  해상도와 화질(또는 목표 용량)을 골라 H.264 MP4로 다시 저장한다 (브라우저가 못 하면 VP9 WebM).
  소리는 되도록 그대로 옮긴다. 동영상은 어디로도 전송되지 않는다.
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
  import { percentSaved, resultName } from '../../../lib/video/files';
  import { VideoJobRunner, progressText } from '../../../lib/video/job.svelte';
  import { compressPlan, type CompressSetting } from '../../../lib/video/plan';
  import { SHORT_SIDES, scaledSize, type QualityLevel } from '../../../lib/video/sizes';
  import { webCodecs } from '../../../lib/video/video';

  const t = pick(MESSAGES);
  const common = pick(VIDEO_MESSAGES);
  const LEVELS: QualityLevel[] = ['high', 'medium', 'low'];
  /** 목표 용량의 1MB (바이트) */
  const MB = 1_000_000;

  let video = $state.raw<LoadedVideo>();
  let side = $state<number>(0);
  let mode = $state<'quality' | 'target'>('quality');
  let level = $state<QualityLevel>('medium');
  /** 목표 용량 칸의 글 (MB) */
  let targetText = $state('');

  const runner = new VideoJobRunner();
  let now = $state(Date.now());
  const codecs = webCodecs();

  /** 고를 수 있는 짧은 변: 원래 크기와, 그보다 작은 1080·720·480 */
  const sides = $derived.by(() => {
    const info = video?.info.video;
    if (!info) return [];
    const short = Math.min(info.width, info.height);
    return SHORT_SIDES.filter((option) => option === 0 || option < short);
  });

  const codec = $derived(video ? (video.info.encodable[side] ?? null) : null);
  const container = $derived<'mp4' | 'webm'>(codec === 'vp9' ? 'webm' : 'mp4');
  const targetBytes = $derived.by(() => {
    const value = Number(targetText.replace(',', '.'));
    // 1MB = 1,000,000바이트 (이미지 용량 맞추기와 같게, 메일·업로드 제한은 대개 이렇게 센다)
    return Number.isFinite(value) && value > 0 ? value * MB : 0;
  });
  const setting = $derived<CompressSetting>(
    mode === 'quality' ? { mode, level } : { mode, bytes: targetBytes },
  );
  const plan = $derived(video ? compressPlan(video.info, side, container, setting) : undefined);
  /** 목표 용량 칸이 비었거나 0보다 큰 숫자가 아니다 */
  const targetInvalid = $derived(mode === 'target' && targetBytes === 0);
  const impossible = $derived(
    mode === 'target' && !targetInvalid && (!plan || plan.videoBitrate <= 0),
  );
  const canRun = $derived(codecs.video && !!video?.info.video?.canDecode && codec !== null);

  const key = $derived(`${side}|${mode}|${level}|${targetBytes}`);
  const result = $derived(runner.resultFor(key));
  const failure = $derived(runner.failureFor(key));
  const noGain = $derived(!!result && !!video && result.blob.size >= video.info.size);

  $effect(() => {
    if (!runner.working) return;
    const timer = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(timer);
  });

  function onload(loaded: LoadedVideo) {
    runner.reset();
    video = loaded;
    const short = Math.min(loaded.info.video!.width, loaded.info.video!.height);
    // 기본: 720p보다 크면 720p, 아니면 원래 크기. 그 크기로 저장하지 못하면 저장할 수 있는 가장 큰 크기
    const preferred = short > 720 ? 720 : 0;
    const available = SHORT_SIDES.filter((option) => option === 0 || option < short);
    side = loaded.info.encodable[preferred]
      ? preferred
      : (available.find((option) => loaded.info.encodable[option]) ?? preferred);
    mode = 'quality';
    level = 'medium';
    targetText = String(Math.max(1, Math.round((loaded.info.size / MB) * 0.5)));
  }

  function onclose() {
    runner.reset();
    video = undefined;
  }

  function sideLabel(option: number) {
    const info = video?.info.video;
    if (!info) return '';
    const size = scaledSize(info.width, info.height, option);
    return `${option === 0 ? t.original : `${option}p`} (${size.width}×${size.height})`;
  }

  async function compress() {
    if (!video || !plan || runner.working || !canRun || impossible || targetInvalid) return;
    const entitlement = await canUse('video/compress');
    if (!entitlement.allowed) return;
    await runner.start(
      video.file,
      { kind: 'compress', shortSide: side, videoBitrate: plan.videoBitrate },
      key,
    );
  }

  function download() {
    if (!video || !result || noGain) return;
    downloadFile(result.blob, resultName(video.name, t.suffix, result.container));
  }

  const audioNote = $derived.by(() => {
    if (!plan || !video) return '';
    if (plan.audio === 'none') return t.noAudio;
    if (plan.audio === 'copy') return t.audioCopy(codecName(video.info.audio?.codec));
    if (plan.audio === 'aac') return t.audioAac;
    if (plan.audio === 'opus') return t.audioOpus;
    return t.audioDropped;
  });
</script>

<SingleVideoTool needs="video" hint={t.hint} {onload} {onclose}>
  {#snippet children(loaded)}
    {@const state = runner.state}
    <ActionBar label={t.bar}>
      {#snippet text()}
        {#if state.kind === 'working'}
          {progressText(state, now)}
        {:else if result && noGain}
          <strong>{t.noGain(formatSize(result.blob.size))}</strong>
        {:else if result}
          {t.done(
            formatSize(loaded.info.size),
            formatSize(result.blob.size),
            percentSaved(loaded.info.size, result.blob.size),
            result.width ?? 0,
            result.height ?? 0,
          )}{result.droppedAudio ? t.droppedAudio : ''}
        {:else if failure}
          <strong>{common.failed[failure]}</strong>
        {:else if !canRun}
          <strong
            >{!codecs.video
              ? common.noWebCodecs
              : !loaded.info.video?.canDecode
                ? common.cannotDecode(codecName(loaded.info.video?.codec))
                : t.outputNone}</strong
          >
        {:else if targetInvalid}
          <strong>{t.targetInvalid}</strong>
        {:else if impossible}
          <strong>{t.targetImpossible}</strong>
        {:else if plan && plan.estimate >= loaded.info.size}
          {state.kind === 'canceled' ? `${common.canceled} ` : ''}{t.estimateBigger(
            formatSize(loaded.info.size),
          )}
        {:else if plan}
          {state.kind === 'canceled' ? `${common.canceled} ` : ''}{t.estimate(
            formatSize(plan.estimate),
            formatSize(loaded.info.size),
          )}
        {/if}
      {/snippet}
      {#if state.kind === 'working'}
        <button type="button" class="btn primary" onclick={() => runner.cancel()}
          >{common.cancel}</button
        >
      {:else if result && !noGain}
        <button type="button" class="btn primary" onclick={download}>{common.download}</button>
      {:else}
        <button
          type="button"
          class="btn primary"
          disabled={!canRun || impossible || targetInvalid || noGain}
          onclick={compress}>{t.run}</button
        >
      {/if}
    </ActionBar>

    <div class="tool-body">
      <div class="layout">
        <div class="stage">
          <!-- svelte-ignore a11y_media_has_caption -->
          <video
            src={loaded.url}
            controls
            playsinline
            preload="metadata"
            aria-label={t.previewLabel}
          ></video>
        </div>

        <div class="panel">
          <section aria-labelledby="size-title">
            <h2 id="size-title">{t.sizeTitle}</h2>
            <div class="options" role="radiogroup" aria-label={t.sizeGroup}>
              {#each sides as option (option)}
                {@const encodable = loaded.info.encodable[option] !== null}
                <label class:checked={side === option}>
                  <input
                    type="radio"
                    name="side"
                    value={option}
                    checked={side === option}
                    disabled={runner.working || (!encodable && codecs.video)}
                    onchange={() => (side = option)}
                  />
                  {sideLabel(option)}
                  {#if !encodable && codecs.video}
                    <span class="note">· {t.cannotEncodeSize}</span>
                  {/if}
                </label>
              {/each}
            </div>
            <p class="help">{t.sizeHelp}</p>
          </section>

          <section aria-labelledby="quality-title">
            <h2 id="quality-title">{t.qualityTitle}</h2>
            <div class="choice" role="radiogroup" aria-label={t.modeGroup}>
              {#each ['quality', 'target'] as const as option (option)}
                <label class:checked={mode === option}>
                  <input
                    type="radio"
                    name="mode"
                    value={option}
                    bind:group={mode}
                    disabled={runner.working}
                  />
                  {t.modes[option]}
                </label>
              {/each}
            </div>
            {#if mode === 'quality'}
              <div class="choice levels" role="radiogroup" aria-label={t.levelGroup}>
                {#each LEVELS as option (option)}
                  <label class:checked={level === option}>
                    <input
                      type="radio"
                      name="level"
                      value={option}
                      bind:group={level}
                      disabled={runner.working}
                    />
                    {t.levels[option]}
                  </label>
                {/each}
              </div>
              <p class="help">{t.levelHelp[level]}</p>
            {:else}
              <label class="field target">
                {t.targetLabel}
                <input
                  type="text"
                  inputmode="decimal"
                  autocomplete="off"
                  bind:value={targetText}
                  disabled={runner.working}
                  aria-invalid={targetInvalid || impossible || plan?.tooLow ? 'true' : undefined}
                />
              </label>
              <p class="help">{t.targetHelp}</p>
              {#if plan?.tooLow && !impossible && !targetInvalid}
                <p class="problem">{t.targetTooSmall}</p>
              {/if}
            {/if}
          </section>

          <section aria-labelledby="output-title">
            <h2 id="output-title">{t.outputTitle}</h2>
            <p class="help">
              {codec === 'avc' ? t.outputMp4 : codec === 'vp9' ? t.outputWebm : t.outputNone}
              {audioNote}
            </p>
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
  section .help,
  section .problem {
    margin: 8px 0 0;
  }
  .options {
    display: grid;
    gap: 6px;
  }
  .options label {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius);
    font-size: 14px;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
  }
  .options label.checked {
    border-color: var(--color-accent);
    background: var(--color-accent-soft);
  }
  .options label:has(input:disabled) {
    opacity: 0.5;
    cursor: default;
  }
  .options input {
    accent-color: var(--color-accent);
  }
  .options .note {
    color: var(--color-muted);
    font-size: 13px;
  }
  .levels {
    margin-top: 12px;
  }
  .target {
    margin-top: 12px;
  }
</style>
