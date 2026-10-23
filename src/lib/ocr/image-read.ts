/**
 * 사진·화면 캡처 한 장에서 글자를 읽는 순서 (ocr.worker.ts가 엔진을 넘겨 부른다).
 *
 * 1. 엔진에 알맞은 크기로 바꾸고, 기운 글자 줄을 바로 세운다
 * 2. 읽는다. 거의 읽지 못했으면 90°·180°·270° 돌려 작게 읽어 보고 나은 방향으로 다시 읽는다
 * 3. 글자가 작으면(줄 높이 20화소 미만) 키워 다시 읽는다
 * 4. 어두운 바탕과 밝은 바탕이 섞였으면 바탕과 다른 곳만 다시 그려 한 번 더 읽고, 처음에 놓친 줄만 더한다
 *
 * 줄 자리는 처음 그림(방향만 바로 세운 것) 기준의 네 꼭짓점으로 돌려준다.
 * Node에서도 시험할 수 있게 엔진은 넘겨받는다.
 */
import { contrastMap, estimateSkew, mixedBackground, transform, type Gray } from './image-prep';

/** 엔진이 돌려주는 한 줄 (읽은 그림 기준 화소) */
export interface EngineLine {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** 0~100 */
  confidence: number;
  /** 새 문단이 시작되는 줄 */
  paragraph: boolean;
}

export type Recognize = (gray: Gray) => EngineLine[];

/** 읽은 한 줄. corners: 처음 그림 기준 네 꼭짓점 [x, y] × 4 (왼쪽 위부터 시계 방향) */
export interface ImageLine {
  text: string;
  corners: number[];
  confidence: number;
}

export interface ImageText {
  text: string;
  lines: ImageLine[];
  /** 바로 세우려고 돌린 각도 (도, 시계 방향 +) */
  rotation: number;
}

/** 엔진에 넘기는 그림의 화소 수 한도. 크면 느리고 메모리가 모자랄 수 있다 */
const MAX_PIXELS = 8_000_000;
/** 줄 높이가 이보다 작으면 키운다 */
const SMALL_LINE = 20;
/** 키울 때 목표 줄 높이 */
const TARGET_LINE = 32;
/** 방향을 찾을 때 줄여 읽는 크기 (긴 쪽) */
const PROBE_SIDE = 1200;

const LETTER = /[가-힣A-Za-z0-9]/g;
const letters = (text: string) => text.match(LETTER)?.length ?? 0;

/** 믿을 만한 글자 수. 방향·크기를 견줄 때 쓴다 */
function score(lines: EngineLine[]): number {
  return lines
    .filter((line) => line.confidence >= 60)
    .reduce((sum, line) => sum + letters(line.text), 0);
}

const meanConfidence = (lines: EngineLine[]) =>
  lines.length ? lines.reduce((sum, line) => sum + line.confidence, 0) / lines.length : 0;

/** 읽은 그림 하나와 그 그림을 만든 크기·각도 */
interface Pass {
  scale: number;
  angle: number;
  width: number;
  height: number;
  lines: EngineLine[];
}

function read(
  source: Gray,
  recognize: Recognize,
  scale: number,
  angle: number,
  redraw?: (g: Gray) => Gray,
): Pass {
  let gray = transform(source, scale, angle);
  if (redraw) gray = redraw(gray);
  return { scale, angle, width: gray.width, height: gray.height, lines: recognize(gray) };
}

