<!--
  배경 지우기 도구 화면 (격리 frame 안에서 실행). 첫 화면(App.svelte)에서 사진을 고르면 그때 불러온다.
  사진에서 누른 곳(처음에는 가운데)의 물체·사람·동물만 남기고 배경을 지운다. 지우개·되살리기 붓으로 고치고,
  가장자리를 좁히거나 넓히고 부드럽게 다듬는다. 투명 PNG 또는 고른 색 배경의 JPG로 원본 크기 그대로 받는다.
  여러 장을 넣으면 목록에서 사진마다 가운데 물체를 미리 남겨 보여 주고, 장마다 눌러 들어가 고친다 (고친 것은 장마다 기억).
  가장자리·배경은 모든 사진에 같이 주고, 한 사진만 따로 정할 수도 있다. 여러 장은 ZIP 하나로 받는다.
  물체 나누기 데이터는 처음 한 번 받아(크기를 밝히고 묻는다) 이 브라우저에 보관한다. 사진은 어디로도 전송되지 않는다.
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
  import {
    CutoutError,
    CutoutJobs,
    CutoutPhoto,
    jobLimit,
    type CutoutFailure,
    type TrimBox,
  } from '../../../lib/cutout/cutout';
  import type { Point, Stroke } from '../../../lib/cutout/matte';
  import { CUTOUT_CONSENT, CUTOUT_FILES, ObjectFinder } from '../../../lib/cutout/objects';
  import type { OutputType } from '../../../lib/image/process';
  import { makeZip } from '../../../lib/zip';
  import ResultThumb from './ResultThumb.svelte';
  import SettingsPanel from './SettingsPanel.svelte';
  import { CENTER, Entry, Settings, copyMask, lookOf, settingsOf } from './state.svelte';

  interface Props {
    /** 첫 화면(App)에서 고른 파일 */
    initial: File[];
  }

  let { initial }: Props = $props();
  const t = pick(MESSAGES);

  /** 미리보기 사진의 긴 변 (원본은 결과 파일에만 쓴다) */
  const PREVIEW_SIDE = 1600;
  /** 물체 나누기에 넣는 사진의 긴 변 (모델은 512로 줄여 보고, 마스크는 이 크기로 돌려준다) */
  const ANALYSIS_SIDE = 1024;
  /** 목록 그림의 긴 변 (화면에는 그 절반 크기로 보인다) */
  const THUMB_SIDE = 320;
  /** 미리보기 칸의 가장 큰 높이 (CSS 픽셀) */
  const VIEW_MAX_HEIGHT = 480;
  /** 이보다 짧게 끌면(CSS 픽셀) 누르기로 본다 */
  const CLICK_SLOP = 6;
  /** 남길 물체로 볼 만한 곳이 이보다 적으면 찾지 못한 것으로 본다 */
  const MIN_COVERAGE = 0.002;
  /** JPG 화질 (배경을 칠한 결과) */
  const QUALITY = 0.92;
  const BRUSH_MIN = 1;
  const BRUSH_MAX = 12;

  /** 브라우저가 읽는 사진과 HEIC (HEIC는 브라우저가 못 읽으면 libheif로 연다) */
  const ACCEPT = 'image/*,.heic,.heif,.avif';
  /** 넣은 사진. 읽기(크기·목록 그림 바탕)와 나누기는 워커가 하고, 화면 스레드에서 원본을 풀지 않는다 */
  let entries = $state.raw<Entry[]>([]);
  /** 모든 사진에 같이 쓰는 가장자리·배경 */
  const shared = new Settings();
  /** 목록에서 골라 연 사진 */
  let editing = $state.raw<Entry>();
  /** 한 장만 넣었는데 열 수 없었다 */
  let cannotOpen = $state(false);
  /** 고치는 화면에 보일 사진: 목록에서 고른 사진, 한 장뿐이면 그 사진 */
  const current = $derived(editing ?? (entries.length === 1 ? entries[0] : undefined));

  type Data =
    | { kind: 'checking' }
    | { kind: 'missing'; removed: boolean; lowSpace: boolean }
    | { kind: 'downloading'; percent: number }
    | { kind: 'failed' }
    | { kind: 'ready' };
  let data = $state<Data>({ kind: 'checking' });
  const totalBytes = CUTOUT_FILES.reduce((sum, file) => sum + file.bytes, 0);
  /** 받아야 할 크기 (증명사진에서 엔진을 받았으면 모델만) */
  let needBytes = $state(totalBytes);

  let finder: Promise<ObjectFinder> | undefined;
  /** 지금 쓰는 엔진 (실패한 엔진만 버리려고 견준다) */
  let finderValue: ObjectFinder | undefined;
  /** 고치는 사진 한 장의 미리보기 워커 */
  const photos = new CutoutPhoto();
  /** 미리 나눌 사진 만들기·목록 그림·저장 (CPU 수에 맞춘 워커 여러 개) */
  const jobs = new CutoutJobs();

  /** 받은 데이터로 엔진을 띄운다 (엔진이 바이트를 넘겨받아 비운다) */
  function startFinder(bytes: Promise<Map<string, Uint8Array>>) {
    const started = bytes.then((value) => ObjectFinder.create(value));
    started.then(
      (value) => {
        if (finder === started) finderValue = value;
      },
      () => {
        if (finder === started) finder = undefined;
      },
    );
    finder = started;
    finderValue = undefined;
    return started;
  }

  /** 엔진을 버린다 (워커가 죽었을 수 있다). 다음에는 보관본으로 다시 띄운다. 그사이 새로 띄웠으면 그대로 둔다 */
  function dropFinder(failed?: ObjectFinder) {
    if (failed && failed !== finderValue) return;
    finder?.then((value) => value.dispose()).catch(() => {});
    finder = undefined;
    finderValue = undefined;
  }

  onMount(() => {
    dataStatus(CUTOUT_FILES, CUTOUT_CONSENT).then((status) => {
      const missing = missingData(CUTOUT_FILES, status);
      const lowSpace = status.available !== undefined && status.available < missing.bytes * 2;
      needBytes = missing.bytes;
      data =
        missing.bytes === 0
          ? { kind: 'ready' }
          : { kind: 'missing', removed: missing.removed, lowSpace };
    });
    const off = onFrameFiles(add);
    add(initial);
    return () => {
      off();
      dropFinder();
      photos.dispose();
      jobs.dispose();
      releasePhoto();
      for (const entry of entries) entry.dispose();
    };
  });

  async function downloadData() {
    data = { kind: 'downloading', percent: 0 };
    try {
      const bytes = await loadData(CUTOUT_FILES, CUTOUT_CONSENT, (received) => {
        data = {
          kind: 'downloading',
          percent: Math.min(99, Math.floor((received / Math.max(1, needBytes)) * 100)),
        };
      });
      // 받은 바이트로 바로 띄운다. 보관소를 쓸 수 없는 창(시크릿 모드 등)에서 다시 받지 않게 한다
      startFinder(Promise.resolve(bytes));
      data = { kind: 'ready' };
    } catch {
      data = { kind: 'failed' };
    }
  }

  // 사진 넣기·빼기. 형식으로 거르지 않고 읽어 보아 못 읽으면 '열 수 없음'으로 둔다
  function add(files: File[]) {
    if (zip.kind === 'saving' || files.length === 0) return;
    const first = entries.length === 0;
    entries = [...entries, ...files.map((file) => new Entry(file))];
    cannotOpen = false;
    if (first) requestShowTool();
  }

  /** 뺀 사진은 메모리를 돌려주고, 늦게 끝난 일이 결과를 남기지 않게 한다 */
  function remove(entry: Entry) {
    entries = entries.filter((other) => other !== entry);
    entry.dispose();
    if (editing === entry) editing = undefined;
  }

  function removeAll() {
    editing = undefined;
    for (const entry of entries) entry.dispose();
    entries = [];
  }

  // 한 장만 넣었는데 열 수 없으면 빼고 알린다 (여러 장이면 목록에 '열 수 없음'으로 남긴다)
  $effect(() => {
    const only = entries.length === 1 ? entries[0] : undefined;
    if (only?.status !== 'error') return;
    untrack(() => {
      remove(only);
      cannotOpen = true;
    });
  });

  // 고치는 화면의 사진
  interface Photo {
    entry: Entry;
    /** 바로 세운 원본의 가로·세로 */
    width: number;
    height: number;
    preview: ImageBitmap;
    /** 물체 나누기용으로 줄인 사진 (엔진에 넘길 때마다 사본을 만든다) */
    analysis: ImageBitmap;
  }
  type Phase = 'idle' | 'opening' | 'error' | 'ready';
  let phase = $state<Phase>('idle');
  let photo = $state.raw<Photo>();
  /** 고치는 사진을 열거나 닫을 때마다 늘어난다. 늦게 끝난 예전 작업이 지금 사진을 덮어쓰지 않게 한다 */
  let generation = 0;
  /** 미리보기 워커에 넘긴 이 사진의 마스크 판 (0이면 아직 없음) */
  let shownMask = $state(0);
  /** 고치는 화면을 마지막으로 연 사진 */
  let openedFor: Entry | undefined;

  $effect(() => {
    const entry = current;
    untrack(() => {
      if (entry === openedFor) return;
      openedFor = entry;
      if (entry) openPhoto(entry);
      else closePhoto();
    });
  });

  function releasePhoto() {
    photo?.preview.close();
    photo?.analysis.close();
    photo = undefined;
  }

  function closePhoto() {
    generation++;
    releasePhoto();
    shownMask = 0;
    box = undefined;
    showOriginal = false;
    painting = undefined;
    pressed = undefined;
    save = { kind: 'idle' };
    phase = 'idle';
  }

  async function openPhoto(entry: Entry) {
    closePhoto();
    const ticket = generation;
    phase = 'opening';
    try {
      const opened = await photos.open(entry.id, entry.file, PREVIEW_SIDE, ANALYSIS_SIDE);
      if (ticket !== generation) {
        opened.preview.close();
        opened.analysis.close();
        return;
      }
      photo = { entry, ...opened };
      phase = 'ready';
      requestShowTool();
      // 목록이 아직 읽지 않은 사진이면 연 것으로 크기와 목록 그림 바탕을 채운다 (같은 사진을 두 번 풀지 않게)
      if (entry.status !== 'ready' || !entry.base) {
        entry.opened(opened.width, opened.height, await shrink(opened.preview, THUMB_SIDE));
      }
      if (ticket !== generation) return;
      if (entry.mask) pushMask(entry);
      else if (data.kind === 'ready' && entry.separation === 'waiting') separate(entry);
    } catch {
      if (ticket !== generation) return;
      // 한 장뿐이면 첫 화면으로 돌아가 알린다. 여러 장이면 이 화면에서 알리고 목록으로 돌아가게 한다
      entry.status = 'error';
      if (!editing) {
        remove(entry);
        cannotOpen = true;
      } else {
        phase = 'error';
      }
    }
  }

  async function shrink(image: ImageBitmap, side: number) {
    const scale = Math.min(1, side / Math.max(image.width, image.height));
    return createImageBitmap(image, {
      resizeWidth: Math.max(1, Math.round(image.width * scale)),
      resizeHeight: Math.max(1, Math.round(image.height * scale)),
      resizeQuality: 'high',
    });
  }

  /** 사진의 마스크를 미리보기 워커에 넘긴다 (그 사진을 고치고 있을 때만). 늦게 끝난 예전 판은 쓰지 않는다 */
  async function pushMask(entry: Entry) {
    if (photo?.entry !== entry || !entry.mask) return;
    const version = entry.maskVersion;
    try {
      await photos.setMask(entry.id, copyMask(entry.mask));
    } catch {
      return;
    }
    if (photo?.entry === entry && entry.maskVersion === version) shownMask = version;
  }

  // 물체 나누기
  /** 나누고 있는 사진과, 그사이 남길 곳이 바뀌어 다시 나눌 사진 */
  const running = new Set<Entry>();
  const again = new Set<Entry>();

  /**
   * 사진을 워커에서 읽어 크기와 목록 그림 바탕을 채운다. withAnalysis면 물체 나누기용 사진도 함께 만들어 돌려준다
   * (나누기 전에 다시 풀지 않게). 읽지 못했거나 그사이 뺐으면 ok가 false (읽지 못하면 '열 수 없음')
   */
  async function read(
    entry: Entry,
    withAnalysis: boolean,
  ): Promise<{ ok: boolean; analysis?: ImageBitmap }> {
    let prepared;
    try {
      prepared = await jobs.prepare(
        entry.file,
        withAnalysis ? ANALYSIS_SIDE : 0,
        entry.base ? 0 : THUMB_SIDE,
      );
    } catch {
      if (!entry.removed && entry.status === 'loading') entry.status = 'error';
      return { ok: false };
    }
    entry.opened(prepared.width, prepared.height, prepared.thumb);
    if (entry.removed) {
      prepared.analysis?.close();
      return { ok: false };
    }
    return { ok: true, analysis: prepared.analysis };
  }

  /** 물체 나누기용 사진. 고치는 사진이면 열어 둔 것의 사본, 아니면 파일에서 다시 읽는다 */
  async function analysisFor(entry: Entry): Promise<ImageBitmap> {
    if (photo?.entry === entry) return createImageBitmap(photo.analysis);
    const { analysis } = await read(entry, true);
    if (!analysis) throw new Error('decode');
    return analysis;
  }

  /**
   * 사진 한 장의 남길 곳마다 물체를 나눠 겹친다. 사진마다 한 번에 하나만 돌고, 그사이 바뀐 것은 끝난 뒤 다시 한다.
   * 결과는 그 사진에만 넣는다. 엔진에는 사진 번호를 함께 보내 다른 사진의 그림·마스크로 나누지 않는다
   */
  async function separate(entry: Entry, ready?: ImageBitmap) {
    if (running.has(entry)) {
      ready?.close();
      again.add(entry);
      return;
    }
    running.add(entry);
    /** 미리 읽어 둔 나누기용 사진 (처음 한 번만 쓴다) */
    let first = ready;
    try {
      do {
        again.delete(entry);
        if (entry.removed) break;
        const wanted = entry.points;
        entry.separation = 'working';
        let found: ObjectFinder | undefined;
        try {
          found = await (finder ?? startFinder(loadData(CUTOUT_FILES, CUTOUT_CONSENT)));
          const supplied = first;
          first = undefined;
          let result = await found.segment(entry.id, wanted, supplied);
          if (result === 'needImage') {
            let image: ImageBitmap;
            try {
              image = await analysisFor(entry);
            } catch (error) {
              // 사진을 다시 읽지 못했다 (엔진 탓이 아니다)
              found = undefined;
              throw error;
            }
            if (entry.removed) {
              image.close();
              break;
            }
            result = await found.segment(entry.id, wanted, image);
          }
          if (result === 'needImage') throw new Error('stale');
          // 그사이 남길 곳이 바뀌었으면 이 결과는 버리고 다시 나눈다
          if (entry.removed || entry.points !== wanted) continue;
          entry.mask = result.mask;
          entry.empty = result.coverage < MIN_COVERAGE;
          entry.maskVersion++;
          entry.separation = 'ready';
          pushMask(entry);
        } catch {
          if (entry.removed || entry.points !== wanted) continue;
          if (found) dropFinder(found);
          entry.separation = 'failed';
        }
      } while (again.has(entry));
    } finally {
      first?.close();
      running.delete(entry);
    }
  }

  /**
   * 넣은 사진을 차례로 읽고(크기·목록 그림), 데이터가 있으면 가운데 물체를 미리 남긴다.
   * 동시에 CPU 수에 맞춘 장수만 (엔진은 한 번에 하나씩 돌지만 사진 읽기는 나란히 한다).
   * 고치는 화면에 연 사진은 그 화면이 읽는다 (같은 사진을 두 번 풀지 않게). 나눌 때는 그 화면이 연 나누기용 사진을 쓴다
   */
  const busyEntries = new Set<Entry>();
  function pump() {
    while (busyEntries.size < jobLimit()) {
      const ready = data.kind === 'ready';
      const next = entries.find(
        (entry) =>
          !busyEntries.has(entry) &&
          !running.has(entry) &&
          ((entry.status === 'loading' && entry !== current) ||
            (ready && entry.status === 'ready' && entry.separation === 'waiting')),
      );
      if (!next) return;
      busyEntries.add(next);
      prefetch(next, ready).finally(() => {
        busyEntries.delete(next);
        pump();
      });
    }
  }

  async function prefetch(entry: Entry, ready: boolean) {
    let image: ImageBitmap | undefined;
    if (entry.status === 'loading') {
      const result = await read(entry, ready);
      if (!result.ok) return;
      image = result.analysis;
    }
    if (ready && entry.separation === 'waiting' && !entry.removed) await separate(entry, image);
    else image?.close();
  }

  $effect(() => {
    void [data.kind, current];
    for (const entry of entries) void [entry.separation, entry.status];
    untrack(pump);
  });

  const failedEntries = $derived(
    entries.filter((entry) => entry.status !== 'error' && entry.separation === 'failed'),
  );

  function retry() {
    for (const entry of failedEntries) entry.separation = 'waiting';
    // 고치는 사진은 목록이 아니라 이 화면이 나눈다
    if (current?.separation === 'waiting' && photo?.entry === current) separate(current);
    pump();
  }

  // 목록 그림: 마스크·고친 것·설정이 바뀌면 다시 그린다 (워커에서, 사진마다 한 번에 하나)
  const thumbKeys = new WeakMap<Entry, string>();
  const drawing = new Set<Entry>();
  const redraw = new Set<Entry>();

  $effect(() => {
    for (const entry of entries) {
      if (entry.maskVersion === 0) continue;
      const key = `${entry.maskVersion}:${entry.edits}:${settingsOf(entry, shared).key}`;
      if (thumbKeys.get(entry) === key) continue;
      thumbKeys.set(entry, key);
      untrack(() => drawThumb(entry));
    }
  });

  async function drawThumb(entry: Entry) {
    if (drawing.has(entry)) {
      redraw.add(entry);
      return;
    }
    drawing.add(entry);
    try {
      do {
        redraw.delete(entry);
        if (entry.removed || !entry.mask || !entry.base) break;
        const look = { ...lookOf(entry, settingsOf(entry, shared)), trim: false };
        let image: ImageBitmap;
        try {
          image = await jobs.thumb(await createImageBitmap(entry.base), copyMask(entry.mask), look);
        } catch {
          break;
        }
        if (entry.removed) {
          image.close();
          break;
        }
        entry.result?.close();
        entry.result = image;
      } while (redraw.has(entry));
    } finally {
      drawing.delete(entry);
    }
  }

  // 고치는 화면의 설정·결과 모양
  const settings = $derived(current ? settingsOf(current, shared) : shared);
  const look = $derived(current ? lookOf(current, settings) : undefined);
  const formatName = $derived(settings.backgroundColor ? 'JPG' : 'PNG');

  function formatOf(entry: Entry): OutputType {
    return settingsOf(entry, shared).backgroundColor ? 'image/jpeg' : 'image/png';
  }

  /** 이 사진만 따로 정하기를 켜거나 끈다 (켜면 지금 모든 사진의 설정에서 시작한다) */
  function toggleOwn(entry: Entry) {
    entry.own = entry.own ? undefined : shared.copy();
  }

  type Tool = 'pick' | 'erase' | 'restore';
  let tool = $state<Tool>('pick');
  /** 붓 지름 (사진 긴 변의 %) */
  let brush = $state(4);
  let showOriginal = $state(false);

  type Save =
    | { kind: 'idle' }
    | { kind: 'saving' }
    | { kind: 'saved'; size: number; width: number; height: number; format: string }
    | { kind: 'failed'; reason: CutoutFailure };
  let save = $state.raw<Save>({ kind: 'idle' });

  /** 결과가 바뀌었다: 지난번에 받은 결과 안내를 지운다 */
  $effect(() => {
    void look;
    untrack(() => {
      if (save.kind !== 'saving') save = { kind: 'idle' };
    });
  });

  /** 남길 곳을 바꿨으면 그 사진을 다시 나눈다 */
  function editPoints(change: (entry: Entry) => boolean | void) {
    const entry = photo?.entry;
    if (!entry) return;
    if (change(entry) !== false && data.kind === 'ready') separate(entry);
  }

  function addPoint(point: Point) {
    editPoints((entry) => entry.addPoint(point));
  }

  function addStroke(stroke: Stroke) {
    photo?.entry.addStroke(stroke);
  }

  function undo() {
    editPoints((entry) => entry.undo());
  }

  function restart() {
    editPoints((entry) => entry.restart());
  }

  // 미리보기
  const board = $derived(
    photo ? { width: photo.width, height: photo.height } : { width: 1, height: 1 },
  );
  let stageWidth = $state(0);
  const view = $derived.by(() => {
    if (stageWidth === 0) return { width: 0, height: 0 };
    const scale = Math.min(stageWidth / board.width, VIEW_MAX_HEIGHT / board.height);
    return { width: board.width * scale, height: board.height * scale };
  });
  let canvas: HTMLCanvasElement | undefined = $state();
  /** 물체에 맞춰 자를 때 남을 자리 (미리보기에 점선으로) */
  let box = $state.raw<TrimBox>();

  function show(image: ImageBitmap) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  }

  $effect(() => {
    if (!canvas || !photo) return;
    canvas.width = photo.preview.width;
    canvas.height = photo.preview.height;
    show(photo.preview);
    untrack(refresh);
  });

  $effect(() => {
    void look;
    void shownMask;
    void showOriginal;
    untrack(refresh);
  });

  /**
   * 미리보기는 워커가 그린다. 한 번에 하나만 보내고, 그사이 바뀐 것은 끝난 뒤 가장 최근 것 하나만 다시 그린다.
   * 마스크가 없거나 원본을 보고 있으면 원본을 그린다
   */
  let rendering = false;
  let stale = false;
  async function refresh() {
    if (rendering) {
      stale = true;
      return;
    }
    rendering = true;
    try {
      do {
        stale = false;
        const ticket = generation;
        if (!photo || !look) break;
        if (showOriginal || shownMask === 0) {
          show(photo.preview);
          box = undefined;
          continue;
        }
        let drawn: { image: ImageBitmap; box?: TrimBox };
        try {
          drawn = await photos.preview(photo.entry.id, look);
        } catch {
          // 워커가 죽었거나 그사이 다른 사진을 열었다. 미리보기는 지난 그림 그대로 둔다
          continue;
        }
        if (ticket === generation && !showOriginal) {
          show(drawn.image);
          box = drawn.box;
        }
        drawn.image.close();
      } while (stale);
    } finally {
      rendering = false;
    }
  }

  // 누르기·붓질: 화면 자리를 사진 비율 자리로 바꾼다
  let layer: HTMLDivElement | undefined = $state();
  let pressed: { x: number; y: number } | undefined;
  /** 지금 칠하는 붓질 (손을 떼면 붓질 목록에 들어간다) */
  let painting = $state.raw<Stroke>();
  /** 붓 모양을 보여 줄 자리 (포인터가 칸 위에 있을 때) */
  let hover = $state.raw<Point>();
  /** 키보드로 옮기는 자리 (칸에 초점이 있을 때 보인다) */
  let cursor = $state.raw<Point>(CENTER);
  let focused = $state(false);

  const canEdit = $derived(data.kind === 'ready' && phase === 'ready');
  const brushes = $derived(tool !== 'pick' && shownMask > 0);

  function pointAt(event: PointerEvent): Point {
    const rect = layer!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  }

  function onpointerdown(event: PointerEvent) {
    if (event.button !== 0 || !canEdit || save.kind === 'saving') return;
    event.preventDefault();
    layer!.setPointerCapture(event.pointerId);
    if (tool === 'pick') {
      pressed = { x: event.clientX, y: event.clientY };
    } else if (brushes) {
      painting = { mode: tool, size: brush / 100, points: [pointAt(event)] };
    }
  }

  function onpointermove(event: PointerEvent) {
    hover = pointAt(event);
    if (!painting) return;
    const point = pointAt(event);
    const last = painting.points.at(-1)!;
    // 너무 촘촘하게 넣지 않는다 (붓 지름의 1/6마다)
    const distance =
      Math.hypot((point.x - last.x) * board.width, (point.y - last.y) * board.height) /
      Math.max(board.width, board.height);
    if (distance < painting.size / 6) return;
    painting = { ...painting, points: [...painting.points, point] };
  }

  function onpointerup(event: PointerEvent) {
    if (pressed) {
      const moved = Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y);
      if (moved < CLICK_SLOP) addPoint(pointAt(event));
      pressed = undefined;
    }
    if (painting) {
      addStroke(painting);
      painting = undefined;
    }
  }

  function onpointercancel() {
    pressed = undefined;
    painting = undefined;
  }

  function onkeydown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      undo();
      return;
    }
    const step = event.shiftKey ? 0.05 : 0.01;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      cursor = {
        x: Math.min(1, Math.max(0, cursor.x + move[0])),
        y: Math.min(1, Math.max(0, cursor.y + move[1])),
      };
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && canEdit) {
      event.preventDefault();
      if (tool === 'pick') addPoint(cursor);
      else if (brushes) addStroke({ mode: tool, size: brush / 100, points: [cursor] });
    }
  }

  const percent = (value: number) => `${value * 100}%`;
  /** 붓 지름 (화면 픽셀) */
  const brushPixels = $derived((brush / 100) * Math.max(view.width, view.height));

  const canSave = $derived(
    data.kind === 'ready' &&
      current?.separation === 'ready' &&
      shownMask > 0 &&
      save.kind !== 'saving',
  );

  /** 사진 한 장을 원본 크기로 저장한다. 그 사진의 파일·마스크·모양을 함께 넘겨 다른 사진과 섞이지 않는다 */
  async function exportOne(entry: Entry, signal?: AbortSignal) {
    const type = formatOf(entry);
    const look = lookOf(entry, settingsOf(entry, shared));
    const saved = await jobs.export(entry.file, copyMask(entry.mask!), look, type, QUALITY, signal);
    const extension = type === 'image/png' ? 'png' : 'jpg';
    return { ...saved, type, name: `${baseName(entry.name)}_${t.suffix}.${extension}` };
  }

  function failure(error: unknown): CutoutFailure {
    if (!(error instanceof CutoutError)) return 'tooLarge';
    return error.reason === 'stale' ? 'decode' : error.reason;
  }

  async function download() {
    const entry = photo?.entry;
    if (!entry?.mask || !canSave) return;
    const entitlement = await canUse('image/remove-bg');
    if (!entitlement.allowed) return;
    const ticket = generation;
    const name = formatName;
    save = { kind: 'saving' };
    try {
      const saved = await exportOne(entry);
      if (ticket !== generation) return;
      downloadFile(saved.bytes, saved.name, saved.type);
      save = {
        kind: 'saved',
        size: saved.bytes.length,
        width: saved.width,
        height: saved.height,
        format: name,
      };
    } catch (error) {
      if (ticket !== generation) return;
      save = { kind: 'failed', reason: failure(error) };
    }
  }

  // 여러 장 받기
  type Zip =
    | { kind: 'idle' }
    | { kind: 'saving'; done: number; total: number }
    | {
        kind: 'saved';
        count: number;
        size: number;
        /** 한 장만 받았을 때 그 가로·세로와 형식 */
        single?: { pixels: string; format: string };
      }
    | { kind: 'stopped' }
    | { kind: 'failed'; reason: CutoutFailure };
  let zip = $state.raw<Zip>({ kind: 'idle' });
  let stopper: AbortController | undefined;
  const busy = $derived(zip.kind === 'saving');

  /** 받을 수 있는 사진: 읽었고, 물체를 나눴고, 남은 곳이 있다 */
  const exportable = $derived(
    entries.filter(
      (entry) => entry.status === 'ready' && entry.separation === 'ready' && entry.keepsSomething,
    ),
  );
  /** 아직 읽거나 나누는 중인 사진 */
  const pending = $derived(
    entries.filter(
      (entry) =>
        entry.status === 'loading' ||
        (entry.status === 'ready' &&
          (entry.separation === 'waiting' || entry.separation === 'working')),
    ).length,
  );
  const separated = $derived(
    entries.filter((entry) => entry.status === 'ready' && entry.separation === 'ready').length,
  );
  const totalSize = $derived(entries.reduce((sum, entry) => sum + entry.file.size, 0));
  /** 열 수 있는 사진 수 */
  const openable = $derived(entries.filter((entry) => entry.status !== 'error').length);
  const canSaveAll = $derived(
    data.kind === 'ready' && pending === 0 && exportable.length > 0 && !busy,
  );
  const onlyFormat = $derived(
    exportable.length === 1 && formatOf(exportable[0]!) === 'image/jpeg' ? 'JPG' : 'PNG',
  );

  // 무엇이든 바뀌면 지난번에 받은 결과 안내를 지운다
  $effect(() => {
    void [shared.key, entries];
    for (const entry of entries) void [entry.edits, entry.own?.key, entry.maskVersion];
    untrack(() => {
      if (zip.kind !== 'saving') zip = { kind: 'idle' };
    });
  });

  async function downloadAll() {
    if (!canSaveAll) return;
    const entitlement = await canUse('image/remove-bg');
    if (!entitlement.allowed) return;
    const controller = new AbortController();
    stopper = controller;
    const list = [...exportable];
    zip = { kind: 'saving', done: 0, total: list.length };
    try {
      let done = 0;
      // 저장 워커 수만큼만 동시에 돈다 (CutoutJobs). 넣은 순서대로 담는다
      const files = await Promise.all(
        list.map(async (entry) => {
          const saved = await exportOne(entry, controller.signal);
          done++;
          if (!controller.signal.aborted) zip = { kind: 'saving', done, total: list.length };
          return saved;
        }),
      );
      if (controller.signal.aborted) return;
      if (files.length === 1) {
        const only = files[0]!;
        downloadFile(only.bytes, only.name, only.type);
        zip = {
          kind: 'saved',
          count: 1,
          size: only.bytes.length,
          single: {
            pixels: `${only.width}×${only.height}`,
            format: only.type === 'image/png' ? 'PNG' : 'JPG',
          },
        };
        return;
      }
      const bytes = await makeZip(files.map(({ name, bytes }) => ({ name, bytes })));
      // 묶는 사이 '그만두기'를 눌렀으면 받지 않는다
      if (controller.signal.aborted) return;
      downloadFile(bytes, t.zipName, 'application/zip');
      zip = { kind: 'saved', count: files.length, size: bytes.length };
    } catch (error) {
      if (controller.signal.aborted) return;
      // 하나라도 실패하면 나머지 저장도 그만둔다 (큰 사진을 그리던 메모리를 돌려준다)
      controller.abort();
      zip = { kind: 'failed', reason: failure(error) };
    } finally {
      if (stopper === controller) stopper = undefined;
    }
  }

  function stop() {
    stopper?.abort();
    zip = { kind: 'stopped' };
  }

  const position = $derived(current ? entries.indexOf(current) : -1);

  function openAt(at: number) {
    const next = entries[at];
    if (next) editing = next;
  }

  function itemSize(entry: Entry) {
    return `${entry.width}×${entry.height}`;
  }

  /** 목록 칸의 설명: 크기 · 고친 것 · 따로 정한 설정 */
  function itemSummary(entry: Entry) {
    return [
      itemSize(entry),
      entry.edited && t.count(entry.points.length, entry.strokes.length),
      entry.own && t.itemOwn,
    ]
      .filter(Boolean)
      .join(' · ');
  }
