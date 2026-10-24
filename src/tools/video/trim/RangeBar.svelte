<!--
  자를 구간 막대: 시작·끝 손잡이(끌기·방향키)와 지금 재생 위치. 막대를 누르면 그 위치로 간다.
  손잡이는 role="slider"라 화면 읽기 프로그램이 시각을 읽는다.
-->
<script lang="ts">
  import { formatTime } from '../../../lib/video/time';

  interface Props {
    duration: number;
    start: number;
    end: number;
    current: number;
    /** 가장 짧은 구간 (초) */
    minLength: number;
    label: string;
    help: string;
    startLabel: string;
    endLabel: string;
    onchange: (start: number, end: number) => void;
    onseek: (time: number) => void;
  }

  let {
    duration,
    start,
    end,
    current,
    minLength,
    label,
    help,
    startLabel,
    endLabel,
    onchange,
    onseek,
  }: Props = $props();

  let track: HTMLDivElement | undefined = $state();
  let drag: 'start' | 'end' | undefined;

  const percent = (time: number) => (duration > 0 ? (time / duration) * 100 : 0);
  const round = (time: number) => Math.round(time * 100) / 100;

  function timeAt(clientX: number) {
    if (!track) return 0;
    const box = track.getBoundingClientRect();
    return Math.min(duration, Math.max(0, ((clientX - box.left) / box.width) * duration));
  }

  function move(which: 'start' | 'end', time: number) {
    if (which === 'start') onchange(round(Math.min(Math.max(0, time), end - minLength)), end);
    else onchange(start, round(Math.max(Math.min(duration, time), start + minLength)));
  }

  function onPointerDown(event: PointerEvent, which: 'start' | 'end') {
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    drag = which;
  }

  function onPointerMove(event: PointerEvent) {
    if (!drag) return;
    const time = timeAt(event.clientX);
    move(drag, time);
    onseek(drag === 'start' ? Math.min(time, end - minLength) : Math.max(time, start + minLength));
  }

  function onKey(event: KeyboardEvent, which: 'start' | 'end') {
    const step = event.shiftKey ? 1 : 0.1;
    const value = which === 'start' ? start : end;
    const keys: Record<string, number> = {
      ArrowLeft: value - step,
      ArrowDown: value - step,
      ArrowRight: value + step,
      ArrowUp: value + step,
      PageDown: value - 10,
      PageUp: value + 10,
      Home: 0,
      End: duration,
    };
    const next = keys[event.key];
    if (next === undefined) return;
    event.preventDefault();
    move(which, next);
    onseek(which === 'start' ? Math.min(Math.max(0, next), end - minLength) : next);
  }
</script>

<div class="range" role="group" aria-label={label}>
  <!-- 막대를 누르면 그 위치로 간다 (키보드로는 손잡이와 미리보기 조작으로 같은 일을 한다) -->
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="track" bind:this={track} onclick={(event) => onseek(timeAt(event.clientX))}>
    <div class="kept" style:left="{percent(start)}%" style:width="{percent(end - start)}%"></div>
    <div class="playhead" style:left="{percent(current)}%"></div>
    {#each ['start', 'end'] as const as which (which)}
      {@const value = which === 'start' ? start : end}
      <button
        type="button"
        class="handle {which}"
        role="slider"
        aria-label={which === 'start' ? startLabel : endLabel}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration * 10) / 10}
        aria-valuenow={Math.round(value * 10) / 10}
        aria-valuetext={formatTime(value)}
        aria-describedby="range-help"
        style:left="{percent(value)}%"
        onclick={(event) => event.stopPropagation()}
        onpointerdown={(event) => onPointerDown(event, which)}
        onpointermove={onPointerMove}
        onpointerup={() => (drag = undefined)}
        onpointercancel={() => (drag = undefined)}
        onkeydown={(event) => onKey(event, which)}
      ></button>
    {/each}
  </div>
  <div class="ticks" aria-hidden="true">
    <span>{formatTime(0, 0)}</span>
    <span>{formatTime(duration, 1)}</span>
  </div>
  <p class="help" id="range-help">{help}</p>
</div>

<style>
  .range {
    padding: 8px 12px 0;
  }
  .track {
    position: relative;
    height: 40px;
    border-radius: var(--radius);
    background: var(--color-hover);
    cursor: pointer;
    touch-action: none;
  }
  .kept {
    position: absolute;
    top: 0;
    bottom: 0;
    border-top: 3px solid var(--color-accent);
    border-bottom: 3px solid var(--color-accent);
    background: color-mix(in srgb, var(--color-accent) 22%, transparent);
  }
  .playhead {
    position: absolute;
    top: -4px;
    bottom: -4px;
    width: 2px;
    margin-left: -1px;
    background: var(--color-text);
    pointer-events: none;
  }
  .handle {
    position: absolute;
    top: -6px;
    bottom: -6px;
    width: 18px;
    margin-left: -9px;
    padding: 0;
    border: 2px solid var(--color-bg);
    border-radius: 6px;
    background: var(--color-accent);
    cursor: ew-resize;
    touch-action: none;
  }
  .handle:focus-visible {
    outline: 2px solid var(--color-text);
    outline-offset: 2px;
  }
  .ticks {
    display: flex;
    justify-content: space-between;
    margin-top: 6px;
    color: var(--color-muted);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
  .help {
    margin: 8px 0 0;
  }
</style>