/** 읽은 그림 위 점 → 처음 그림 위 점 (transform을 거꾸로: 가운데를 축으로 되돌리고 크기를 되돌린다) */
function toSource(pass: Pass, source: Gray, x: number, y: number): number[] {
  const radians = (pass.angle * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = x - pass.width / 2;
  const dy = y - pass.height / 2;
  return [
    round((dx * cos + dy * sin) / pass.scale + source.width / 2),
    round((-dx * sin + dy * cos) / pass.scale + source.height / 2),
  ];
}

function place(pass: Pass, source: Gray, line: EngineLine): ImageLine {
  const corners = [
    [line.x0, line.y0],
    [line.x1, line.y0],
    [line.x1, line.y1],
    [line.x0, line.y1],
  ].flatMap(([x, y]) => toSource(pass, source, x!, y!));
  return { text: line.text, corners, confidence: Math.round(line.confidence) };
}

const round = (value: number) => Math.round(value * 10) / 10;

/** 두 상자가 작은 쪽 넓이의 30% 넘게 겹치는지 */
function overlaps(a: EngineLine, b: EngineLine): boolean {
  const width = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const height = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  if (width <= 0 || height <= 0) return false;
  const smaller = Math.min((a.x1 - a.x0) * (a.y1 - a.y0), (b.x1 - b.x0) * (b.y1 - b.y0));
  return width * height > smaller * 0.3;
}

/**
 * 줄 앞뒤에 홀로 붙은 부스러기를 뗀다: 스위치·아이콘이 [ @) 처럼, 말풍선 모서리가 ( ) ' , 처럼 읽힌 것.
 * 괄호·세로줄·따옴표·쉼표·마침표 같은 모양 조각(NOISE)으로만 된 낱말만 떼고, 뜻이 있는 기호
 * ($ ₩ % # + * : 등)는 글자·숫자가 없어도 남긴다. rounded(바탕을 다시 그려 읽은 줄)면 모서리가 i·l로 읽힌 조각도 뗀다
 */
const NOISE = /^[[\](){}<>|'"`‘’“”,.~_=\\/@©®ㆍ·•-]+$/;
function trimEdges(text: string, rounded: boolean): string {
  const junk = (word: string) =>
    NOISE.test(word) || (rounded && /^[il|][^A-Za-z0-9가-힣]*$/.test(word));
  let rest = text.trim();
  for (let first = rest.match(/^\S+/)?.[0]; first && junk(first); first = rest.match(/^\S+/)?.[0]) {
    rest = rest.slice(first.length).trimStart();
  }
  for (let last = rest.match(/\S+$/)?.[0]; last && junk(last); last = rest.match(/\S+$/)?.[0]) {
    rest = rest.slice(0, -last.length).trimEnd();
  }
  return rest;
}

/**
 * 줄들을 글로. 문단 사이는 빈 줄, 줄 끝 공백은 지운다. 한국어 데이터는 낱말 사이 공백을 실제 간격만큼 넣어
 * 표의 칸 사이가 공백 수십 개가 되므로, 셋 이상 이어진 공백은 둘로 줄인다 (칸이 갈린 것은 보이게)
 */
function join(lines: EngineLine[]): string {
  return lines
    .map(
      (line, index) =>
        (index > 0 && line.paragraph ? '\n' : '') + line.text.trimEnd().replace(/ {3,}/g, '  '),
    )
    .join('\n')
    .trim();
}

export function readImage(source: Gray, recognize: Recognize): ImageText {
  const pixels = source.width * source.height;
  const longest = Math.max(source.width, source.height);
  // 큰 사진은 줄이고, 아주 작은 그림(긴 쪽 1000화소 미만)은 키워서 읽는다
  let scale = Math.min(1, Math.sqrt(MAX_PIXELS / pixels));
  if (longest < 1000) scale = Math.min(2.5, 1000 / longest, Math.sqrt(MAX_PIXELS / pixels));

  let angle = -deskew(transform(source, scale, 0));
  let pass = read(source, recognize, scale, angle);

  // 거의 읽지 못했으면 옆으로 누웠거나 뒤집힌 그림일 수 있다
  if (meanConfidence(pass.lines) < 60 || score(pass.lines) < 10) {
    const probe = Math.min(scale, PROBE_SIDE / longest);
    const tries = [0, 90, 180, 270].map((turn) => ({
      turn,
      score: score(read(source, recognize, probe, angle + turn).lines),
    }));
    const best = tries.reduce((a, b) => (b.score > a.score ? b : a));
    if (best.turn !== 0 && best.score > tries[0]!.score * 1.5 + 5) {
      // 돌린 그림에서 기울기를 다시 잰다
      angle = best.turn - deskew(transform(source, scale, best.turn));
      pass = read(source, recognize, scale, angle);
    }
  }

  // 글자가 작으면 키워 다시 읽는다
  const heights = pass.lines.map((line) => line.y1 - line.y0).sort((a, b) => a - b);
  const lineHeight = heights[heights.length >> 1] ?? 0;
  if (lineHeight > 0 && lineHeight < SMALL_LINE) {
    const larger = Math.min(
      scale * Math.min(3, TARGET_LINE / lineHeight),
      Math.sqrt(MAX_PIXELS / pixels),
    );
    if (larger >= scale * 1.3) {
      const again = read(source, recognize, larger, angle);
      if (score(again.lines) >= score(pass.lines)) {
        pass = again;
        scale = larger;
      }
    }
  }

  const lines = clean(pass.lines);

  // 어두운 말풍선처럼 바탕이 다른 곳의 글자를 놓쳤으면 더한다 (같은 크기·각도로 읽어 자리가 같다)
  if (mixedBackground(transform(source, Math.min(scale, PROBE_SIDE / longest), 0))) {
    const extra = read(source, recognize, scale, angle, contrastMap);
    for (const line of extra.lines) {
      const text = trimEdges(line.text, true);
      if (line.confidence < 60 || letters(text) < 2) continue;
      if (pass.lines.some((other) => overlaps(other, line))) continue;
      // 위에서부터 읽는 순서에 끼워 넣고, 다음 줄은 새 문단으로 둔다
      const at = lines.findIndex((other) => other.y0 > line.y0);
      const index = at < 0 ? lines.length : at;
      lines.splice(index, 0, { ...line, text, paragraph: true });
      if (lines[index + 1]) lines[index + 1] = { ...lines[index + 1]!, paragraph: true };
    }
  }

  return {
    text: join(lines),
    lines: lines.map((line) => place(pass, source, line)),
    rotation: -angle,
  };
}

/** 이보다 작게 기운 것은 돌리지 않는다 (엔진이 스스로 견디고, 돌리면 글자가 조금 흐려진다) */
const MIN_SKEW = 3;
const deskew = (gray: Gray) => {
  const skew = estimateSkew(gray);
  return Math.abs(skew) >= MIN_SKEW ? skew : 0;
};

/**
 * 영어 낱말 앞의 홀로 선 | 는 대문자 I를 잘못 읽은 것이다 ("| booked" → "I booked").
 * 줄 앞뒤의 기호 조각(스위치·아이콘을 [ @) 처럼 읽은 것)을 떼고, 빈 줄, 글자가 두 개 이하인 흐릿한 줄,
 * 더 확실한 줄과 겹치는 흐릿한 줄(큰 제목 일부를 따로 잘못 읽은 것)을 뺀다
 */
function clean(lines: EngineLine[]): EngineLine[] {
  const blurred = (line: EngineLine) =>
    line.confidence < 50 &&
    lines.some(
      (other) => other !== line && other.confidence > line.confidence && overlaps(other, line),
    );
  return lines
    .filter((line) => !blurred(line))
    .map((line) => ({
      ...line,
      text: trimEdges(line.text.replace(/(^|\s)\|(?=\s+[A-Za-z])/g, '$1I'), false),
    }))
    .filter((line) => line.text && (letters(line.text) > 2 || line.confidence >= 70));
}
