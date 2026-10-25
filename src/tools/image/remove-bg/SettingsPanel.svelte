<!--
  배경 지우기의 가장자리·배경 설정 (격리 frame 안). 목록 화면에서는 모든 사진의 설정을,
  고치는 화면에서는 그 사진에 쓰는 설정(모든 사진 것이나 이 사진만 따로 정한 것)을 바꾼다.
-->
<script lang="ts">
  import { pick } from '../../../frame/locale';
  import { SHIFT_LIMIT, SOFT_LIMIT } from '../../../lib/cutout/matte';
  import { MESSAGES } from './messages';
  import { WHITE, type Settings } from './state.svelte';

  interface Props {
    settings: Settings;
  }

  let { settings }: Props = $props();
  const t = pick(MESSAGES);
</script>

<section aria-labelledby="edge-title">
  <h2 id="edge-title">{t.edgeTitle}</h2>
  <div class="slider">
    <label for="shift">{t.shift}</label>
    <input
      id="shift"
      type="range"
      min={-SHIFT_LIMIT}
      max={SHIFT_LIMIT}
      step="1"
      bind:value={settings.shift}
    />
    <span class="value">{t.shiftValue(settings.shift)}</span>
  </div>
  <div class="slider">
    <label for="soft">{t.soft}</label>
    <input id="soft" type="range" min="0" max={SOFT_LIMIT} step="1" bind:value={settings.soft} />
    <span class="value">{settings.soft}</span>
  </div>
  <p class="help">{t.edgeHelp}</p>
</section>

<section aria-labelledby="background-title">
  <h2 id="background-title">{t.backgroundTitle}</h2>
  <div class="swatches" role="radiogroup" aria-labelledby="background-title">
    {#each ['none', 'white', 'custom'] as const as option (option)}
      <label class:checked={settings.background === option}>
        <input type="radio" name="background" value={option} bind:group={settings.background} />
        <span
          class="dot"
          class:none={option === 'none'}
          style:background-color={option === 'white'
            ? WHITE
            : option === 'custom'
              ? settings.color
              : undefined}
        ></span>
        {t.backgrounds[option]}
      </label>
    {/each}
  </div>
  {#if settings.background === 'custom'}
    <label class="pick">
      {t.customColor}
      <input type="color" bind:value={settings.color} />
    </label>
  {/if}
  <p class="help">
    {settings.backgroundColor ? t.backgroundHelp.color : t.backgroundHelp.none}
  </p>
  <label class="check">
    <input type="checkbox" bind:checked={settings.trim} />
    {t.trim}
  </label>
  {#if settings.trim}
    <p class="help">{t.trimHelp}</p>
  {/if}
  <p class="help">{t.sizeNote}</p>
</section>

<style>
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
  .slider {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    margin-top: 12px;
  }
  .slider label {
    min-width: 88px;
    font-size: 14px;
    font-weight: 600;
  }
  .slider input {
    flex: 1;
    min-width: 120px;
    accent-color: var(--color-accent);
  }
  .slider .value {
    min-width: 44px;
    font-size: 14px;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
  .swatches {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .swatches label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius);
    font-size: 14px;
    cursor: pointer;
  }
  .swatches label:hover {
    background: var(--color-hover);
  }
  .swatches label.checked {
    border-color: var(--color-text);
    box-shadow: inset 0 0 0 1px var(--color-text);
    font-weight: 600;
  }
  .swatches label:has(input:focus-visible) {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
  .swatches input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .dot {
    width: 14px;
    height: 14px;
    border: 1px solid var(--color-line);
    border-radius: 50%;
  }
  /* 투명: 체크무늬 점 */
  .dot.none {
    background: repeating-conic-gradient(
        color-mix(in srgb, var(--color-paper-text) 22%, var(--color-paper)) 0 25%,
        var(--color-paper) 0 50%
      )
      0 0 / 7px 7px;
  }
  .pick {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
    font-size: 14px;
  }
  .pick input {
    width: 44px;
    height: 32px;
    padding: 0;
    border: 1px solid var(--color-line);
    border-radius: var(--radius);
    background: none;
  }
  .check {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
  .check input {
    width: 16px;
    height: 16px;
    accent-color: var(--color-accent);
  }
</style>
