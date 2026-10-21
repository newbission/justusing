<!--
  증명사진 도구 화면 (격리 frame 안에서 실행).
  사진 한 장에서 얼굴을 찾아 여권 규격(3.5×4.5cm, 머리 길이 3.2~3.6cm)에 맞게 자르고·키우고·기울기를 바로잡는다.
  고르면 배경을 다른 색으로 바꾼다 (사람과 배경을 나누는 모델, 얼굴 찾기 데이터에 함께 들어 있다).
  얼굴 찾기 데이터는 처음 한 번 받아(크기를 밝히고 묻는다) 이 브라우저에 보관한다. 받지 않아도 직접 맞출 수 있다.
  사진은 어디로도 전송되지 않는다.
-->
<script lang="ts">
  import '../../../frame/controls.css';
  import { onMount, untrack } from 'svelte';
  import { pick } from '../../../frame/locale';
  import { MESSAGES } from './messages';
  import ActionBar from '../../../frame/ActionBar.svelte';
  import FileDrop from '../../../frame/FileDrop.svelte';
  import { dataStatus, loadData, missingData } from '../../../frame/data';
  import { downloadFile } from '../../../frame/download';
  import { onFrameFiles } from '../../../frame/drop';
  import { baseName, formatSize } from '../../../frame/format';
  import { requestShowTool } from '../../../frame/parent';
  import { canUse } from '../../../lib/entitlement';
  import { FACE_CONSENT, FACE_FILES, FaceFinder, type Point } from '../../../lib/face/face';
  import {
    SPEC,
    autoPlace,
    centerPlace,
    drawCrop,
    headLength,
    matteCovers,
    matteRegion,
    outputSize,
    outside,
    readFace,
    type Backdrop,
    type Face,
    type Matte,
    type Output,
    type Placement,
    type Thumb,
    whiteBackground,
  } from '../../../lib/face/id-photo';
  import { PhotoWorker } from '../../../lib/face/photo';

  const t = pick(MESSAGES);

  /** 미리보기·얼굴 찾기에 쓰는 사진의 긴 변 (원본은 결과 파일에만 쓴다) */
  const PREVIEW_SIDE = 1600;
  /** 정수리·배경을 살필 때 쓰는 사진의 긴 변 */
  const THUMB_SIDE = 600;
  /** 사람·배경 나누기에 넣는 그림의 긴 변 (모델은 256으로 줄여 본다) */
  const MATTE_SIDE = 512;
  /** 고를 수 있는 배경색 */
  const BACKGROUNDS = { white: '#ffffff', gray: '#e6e6e6', blue: '#cfe2f3' } as const;
  type BackgroundChoice = 'original' | keyof typeof BACKGROUNDS | 'custom';
  /** 미리보기 칸 크기 (CSS 픽셀, 35:45) */
  const VIEW_W = 245;
  const VIEW_H = 315;

  /** 원본은 사진 워커가 들고 있다 (결과 파일용). 화면에는 줄인 사본만 둔다 */
  interface Photo {
    name: string;
    /** 줄인 사진 (미리보기·얼굴 찾기용) */
    preview: ImageBitmap;
    width: number;
    height: number;
    thumb: Thumb;
  }

  type Phase = 'idle' | 'opening' | 'error' | 'ready';
  let phase = $state<Phase>('idle');
  let photo = $state.raw<Photo>();
  /** 새 사진을 열거나 닫을 때마다 늘어난다. 늦게 끝난 예전 작업이 지금 사진을 덮어쓰지 않게 한다 */
  let generation = 0;

  type Data =
    | { kind: 'checking' }
    | { kind: 'missing'; removed: boolean; lowSpace: boolean }
    | { kind: 'downloading'; percent: number }
    | { kind: 'failed' }
    | { kind: 'ready' };
  let data = $state<Data>({ kind: 'checking' });
  const totalBytes = FACE_FILES.reduce((sum, file) => sum + file.bytes, 0);
  /** 받아야 할 크기 (전에 받은 사람은 새로 더해진 파일만) */
  let needBytes = $state(totalBytes);

  type Find =
    | { kind: 'idle' }
    | { kind: 'finding' }
    | { kind: 'found'; face: Face; auto: Placement; faces: number }
    | { kind: 'none' }
    | { kind: 'failed' };
  let find = $state.raw<Find>({ kind: 'idle' });
  let placement = $state.raw<Placement>({ cx: 0, cy: 0, angle: 0, height: 1, flip: false });
  let saved = $state.raw<
    { size: number; fits: boolean; width: number; height: number; output: Output } | undefined
  >();

  /** 저장 방식 (기본: 여권 온라인 제출 규격) */
  const LIMITS = [500, 200, 100, 0] as const;
  let size = $state<Output['size']>('online');
  let format = $state<Output['format']>('jpeg');
  /** 용량 상한 (KB, 0은 제한 없음) */
  let limit = $state<(typeof LIMITS)[number]>(500);
  const output = $derived<Output>({
    size,
    format,
    maxBytes: limit === 0 ? undefined : limit * 1024,
  });
  let saveFailed = $state(false);
  let finder: Promise<FaceFinder> | undefined;
  const photos = new PhotoWorker();

  let background = $state<BackgroundChoice>('original');
  let customColor = $state('#dfe8f0');
  const backgroundColor = $derived(
    background === 'original'
      ? undefined
      : background === 'custom'
        ? customColor
        : BACKGROUNDS[background],
  );
  type MatteState =
    | { kind: 'none' }
    | { kind: 'working' }
    | { kind: 'ready'; matte: Matte; cutout: { image: ImageBitmap; x: number; y: number } }
    | { kind: 'failed' };
  let matte = $state.raw<MatteState>({ kind: 'none' });
  /** 나눈 결과를 바꾼다 (예전 미리보기 그림은 닫는다) */
  function setMatte(next: MatteState) {
    if (matte.kind === 'ready') matte.cutout.image.close();
    matte = next;
  }

  /** 받은 데이터로 얼굴 찾기 엔진을 띄운다 (엔진이 바이트를 넘겨받아 비운다) */
  function startFinder(bytes: Promise<Map<string, Uint8Array>>) {
    const started = bytes.then((value) => FaceFinder.create(value));
    started.catch(() => {
      if (finder === started) finder = undefined;
    });
    finder = started;
    return started;
  }

  onMount(() => {
    dataStatus(FACE_FILES, FACE_CONSENT).then((status) => {
      const missing = missingData(FACE_FILES, status);
      const lowSpace = status.available !== undefined && status.available < missing.bytes * 2;
      needBytes = missing.bytes;
      data =
        missing.bytes === 0
          ? { kind: 'ready' }
          : { kind: 'missing', removed: missing.removed, lowSpace };
    });
    const off = onFrameFiles(([file]) => {
      if (file) open(file);
    });
    return () => {
      off();
      finder?.then((value) => value.dispose()).catch(() => {});
      photos.dispose();
    };
  });

  async function downloadData() {
    data = { kind: 'downloading', percent: 0 };
    try {
      const bytes = await loadData(FACE_FILES, FACE_CONSENT, (received) => {
        data = {
          kind: 'downloading',
          percent: Math.min(99, Math.floor((received / needBytes) * 100)),
        };
      });
      // 받은 바이트로 바로 띄운다. 보관소를 쓸 수 없는 창(시크릿 모드 등)에서 다시 받지 않게 한다
      startFinder(Promise.resolve(bytes));
      data = { kind: 'ready' };
    } catch {
      data = { kind: 'failed' };
    }
  }

  async function open(file: File) {
    const ticket = ++generation;
    close(false);
    phase = 'opening';
    try {
      const opened = await photos.open(file, PREVIEW_SIDE, THUMB_SIDE);
      if (ticket !== generation) {
        opened.preview.close();
        return;
      }
      photo = { name: file.name, ...opened };
      placement = centerPlace(opened.width, opened.height);
      phase = 'ready';
      requestShowTool();
    } catch {
      if (ticket === generation) phase = 'error';
    }
  }

  function close(reset = true) {
    if (reset) generation++;
    photo?.preview.close();
    photo = undefined;
    find = { kind: 'idle' };
    setMatte({ kind: 'none' });
    saved = undefined;
    saveFailed = false;
    phase = 'idle';
  }

  // 데이터가 준비돼 있으면 사진을 열자마자 얼굴을 찾는다
  $effect(() => {
    if (data.kind === 'ready' && photo) untrack(() => find.kind === 'idle' && analyze());
  });

  /** 얼굴 크기 (이마 꼭대기~턱 거리, 0~1 비율). 여럿이면 가장 큰 얼굴을 쓴다 */
  const faceSize = (points: Point[]) =>
    Math.hypot(points[152].x - points[10].x, points[152].y - points[10].y);

  async function analyze() {
    const current = photo;
    if (!current) return;
    const ticket = generation;
    find = { kind: 'finding' };
    try {
      const faces = await (
        await (finder ?? startFinder(loadData(FACE_FILES, FACE_CONSENT)))
      ).detect(await createImageBitmap(current.preview));
      if (ticket !== generation) return;
      if (faces.length === 0) {
        find = { kind: 'none' };
        return;
      }
      const points = faces.reduce((a, b) => (faceSize(b) > faceSize(a) ? b : a));
      const face = readFace(points, current.width, current.height, current.thumb);
      const auto = autoPlace(face);
      placement = auto;
      edited();
      find = { kind: 'found', face, auto, faces: faces.length };
    } catch {
      if (ticket === generation) find = { kind: 'failed' };
    }
  }

  // 배경을 바꾸기로 했으면 사람과 배경을 나눈다. 칸을 나눈 영역 밖으로 옮기면 다시 나눈다
  $effect(() => {
    if (background === 'original' || data.kind !== 'ready' || !photo) return;
    const current = matte;
    if (current.kind === 'working' || current.kind === 'failed') return;
    if (
      current.kind === 'ready' &&
      matteCovers(current.matte, placement, photo.width, photo.height)
    )
      return;
    untrack(() => separate());
  });

  async function separate() {
    const current = photo;
    if (!current) return;
    const ticket = generation;
    setMatte({ kind: 'working' });
    try {
      const region = matteRegion(placement, current.width, current.height);
      const k = current.preview.width / current.width;
      const side = Math.max(region.width, region.height) * k;
      const fit = MATTE_SIDE / side;
      const bitmap = await createImageBitmap(
        current.preview,
        region.x * k,
        region.y * k,
        region.width * k,
        region.height * k,
        {
          resizeWidth: Math.max(1, Math.round(region.width * k * fit)),
          resizeHeight: Math.max(1, Math.round(region.height * k * fit)),
          resizeQuality: 'high',
        },
      );
      const mask = await (
        await (finder ?? startFinder(loadData(FACE_FILES, FACE_CONSENT)))
      ).segment(bitmap);
      if (ticket !== generation) return;
      const made: Matte = { ...region, mask };
      // 사람만 남긴 미리보기는 사진 워커가 원본에서 만든다 (화면 스레드를 막지 않게)
      const piece = await photos.cutout(made, k);
      if (ticket !== generation) {
        piece.image.close();
        return;
      }
      setMatte({ kind: 'ready', matte: made, cutout: piece });
    } catch {
      if (ticket === generation) setMatte({ kind: 'failed' });
    }
  }

  // 배경을 바꾸면 결과도 바뀌므로 지난번에 받은 결과 안내를 지운다 (칸을 옮길 때의 update와 같다)
  $effect(() => {
    void backgroundColor;
    untrack(edited);
  });
  // 저장 방식을 바꿔도 결과가 바뀐다
  $effect(() => {
    void output;
    untrack(edited);
  });

  /** 지금 그릴 배경 (바꾸지 않거나 아직 나누지 못했으면 없다) */
  const backdrop = $derived<Backdrop | undefined>(
    backgroundColor && matte.kind === 'ready'
      ? { color: backgroundColor, cutout: matte.cutout }
      : undefined,
  );

  // 미리보기 그리기
  let canvas: HTMLCanvasElement | undefined = $state();
  $effect(() => {
    if (!canvas || !photo) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(VIEW_W * ratio);
    canvas.height = Math.round(VIEW_H * ratio);
    const k = photo.preview.width / photo.width;
    drawCrop(
      canvas.getContext('2d')!,
      photo.preview,
      { ...placement, cx: placement.cx * k, cy: placement.cy * k, height: placement.height * k },
      canvas.width,
      canvas.height,
      backdrop,
    );
  });

  function update(next: Placement) {
    placement = next;
    edited();
  }

  /**
   * 결과가 바뀔 때마다 늘어난다. 저장하는 사이에 바뀌면 끝난 저장을 지금 결과로 안내하지 않는다
   * (받은 파일은 누른 때의 결과다)
   */
  let edits = 0;
  /** 결과가 바뀌었다: 지난번에 받은 결과 안내를 지운다 */
  function edited() {
    edits++;
    saved = undefined;
    saveFailed = false;
  }

  /** 사진을 칸 안에서 옮긴다 (dx, dy: 칸 높이에 대한 비율, 오른쪽·아래가 +) */
  function move(dx: number, dy: number) {
    const { angle, height } = placement;
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    // 사진이 오른쪽으로 가면 칸은 사진 위에서 왼쪽으로 간다 (좌우를 뒤집었으면 거꾸로)
    const du = (placement.flip ? dx : -dx) * height;
    const dv = -dy * height;
    update({
      ...placement,
      cx: placement.cx + du * ux - dv * uy,
      cy: placement.cy + du * uy + dv * ux,
    });
  }
  /** 사진을 키운다 (factor > 1이면 얼굴이 커진다) */
  function zoom(factor: number) {
    const limit = Math.max(photo?.width ?? 1, photo?.height ?? 1) * 3;
    update({ ...placement, height: Math.min(limit, Math.max(16, placement.height / factor)) });
  }
  /** 사진을 돌린다 (degrees > 0이면 화면에서 시계 반대 방향, 좌우를 뒤집었으면 원본에서는 거꾸로) */
  function rotate(degrees: number) {
    const sign = placement.flip ? -1 : 1;
    update({ ...placement, angle: placement.angle + (sign * degrees * Math.PI) / 180 });
  }

  /** 좌우를 뒤집는다. 휴대폰 앞 카메라는 거울처럼 뒤집힌 사진을 남기기도 한다 */
  function flip() {
    update({ ...placement, flip: !placement.flip });
  }

  /** 처음 칸으로 되돌린다 (좌우 반전은 사진의 성질이라 그대로 둔다) */
  function reset() {
    const { flip } = placement;
    if (find.kind === 'found') update({ ...find.auto, flip });
    else if (photo) update({ ...centerPlace(photo.width, photo.height), flip });
  }

  function onkeydown(event: KeyboardEvent) {
    const step = event.shiftKey ? 0.05 : 0.01;
    const actions: Record<string, () => void> = {
      ArrowLeft: () => move(-step, 0),
      ArrowRight: () => move(step, 0),
      ArrowUp: () => move(0, -step),
      ArrowDown: () => move(0, step),
      '+': () => zoom(1.02),
      '=': () => zoom(1.02),
      '-': () => zoom(1 / 1.02),
      '[': () => rotate(0.5),
      ']': () => rotate(-0.5),
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  }

  let dragging: { x: number; y: number } | undefined;
  function onpointerdown(event: PointerEvent) {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    dragging = { x: event.clientX, y: event.clientY };
  }
  function onpointermove(event: PointerEvent) {
    if (!dragging) return;
    move((event.clientX - dragging.x) / VIEW_H, (event.clientY - dragging.y) / VIEW_H);
    dragging = { x: event.clientX, y: event.clientY };
  }
  function onpointerup() {
    dragging = undefined;
  }

  /**
   * 배경을 바꾸기로 했는데 그 배경을 그릴 수 없으면(나누는 중, 나누지 못함, 칸을 나눈 영역 밖으로 옮겨 다시 나눠야 함)
   * 저장하지 않는다. 저장하면 화면과 달리 원래 배경이나 예전 영역으로 저장된다
   */
  const busy = $derived(
    background !== 'original' &&
      !(
        matte.kind === 'ready' &&
        photo &&
        matteCovers(matte.matte, placement, photo.width, photo.height)
      ),
  );

  const head = $derived(find.kind === 'found' ? headLength(find.face, placement) : undefined);
  // 화면에서 보이는 기울기 (좌우를 뒤집으면 방향도 뒤집힌다)
  const degrees = $derived(
    (((placement.flip ? -1 : 1) * placement.angle * 180) / Math.PI)
      .toFixed(1)
      .replace('-0.0', '0.0'),
  );
  const checks = $derived.by(() => {
    if (!photo) return [];
    const list: string[] = [];
    if (find.kind === 'found') {
      if (find.faces > 1) list.push(t.checkTwoFaces);
      if (Math.abs(find.face.turn) > 0.15) list.push(t.checkTurned);
      if (!find.face.crownFound) list.push(t.checkCrown);
      if (head !== undefined && (head < SPEC.headMinMm || head > SPEC.headMaxMm)) {
        list.push(t.checkHead);
      }
    }
    if (backgroundColor) {
      list.push(t.checkReplaced);
      if (backgroundColor !== BACKGROUNDS.white) list.push(t.checkNotWhite);
    } else if (!whiteBackground(photo.thumb)) list.push(t.checkBackground);
    if (placement.height < SPEC.outHeight) list.push(t.checkSmall);
    if (outside(placement, photo.width, photo.height)) list.push(t.checkOutside);
    return list;
  });

  async function save() {
    const current = photo;
    if (!current || find.kind === 'finding' || busy) return;
    const entitlement = await canUse('image/id-photo');
    if (!entitlement.allowed) return;
    const version = edits;
    try {
      const wanted = output;
      const { bytes, fits } = await photos.export(
        placement,
        wanted,
        backgroundColor && matte.kind === 'ready'
          ? { color: backgroundColor, matte: matte.matte }
          : undefined,
      );
      if (current !== photo) return;
      const suffix = wanted.size === 'print' ? t.suffixPrint : t.suffix;
      const [extension, type] =
        wanted.format === 'png' ? ['png', 'image/png'] : ['jpg', 'image/jpeg'];
      downloadFile(bytes, `${baseName(current.name)}_${suffix}.${extension}`, type);
      if (version === edits) {
        saved = { size: bytes.length, fits, ...outputSize(wanted), output: wanted };
      }
    } catch {
      if (current === photo && version === edits) saveFailed = true;
    }
  }

  const guideTop = `${(SPEC.topMm / SPEC.heightMm) * 100}%`;
  const chinTop = `${((SPEC.topMm + SPEC.headMinMm) / SPEC.heightMm) * 100}%`;
  const chinHeight = `${((SPEC.headMaxMm - SPEC.headMinMm) / SPEC.heightMm) * 100}%`;
</script>

<div class="tool">
  {#if phase === 'ready' && photo}
    <div class="filebar">
      <span class="name" title={photo.name}>{photo.name}</span>
      <span class="meta">{photo.width}×{photo.height}</span>
      <button type="button" class="btn" onclick={() => close()}>{t.otherFile}</button>
    </div>

    <ActionBar label={t.bar}>
      {#snippet text()}
        {#if saveFailed}
          <strong>{t.saveFailed}</strong>
        {:else if saved}
          {t.saved(
            `${saved.width}×${saved.height}`,
            saved.output.format === 'png' ? 'PNG' : 'JPG',
            formatSize(saved.size),
          )}
          {#if !saved.fits && saved.output.maxBytes}
            <strong
              >{saved.output.format === 'png'
                ? t.pngOver(formatSize(saved.output.maxBytes))
                : t.jpegOver(formatSize(saved.output.maxBytes))}</strong
            >
          {/if}
        {:else if find.kind === 'finding'}
          {t.finding}
        {:else if busy}
          {#if matte.kind === 'failed'}
            <strong>{t.separateFailed}</strong>
          {:else}
            {t.separating}
          {/if}
        {:else if find.kind === 'found'}
          {t.found}
        {:else if find.kind === 'none'}
          {t.noFace}
        {:else if find.kind === 'failed'}
          {t.findFailed}
        {:else}
          {t.manualReady}
        {/if}
      {/snippet}
      <button
        type="button"
        class="btn primary"
        disabled={find.kind === 'finding' || busy}
        onclick={save}>{t.download(format === 'png' ? 'PNG' : 'JPG')}</button
      >
    </ActionBar>

    <div class="tool-body">
      <div class="layout">
        <div class="stage">
          <!-- 끌기·방향키로 사진을 옮기는 칸 (같은 일을 하는 버튼도 옆에 있다) -->
          <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
          <div
            class="view"
            role="application"
            tabindex="0"
            aria-label={t.preview}
            aria-describedby="view-help"
            {onkeydown}
            {onpointerdown}
            {onpointermove}
            {onpointerup}
            onpointercancel={onpointerup}
          >
            <canvas bind:this={canvas}></canvas>
            <span class="guide top" style:top={guideTop}></span>
            <span class="guide chin" style:top={chinTop} style:height={chinHeight}></span>
            <span class="guide center"></span>
          </div>
          <ul class="legend">
            <li><span class="key top"></span>{t.guideTop}</li>
            <li><span class="key chin"></span>{t.guideChin}</li>
          </ul>
          {#if head !== undefined}
            <p class="measure">{t.head((head / 10).toFixed(1))} <span>{t.headRange}</span></p>
          {/if}
          <p class="help" id="view-help">{t.previewHelp}</p>
        </div>

        <div class="panel">
          {#if data.kind !== 'ready'}
            <section class="data" aria-label={t.dataTitle}>
              {#if data.kind === 'checking'}
                <p>{t.checking}</p>
              {:else}
                <h2>{t.dataTitle}</h2>
                {#if data.kind === 'missing' && data.removed}
                  <p><strong>{t.dataRemoved}</strong></p>
                {/if}
                <p>{t.dataSize(formatSize(needBytes))}</p>
                <p class="help">{t.dataNote}</p>
                {#if data.kind === 'missing' && data.lowSpace}
                  <p class="help">{t.lowSpace}</p>
                {/if}
                {#if data.kind === 'failed'}
                  <p><strong>{t.dataFailed}</strong></p>
                {/if}
                <button
                  type="button"
                  class="btn primary"
                  disabled={data.kind === 'downloading'}
                  onclick={downloadData}
                  >{data.kind === 'downloading'
                    ? t.downloading(data.percent)
                    : t.getData(formatSize(needBytes))}</button
                >
              {/if}
            </section>
          {/if}

          <section class="adjust" aria-label={t.adjust}>
            <div class="row">
              <button type="button" class="btn" onclick={() => zoom(1 / 1.02)}>{t.smaller}</button>
              <button type="button" class="btn" onclick={() => zoom(1.02)}>{t.bigger}</button>
            </div>
            <div class="row">
              <button type="button" class="btn" onclick={() => move(0, -0.01)}>{t.up}</button>
              <button type="button" class="btn" onclick={() => move(0, 0.01)}>{t.down}</button>
              <button type="button" class="btn" onclick={() => move(-0.01, 0)}>{t.left}</button>
              <button type="button" class="btn" onclick={() => move(0.01, 0)}>{t.right}</button>
            </div>
            <div class="row">
              <button type="button" class="btn" onclick={() => rotate(0.5)}>{t.rotateLeft}</button>
              <button type="button" class="btn" onclick={() => rotate(-0.5)}>{t.rotateRight}</button
              >
              <span class="angle">{t.angle(degrees)}</span>
            </div>
            <div class="row">
              <button type="button" class="btn" aria-pressed={placement.flip} onclick={flip}
                >{t.flip}</button
              >
            </div>
            <div class="row">
              <button type="button" class="btn" onclick={reset}
                >{find.kind === 'found' ? t.reset : t.resetManual}</button
              >
            </div>
          </section>

          <section class="background" aria-labelledby="background-title">
            <h2 id="background-title">{t.backgroundTitle}</h2>
            <div class="swatches" role="radiogroup" aria-labelledby="background-title">
              {#each ['original', 'white', 'gray', 'blue'] as const as option (option)}
                <label class:checked={background === option}>
                  <input
                    type="radio"
                    name="background"
                    value={option}
                    bind:group={background}
                    disabled={data.kind !== 'ready'}
                  />
                  <span
                    class="dot"
                    class:original={option === 'original'}
                    style:background-color={option === 'original' ? undefined : BACKGROUNDS[option]}
                  ></span>
                  {t.backgrounds[option]}
                </label>
              {/each}
              <label class:checked={background === 'custom'}>
                <input
                  type="radio"
                  name="background"
                  value="custom"
                  bind:group={background}
                  disabled={data.kind !== 'ready'}
                />
                <span class="dot" style:background-color={customColor}></span>
                {t.backgrounds.custom}
              </label>
            </div>
            {#if background === 'custom'}
              <label class="pick">
                {t.customColor}
                <input type="color" bind:value={customColor} />
              </label>
            {/if}
            {#if data.kind !== 'ready'}
              <p class="help">{t.backgroundNeedsData}</p>
            {:else if background !== 'original' && matte.kind === 'failed'}
              <p class="help"><strong>{t.separateFailed}</strong></p>
              <button type="button" class="btn" onclick={() => setMatte({ kind: 'none' })}
                >{t.retry}</button
              >
            {:else}
              <p class="help">{t.backgroundNote}</p>
            {/if}
          </section>

          <section class="output" aria-labelledby="output-title">
            <h2 id="output-title">{t.outputTitle}</h2>
            <div class="choices">
              <div class="choice" role="radiogroup" aria-label={t.sizeGroup}>
                {#each ['online', 'print'] as const as option (option)}
                  <label class:checked={size === option}>
                    <input type="radio" name="size" value={option} bind:group={size} />
                    {t.sizes[option]}
                  </label>
                {/each}
              </div>
              <div class="choice" role="radiogroup" aria-label={t.formatGroup}>
                {#each ['jpeg', 'png'] as const as option (option)}
                  <label class:checked={format === option}>
                    <input type="radio" name="format" value={option} bind:group={format} />
                    {option === 'png' ? 'PNG' : 'JPG'}
                  </label>
                {/each}
              </div>
              <div class="choice" role="radiogroup" aria-label={t.limitGroup}>
                {#each LIMITS as option (option)}
                  <label class:checked={limit === option}>
                    <input type="radio" name="limit" value={option} bind:group={limit} />
                    {option === 0 ? t.noLimit : `${option}KB`}
                  </label>
                {/each}
              </div>
            </div>
            <p class="help">
              {size === 'print' ? t.printHelp : t.onlineHelp}
              {format === 'png' ? t.pngHelp : t.jpegHelp}
            </p>
          </section>

          <section class="checks" aria-label={t.checksTitle}>
            <h2>{t.checksTitle}</h2>
            {#if checks.length > 0}
              <ul>
                {#each checks as check (check)}
                  <li>{check}</li>
                {/each}
              </ul>
            {/if}
            <p class="help">{t.checksNote}</p>
          </section>
        </div>
      </div>
    </div>
  {:else if phase === 'opening'}
    <p class="status" role="status">{t.opening}</p>
  {:else}
    {#if phase === 'error'}
      <p class="error banner" role="alert">{t.cannotOpen}</p>
    {/if}
    <div class="drop">
      <FileDrop
        accept="image/*"
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
    flex: none;
    width: 245px;
  }
  .panel {
    flex: 1;
    min-width: 260px;
  }
  .view {
    position: relative;
    width: 245px;
    height: 315px;
    border: 1px solid var(--color-line);
    cursor: grab;
    touch-action: none;
    user-select: none;
  }
  .view:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
  .view canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
  .guide {
    position: absolute;
    left: 0;
    right: 0;
    pointer-events: none;
  }
  .guide.top {
    border-top: 1.5px dashed var(--color-accent);
  }
  .guide.chin {
    background: color-mix(in srgb, var(--color-accent) 22%, transparent);
    border-top: 1px solid var(--color-accent);
    border-bottom: 1px solid var(--color-accent);
  }
  .guide.center {
    top: 0;
    bottom: 0;
    left: 50%;
    right: auto;
    border-left: 1px dashed color-mix(in srgb, var(--color-accent) 70%, transparent);
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
    margin: 8px 0 0;
    padding: 0;
    list-style: none;
    font-size: 13px;
    color: var(--color-muted);
  }
  .legend li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .key {
    display: inline-block;
    width: 16px;
    height: 8px;
  }
  .key.top {
    height: 0;
    border-top: 1.5px dashed var(--color-accent);
  }
  .key.chin {
    background: color-mix(in srgb, var(--color-accent) 22%, transparent);
    border: 1px solid var(--color-accent);
  }
  .measure {
    margin: 8px 0 0;
    font-size: 14px;
    font-weight: 600;
  }
  .measure span {
    color: var(--color-muted);
    font-weight: 400;
  }
  .help {
    margin: 8px 0 0;
    font-size: 13px;
    color: var(--color-muted);
  }
  .data,
  .background,
  .output,
  .checks {
    margin-bottom: 16px;
    padding: 16px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius);
  }
  .data h2,
  .background h2,
  .output h2,
  .checks h2 {
    margin: 0 0 8px;
    font-size: 15px;
  }
  .data p {
    margin: 0 0 8px;
    font-size: 14px;
  }
  .checks ul {
    margin: 0;
    padding-left: 18px;
    font-size: 14px;
  }
  .checks li + li {
    margin-top: 4px;
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
  .swatches label:has(input:disabled) {
    color: var(--color-muted);
    cursor: default;
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
  /* 원래 배경: 반으로 나눈 점 */
  .dot.original {
    background: linear-gradient(135deg, var(--color-bg) 50%, var(--color-muted) 50%);
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
  .adjust {
    margin-bottom: 16px;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  .angle {
    font-size: 13px;
    color: var(--color-muted);
  }
</style>
