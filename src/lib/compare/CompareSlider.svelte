<!--
  원본과 결과를 한 자리에 겹쳐 두고, 가운데 손잡이를 좌우로 끌어 비교한다.
  왼쪽은 원본, 오른쪽은 결과. 손잡이는 끌거나 아래 막대(키보드 방향키)로 옮긴다.
  확대하면 3배로 보고, 끌면 보는 자리가 옮겨진다 (경계는 막대로 옮긴다).
  두 이미지는 가로·세로가 달라도 같은 칸에 맞춰 그린다 (크기 조절 결과도 비교할 수 있게).
  문구는 부르는 쪽이 넘긴다 (도구 화면·가이드 어디서나 쓰게).
-->
<script lang="ts">
  interface Side {
    src: string;
    /** 이미지 위 꼬리표 (예: 원본) */
    label: string;
    /** 꼬리표 옆 설명 (예: 2.4MB) */
    detail?: string;
  }

  interface Props {
    before: Side;
    after: Side;
    /** 경계 막대 이름 (화면 읽기용) */
    sliderLabel: string;
    zoomIn: string;
    zoomOut: string;
  }

  let { before, after, sliderLabel, zoomIn, zoomOut }: Props = $props();

  const ZOOM = 3;
  /** 경계 위치 (왼쪽에서 %) */
  let position = $state(50);
  let zoomed = $state(false);
  /** 확대했을 때 보는 자리 (칸 안의 %) */
  let focus = $state({ x: 50, y: 50 });
  let stage: HTMLDivElement | undefined = $state();
  let dragging = false;

  const clamp = (value: number) => Math.min(100, Math.max(0, value));

  function pointAt(event: PointerEvent) {
    const rect = stage!.getBoundingClientRect();
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100),
    };
  }

  function follow(event: PointerEvent) {
    const point = pointAt(event);
    if (zoomed) focus = point;
    else position = point.x;
  }

  function start(event: PointerEvent) {
    if (event.button !== 0) return;
    dragging = true;
    stage!.setPointerCapture(event.pointerId);
    follow(event);
  }

  function move(event: PointerEvent) {
    if (dragging) follow(event);
  }

  function end() {
    dragging = false;
  }

  const transform = $derived(zoomed ? `scale(${ZOOM})` : 'none');
  const origin = $derived(`${focus.x}% ${focus.y}%`);
</script>

<figure class="compare">
  <div
    class="stage"
    role="presentation"
    class:zoomed
    bind:this={stage}
    onpointerdown={start}
    onpointermove={move}
    onpointerup={end}
    onpointercancel={end}
  >
    <div class="layer">
      <img
        src={after.src}
        alt=""
        draggable="false"
        style:transform
        style:transform-origin={origin}
      />
    </div>
    <div class="layer" style:clip-path={`inset(0 ${100 - position}% 0 0)`}>
      <img
        src={before.src}
        alt=""
        draggable="false"
        style:transform
        style:transform-origin={origin}
      />
    </div>
    <div class="line" style:left={`${position}%`} aria-hidden="true">
      <span class="grip"></span>
    </div>
    <span class="tag left">{before.label}</span>
    <span class="tag right">{after.label}</span>
  </div>
  <div class="controls">
    <input type="range" min="0" max="100" step="1" bind:value={position} aria-label={sliderLabel} />
    <button type="button" class="btn" aria-pressed={zoomed} onclick={() => (zoomed = !zoomed)}
      >{zoomed ? zoomOut : zoomIn}</button
    >
  </div>
  <figcaption>
    <span>{before.label}{before.detail ? ` · ${before.detail}` : ''}</span>
    <span>{after.label}{after.detail ? ` · ${after.detail}` : ''}</span>
  </figcaption>
</figure>

<style>
  .compare {
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 100%;
    margin: 0;
  }
  .stage {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    border-radius: var(--radius);
    /* 투명한 부분이 보이게 체크 무늬를 깐다 */
    background: repeating-conic-gradient(var(--color-line) 0 25%, var(--color-surface) 0 50%) 0 0 /
      16px 16px;
    cursor: ew-resize;
    touch-action: none;
    user-select: none;
  }
  .stage.zoomed {
    cursor: move;
  }
  .layer {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }
  .layer img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    pointer-events: none;
  }
  .line {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    margin-left: -1px;
    background: var(--color-accent);
    pointer-events: none;
  }
  .grip {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 28px;
    height: 28px;
    margin: -14px 0 0 -14px;
    border: 2px solid var(--color-accent);
    border-radius: 50%;
    background: var(--color-surface);
  }
  .tag {
    position: absolute;
    top: 8px;
    padding: 2px 8px;
    border-radius: var(--radius);
    background: var(--color-scrim);
    color: #fff;
    font-size: 12px;
    pointer-events: none;
  }
  .tag.left {
    left: 8px;
  }
  .tag.right {
    right: 8px;
  }
  .controls {
    display: flex;
    flex: none;
    align-items: center;
    gap: 12px;
  }
  .controls input {
    flex: 1;
    accent-color: var(--color-accent);
  }
  figcaption {
    display: flex;
    flex: none;
    justify-content: space-between;
    gap: 12px;
    color: var(--color-muted);
    font-size: 13px;
  }
</style>
