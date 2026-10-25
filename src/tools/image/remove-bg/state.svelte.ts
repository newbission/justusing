/**
 * 배경 지우기에서 사진마다 기억하는 것. 남길 곳(누른 점)·붓질·되돌리기 순서, 따로 정한 배경 설정, 물체 나누기 결과.
 *
 * 메모리: 원본이나 미리보기 크기의 사진은 들고 있지 않는다. 마스크는 물체 나누기용 크기(긴 변 1024)로,
 * 목록 그림은 작게만 둔다. 원본은 저장할 때 파일에서 다시 읽는다 (cutout.worker.ts).
 */
import type { Look, Mask, Point, Stroke } from '../../../lib/cutout/matte';

/** 처음 남길 곳: 사진 가운데 */
export const CENTER: Point = { x: 0.5, y: 0.5 };
export const WHITE = '#ffffff';

export type BackgroundChoice = 'none' | 'white' | 'custom';

/** 가장자리·배경·물체에 맞춰 자르기. 모든 사진에 같이 주고, 사진마다 따로 정할 수도 있다 */
export class Settings {
  shift = $state(0);
  soft = $state(0);
  background = $state<BackgroundChoice>('none');
  color = $state('#dbe7f3');
  trim = $state(false);

  /** 배경색 (투명이면 없음) */
  get backgroundColor(): string | undefined {
    return this.background === 'none'
      ? undefined
      : this.background === 'white'
        ? WHITE
        : this.color;
  }

  /** 바뀌었는지 견줄 값 */
  get key(): string {
    return `${this.shift}:${this.soft}:${this.backgroundColor ?? ''}:${this.trim}`;
  }

  copy(): Settings {
    const next = new Settings();
    next.shift = this.shift;
    next.soft = this.soft;
    next.background = this.background;
    next.color = this.color;
    next.trim = this.trim;
    return next;
  }
}

export type Separation = 'waiting' | 'working' | 'ready' | 'failed';

let nextId = 0;

/** 사진 한 장 */
export class Entry {
  /** 사진 번호 (워커에 사진을 가리킬 때 쓴다. 다시 쓰지 않는다) */
  readonly id = nextId++;
  readonly file: File;
  /** 읽는 중, 읽음, 열 수 없음 */
  status = $state<'loading' | 'ready' | 'error'>('loading');
  /** 바로 세운 원본의 가로·세로 */
  width = $state(0);
  height = $state(0);
  /** 남길 곳(누른 점)과 붓질, 되돌리기 순서 */
  points = $state.raw<Point[]>([CENTER]);
  strokes = $state.raw<Stroke[]>([]);
  history = $state.raw<('point' | 'stroke')[]>(['point']);
  /** 남길 곳·붓질을 바꿀 때마다 늘어난다 (목록 그림을 다시 그린다) */
  edits = $state(0);
  /** 이 사진만 따로 정한 설정 (없으면 모든 사진에 같은 설정) */
  own = $state.raw<Settings>();
  separation = $state<Separation>('waiting');
  /** 모델이 아무 물체도 남기지 못했다 */
  empty = $state(false);
  /** 마스크가 바뀔 때마다 늘어난다 */
  maskVersion = $state(0);
  /** 목록 그림 바탕 (작게 줄인 사진) */
  base = $state.raw<ImageBitmap>();
  /** 목록에 보일 결과 그림 */
  result = $state.raw<ImageBitmap>();

  /** 지금 points로 나눈 마스크 (물체 나누기용 사진 크기) */
  mask: Mask | undefined;
  /** 목록에서 뺐다 (늦게 끝난 일이 결과를 남기지 않게) */
  removed = false;

  constructor(file: File) {
    this.file = file;
  }

  get name(): string {
    return this.file.name;
  }

  /** 읽었다: 크기와 목록 그림 바탕을 넣는다 (먼저 넣은 바탕이 있거나 뺀 사진이면 버린다) */
  opened(width: number, height: number, base?: ImageBitmap) {
    this.width = width;
    this.height = height;
    this.status = 'ready';
    if (base && (this.base || this.removed)) base.close();
    else if (base) this.base = base;
  }

  /** 남은 곳이 있는지 (모델이 못 찾았어도 되살리기로 칠했으면 있다) */
  get keepsSomething(): boolean {
    return !this.empty || this.strokes.some((stroke) => stroke.mode === 'restore');
  }

  addPoint(point: Point) {
    this.points = [...this.points, point];
    this.history = [...this.history, 'point'];
    this.edits++;
  }

  addStroke(stroke: Stroke) {
    this.strokes = [...this.strokes, stroke];
    this.history = [...this.history, 'stroke'];
    this.edits++;
  }

  /** 마지막 한 번을 되돌린다. 남길 곳이 바뀌었으면 true */
  undo(): boolean {
    const last = this.history.at(-1);
    if (!last) return false;
    this.history = this.history.slice(0, -1);
    if (last === 'point') this.points = this.points.slice(0, -1);
    else this.strokes = this.strokes.slice(0, -1);
    this.edits++;
    return last === 'point';
  }

  restart() {
    this.points = [CENTER];
    this.strokes = [];
    this.history = ['point'];
    this.edits++;
  }

  /** 고친 것이 있는지 (가운데 한 점만 남긴 처음 그대로가 아님) */
  get edited(): boolean {
    return this.strokes.length > 0 || this.points.length !== 1 || this.points[0] !== CENTER;
  }

  dispose() {
    this.removed = true;
    this.mask = undefined;
    this.base?.close();
    this.base = undefined;
    this.result?.close();
    this.result = undefined;
  }
}

/** 이 사진에 쓸 설정 */
export function settingsOf(entry: Entry, shared: Settings): Settings {
  return entry.own ?? shared;
}

/** 이 사진의 결과 모양 */
export function lookOf(entry: Entry, settings: Settings): Look {
  return {
    edge: { shift: settings.shift, soft: settings.soft },
    strokes: entry.strokes,
    background: settings.backgroundColor,
    trim: settings.trim,
  };
}

/** 마스크 사본 (워커로 넘기면 비워지므로 사진이 들고 있는 것은 넘기지 않는다) */
export function copyMask(mask: Mask): Mask {
  return { data: mask.data.slice(), width: mask.width, height: mask.height };
}