</script>

{#snippet dataBox()}
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
        {#if needBytes < totalBytes}
          <p class="help">{t.dataShared}</p>
        {/if}
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
  {#if failedEntries.length > 0}
    <section aria-label={t.separateFailed}>
      <p class="problem">{t.separateFailed}</p>
      <button type="button" class="btn" onclick={retry}>{t.retry}</button>
    </section>
  {/if}
{/snippet}

{#snippet addButton()}
  <label class="btn" class:disabled={busy}>
    {t.addPhotos}
    <input
      type="file"
      class="visually-hidden"
      accept={ACCEPT}
      multiple
      disabled={busy}
      onchange={(event) => {
        add([...(event.currentTarget.files ?? [])]);
        event.currentTarget.value = '';
      }}
    />
  </label>
{/snippet}

<div class="tool">
  {#if current && phase === 'ready' && photo}
    {@const entry = photo.entry}
    <div class="filebar">
      <span class="name" title={entry.name}>{entry.name}</span>
      <span class="meta"
        >{[`${photo.width}×${photo.height}`, editing && t.position(position + 1, entries.length)]
          .filter(Boolean)
          .join(' · ')}</span
      >
      {#if editing}
        <button
          type="button"
          class="btn icon"
          aria-label={t.previous}
          disabled={position <= 0}
          onclick={() => openAt(position - 1)}>‹</button
        >
        <button
          type="button"
          class="btn icon"
          aria-label={t.next}
          disabled={position >= entries.length - 1}
          onclick={() => openAt(position + 1)}>›</button
        >
        <button type="button" class="btn" onclick={() => (editing = undefined)}
          >{t.backToList}</button
        >
      {:else}
        {@render addButton()}
        <button type="button" class="btn" onclick={removeAll}>{t.otherFile}</button>
      {/if}
    </div>

    <ActionBar label={t.bar}>
      {#snippet text()}
        {#if save.kind === 'failed'}
          <strong>{t.failed[save.reason]}</strong>
        {:else if save.kind === 'saved'}
          {t.saved(`${save.width}×${save.height}`, save.format, formatSize(save.size))}
        {:else if save.kind === 'saving'}
          {t.saving}
        {:else if data.kind !== 'ready'}
          {t.needData}
        {:else if entry.separation === 'failed'}
          <strong>{t.separateFailed}</strong>
        {:else if entry.separation !== 'ready' || shownMask === 0}
          {t.separating}
        {:else if !entry.keepsSomething}
          <strong>{t.empty}</strong>
        {:else if entry.points.length === 1 && entry.points[0] === CENTER}
          {t.separatedCenter}
        {:else}
          {t.separated(entry.points.length)}
        {/if}
      {/snippet}
      <button type="button" class="btn primary" disabled={!canSave} onclick={download}
        >{t.download(formatName)}</button
      >
    </ActionBar>

    <div class="tool-body">
      {@render dataBox()}

      <div class="layout">
        <div class="stage" bind:clientWidth={stageWidth}>
          <div class="view" style:width="{view.width}px" style:height="{view.height}px">
            <canvas bind:this={canvas}></canvas>
            <!-- 누르기·붓질·방향키로 남길 곳을 고르는 칸 (같은 일을 하는 버튼·고르기도 옆에 있다) -->
            <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
            <div
              class="layer {tool}"
              class:off={!canEdit}
              role="application"
              tabindex="0"
              aria-label={t.preview}
              aria-describedby="view-help"
              bind:this={layer}
              {onpointerdown}
              {onpointermove}
              {onpointerup}
              {onpointercancel}
              onpointerleave={() => (hover = undefined)}
              {onkeydown}
              onfocus={() => (focused = true)}
              onblur={() => (focused = false)}
            >
              {#if box && settings.trim && !showOriginal}
                <span
                  class="trim"
                  style:left={percent(box.x)}
                  style:top={percent(box.y)}
                  style:width={percent(box.width)}
                  style:height={percent(box.height)}
                ></span>
              {/if}
              {#if painting}
                <svg
                  class="painting {painting.mode}"
                  viewBox="0 0 {board.width} {board.height}"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <polyline
                    points={painting.points
                      .map((point) => `${point.x * board.width},${point.y * board.height}`)
                      .join(' ')}
                    stroke-width={painting.size * Math.max(board.width, board.height)}
                  />
                </svg>
              {/if}
              {#if canEdit && !showOriginal}
                {#each entry.points as point, index (index)}
                  <span
                    class="point"
                    style:left={percent(point.x)}
                    style:top={percent(point.y)}
                    aria-hidden="true">{index + 1}</span
                  >
                {/each}
              {/if}
              {#if hover && brushes}
                <span
                  class="brush {tool}"
                  style:left={percent(hover.x)}
                  style:top={percent(hover.y)}
                  style:width="{brushPixels}px"
                  style:height="{brushPixels}px"
                  aria-hidden="true"
                ></span>
              {/if}
              {#if focused && canEdit}
                <span
                  class="cursor"
                  class:round={brushes}
                  style:left={percent(cursor.x)}
                  style:top={percent(cursor.y)}
                  style:width={brushes ? `${brushPixels}px` : undefined}
                  style:height={brushes ? `${brushPixels}px` : undefined}
                  aria-hidden="true"
                ></span>
              {/if}
            </div>
          </div>
          <div class="row under">
            <button
              type="button"
              class="btn"
              aria-pressed={showOriginal}
              disabled={shownMask === 0}
              onclick={() => (showOriginal = !showOriginal)}>{t.showOriginal}</button
            >
            <span class="count">{t.count(entry.points.length, entry.strokes.length)}</span>
          </div>
          <p class="help" id="view-help">{t.previewHelp}</p>
        </div>

        <div class="panel">
          <section aria-labelledby="tool-title">
            <h2 id="tool-title">{t.toolTitle}</h2>
            <div class="choice" role="radiogroup" aria-label={t.toolGroup}>
              {#each ['pick', 'erase', 'restore'] as const as option (option)}
                <label class:checked={tool === option}>
                  <input
                    type="radio"
                    name="tool"
                    value={option}
                    bind:group={tool}
                    disabled={!canEdit}
                  />
                  {t.tools[option]}
                </label>
              {/each}
            </div>
            <p class="help">{t.toolHelp[tool]}</p>
            {#if tool !== 'pick'}
              <div class="slider">
                <label for="brush">{t.brushSize}</label>
                <input
                  id="brush"
                  type="range"
                  min={BRUSH_MIN}
                  max={BRUSH_MAX}
                  step="1"
                  bind:value={brush}
                />
                <span class="value">{brush}%</span>
              </div>
            {/if}
            <div class="row">
              <button type="button" class="btn" disabled={entry.history.length === 0} onclick={undo}
                >{t.undo}</button
              >
              <button type="button" class="btn" disabled={!canEdit} onclick={restart}
                >{t.restart}</button
              >
            </div>
          </section>

          {#if entries.length > 1}
            <label class="check own">
              <input
                type="checkbox"
                checked={entry.own !== undefined}
                onchange={() => toggleOwn(entry)}
              />
              {t.ownToggle}
            </label>
            <p class="help own-help">{entry.own ? t.ownHelp.own : t.ownHelp.shared}</p>
          {/if}
          <SettingsPanel {settings} />

          <p class="limits">{t.limits}</p>
        </div>
      </div>
    </div>
  {:else if current && phase === 'error'}
    <p class="banner" role="alert">{t.cannotOpen}</p>
    <div class="drop">
      <button type="button" class="btn" onclick={() => (editing = undefined)}>{t.backToList}</button
      >
    </div>
  {:else if current}
    <p class="status" role="status">{t.opening}</p>
  {:else if entries.length > 0}
    <div class="filebar">
      <span class="meta" aria-live="polite">{t.summary(entries.length, formatSize(totalSize))}</span
      >
      {@render addButton()}
    </div>

    <ActionBar label={t.bar}>
      {#snippet text()}
        {#if zip.kind === 'saving'}
          {t.savingMany(zip.done, zip.total)}
        {:else if zip.kind === 'failed'}
          <strong>{t.failed[zip.reason]}</strong>
        {:else if zip.kind === 'saved'}
          {zip.single
            ? t.saved(zip.single.pixels, zip.single.format, formatSize(zip.size))
            : t.savedMany(zip.count, formatSize(zip.size))}
        {:else if zip.kind === 'stopped'}
          {t.stopped}
        {:else if data.kind !== 'ready'}
          {t.needData}
        {:else if failedEntries.length > 0}
          <strong>{t.separateFailed}</strong>
        {:else if pending > 0}
          {t.separatingMany(separated, openable)}
        {:else if exportable.length === 0}
          <strong>{t.emptyAll}</strong>
        {:else}
          {t.readyMany(exportable.length)}
          {#if exportable.length < entries.length}
            {t.skipped(entries.length - exportable.length)}
          {/if}
        {/if}
      {/snippet}
      {#if busy}
        <button type="button" class="btn primary" onclick={stop}>{t.stop}</button>
      {:else}
        <button type="button" class="btn primary" disabled={!canSaveAll} onclick={downloadAll}
          >{exportable.length === 1
            ? t.download(onlyFormat)
            : t.downloadAll(exportable.length)}</button
        >
      {/if}
    </ActionBar>

    <div class="tool-body">
      {@render dataBox()}

      <div class="layout">
        <ul class="grid" aria-label={t.list}>
          {#each entries as entry (entry.id)}
            <li class="card">
              <div class="thumb">
                <ResultThumb image={entry.result} base={entry.base} />
              </div>
              <span class="name" title={entry.name}>{entry.name}</span>
              <span class="meta">
                {#if entry.status === 'loading'}
                  {t.itemReading}
                {:else if entry.status === 'error'}
                  <strong>{t.itemBroken}</strong>
                {:else if entry.separation === 'failed'}
                  <strong>{t.itemFailed}</strong>
                {:else if entry.separation === 'working'}
                  {t.itemWorking}
                {:else if entry.separation === 'waiting'}
                  {data.kind === 'ready' ? t.itemWaiting : itemSize(entry)}
                {:else if !entry.keepsSomething}
                  <strong>{t.itemEmpty}</strong>
                {:else}
                  {itemSummary(entry)}
                {/if}
              </span>
              <div class="row">
                <button
                  type="button"
                  class="btn"
                  disabled={busy || entry.status === 'error'}
                  aria-label={t.editLabel(entry.name)}
                  onclick={() => (editing = entry)}>{t.edit}</button
                >
                <button
                  type="button"
                  class="btn icon"
                  disabled={busy}
                  aria-label={t.remove(entry.name)}
                  onclick={() => remove(entry)}>×</button
                >
              </div>
            </li>
          {/each}
        </ul>

        <div class="panel">
          <p class="help shared">{t.sharedHelp}</p>
          <SettingsPanel settings={shared} />
          <p class="limits">{t.memoryNote}</p>
        </div>
      </div>
    </div>
  {:else}
    {#if cannotOpen}
      <p class="banner" role="alert">{t.cannotOpen}</p>
    {/if}
    <div class="drop">
      <FileDrop accept={ACCEPT} label={t.choose} hint={t.hint} multiple onfiles={add} />
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
    gap: 8px 12px;
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
  .btn.icon {
    font-size: 18px;
    line-height: 1;
  }
  label.disabled {
    opacity: 0.4;
    cursor: default;
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
  .stage,
  .grid {
    flex: 3 1 320px;
    min-width: 0;
  }
  .panel {
    flex: 2 1 280px;
    min-width: 0;
  }
  .view {
    position: relative;
    margin: 0 auto;
    /* 체크무늬: 지워진(투명한) 곳이 보이게. 두 테마 모두 밝은 칸으로 그려 사진 색과 헷갈리지 않게 한다 */
    background: repeating-conic-gradient(
        color-mix(in srgb, var(--color-paper-text) 14%, var(--color-paper)) 0 25%,
        var(--color-paper) 0 50%
      )
      0 0 / 16px 16px;
    user-select: none;
  }
  .view canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
  .layer {
    position: absolute;
    inset: 0;
    overflow: hidden;
    cursor: crosshair;
    touch-action: none;
  }
  .layer.erase,
  .layer.restore {
    cursor: none;
  }
  .layer.off {
    cursor: default;
  }
  .layer:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
  .point {
    position: absolute;
    width: 22px;
    height: 22px;
    margin: -11px 0 0 -11px;
    border: 2px solid var(--color-paper);
    border-radius: 50%;
    background: var(--color-accent);
    box-shadow: 0 0 0 1px var(--color-redact);
    color: var(--color-paper);
    font-size: 11px;
    font-weight: 700;
    line-height: 18px;
    text-align: center;
    pointer-events: none;
  }
  .brush,
  .cursor {
    position: absolute;
    transform: translate(-50%, -50%);
    border: 2px solid var(--color-paper);
    border-radius: 50%;
    box-shadow:
      0 0 0 1px var(--color-redact),
      inset 0 0 0 1px var(--color-redact);
    pointer-events: none;
  }
  .brush.restore {
    border-color: var(--color-accent);
  }
  /* 키보드 자리: 고르기는 십자, 붓은 붓 크기 동그라미 */
  .cursor:not(.round) {
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 0;
    box-shadow: none;
    background:
      linear-gradient(var(--color-accent), var(--color-accent)) center / 2px 100% no-repeat,
      linear-gradient(var(--color-accent), var(--color-accent)) center / 100% 2px no-repeat;
  }
  .painting {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  .painting polyline {
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
    opacity: 0.45;
  }
  .painting.erase polyline {
    stroke: var(--color-redact);
  }
  .painting.restore polyline {
    stroke: var(--color-accent);
  }
  .trim {
    position: absolute;
    border: 2px dashed var(--color-accent);
    box-shadow: 0 0 0 1px var(--color-paper);
    pointer-events: none;
  }
  .under {
    justify-content: center;
    margin-top: 12px;
  }
  .count {
    color: var(--color-muted);
    font-size: 13px;
  }
  .stage .help {
    margin: 8px 0 0;
    text-align: center;
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
  .data p {
    margin: 0 0 8px;
    font-size: 14px;
  }
  .data .help {
    margin: 0 0 8px;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  section .row {
    margin-top: 12px;
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
  .check {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
  .check input {
    width: 16px;
    height: 16px;
    accent-color: var(--color-accent);
  }
  .own-help,
  .shared {
    margin: 4px 0 12px;
  }
  .limits {
    margin: 0 0 16px;
    padding: 10px 12px;
    border-left: 3px solid var(--color-accent);
    background: var(--color-accent-soft);
    font-size: 13px;
  }
  /* 목록: 사진마다 결과 그림·이름·상태·고치기 */
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    align-content: start;
    gap: 12px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    padding: 8px;
    border: 1px solid var(--color-line);
    border-radius: var(--radius);
  }
  .card .thumb {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 140px;
  }
  .card .name {
    overflow: hidden;
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  /* 상태는 두 줄까지 (칸 높이가 처리 전후로 같게) */
  .card .meta {
    display: -webkit-box;
    height: 2.7em;
    overflow: hidden;
    color: var(--color-muted);
    font-size: 13px;
    line-height: 1.35;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }
  .card .meta :global(strong) {
    color: var(--color-text);
  }
  .card .row {
    justify-content: space-between;
  }
</style>
