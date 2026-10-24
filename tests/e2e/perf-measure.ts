/**
 * 페이지가 처음 받는 것을 재는 도우미. 성능 예산 E2E(perf-budget.spec.ts)와
 * 사람이 표를 만드는 스크립트(scripts/perf/measure.mjs)가 같이 쓴다.
 */
import { gzipSync } from 'node:zlib';
import type { Page, Response } from '@playwright/test';

export type Kind = 'html' | 'js' | 'css' | 'font' | 'image' | 'other';

export interface Size {
  raw: number;
  gzip: number;
}

export interface Measure {
  /** 종류별 크기 합 */
  byType: Partial<Record<Kind, Size>>;
  /** 받은 파일 (경로 + 크기) */
  files: { path: string; kind: Kind; raw: number; gzip: number }[];
  count: number;
}

export interface Measured {
  /** 바깥 페이지가 받은 것 (도구 frame 안의 요청은 뺀다) */
  outer: Measure;
  /** 도구 frame(iframe)이 받은 것. frame이 없는 페이지는 null */
  frame: Measure | null;
}

/** 재는 페이지 종류. 대표 페이지 하나씩 (영어판·다른 도구는 같은 틀이라 따로 재지 않는다) */
export const PAGES = [
  { kind: 'home', path: '/' },
  { kind: 'category', path: '/pdf/' },
  { kind: 'category', path: '/image/' },
  { kind: 'category', path: '/text/' },
  { kind: 'tool', path: '/pdf/merge/' },
  { kind: 'tool', path: '/image/ocr/' },
  { kind: 'guide-list', path: '/guide/' },
  { kind: 'guide', path: '/guide/compress-pdf/' },
  { kind: 'safety', path: '/safety/' },
] as const;

function kindOf(response: Response): Kind {
  const type = response.request().resourceType();
  if (type === 'document') return 'html';
  if (type === 'script') return 'js';
  if (type === 'stylesheet') return 'css';
  if (type === 'font') return 'font';
  if (type === 'image') return 'image';
  const path = new URL(response.url()).pathname;
  if (/\.m?js$/.test(path)) return 'js';
  if (/\.css$/.test(path)) return 'css';
  return 'other';
}

function summarize(files: Measure['files']): Measure {
  const byType: Measure['byType'] = {};
  for (const f of files) {
    const t = (byType[f.kind] ??= { raw: 0, gzip: 0 });
    t.raw += f.raw;
    t.gzip += f.gzip;
  }
  return { byType, files, count: files.length };
}

/**
 * 주소를 열고 요청이 가만해질 때까지 받은 응답을 모은다. 우리 사이트 파일만 센다
 * (광고·통계 주소는 테스트에서 막거나 빈 응답으로 바꾸고, 외부 업체 크기는 우리가 정할 수 없다).
 * 크기는 응답 내용을 직접 gzip해서 센다 (서버 압축 설정과 상관없이 같은 값).
 */
export async function measurePage(page: Page, url: string): Promise<Measured> {
  const origin = new URL(url).origin;
  const pending: Promise<void>[] = [];
  const outer: Measure['files'] = [];
  const frame: Measure['files'] = [];
  let hasFrame = false;
  const mainFrame = page.mainFrame();
  page.on('response', (response) => {
    if (!response.url().startsWith(origin)) return;
    const isFrame = response.frame() !== mainFrame;
    if (isFrame) hasFrame = true;
    pending.push(
      response.body().then(
        (body) => {
          const path = new URL(response.url()).pathname;
          (isFrame ? frame : outer).push({
            path,
            kind: kindOf(response),
            raw: body.length,
            gzip: gzipSync(body).length,
          });
        },
        () => {},
      ),
    );
  });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForLoadState('networkidle');
  // 늦게 시작하는 요청(보이는 때 부르는 그림·frame 안의 스크립트)을 기다린다
  await page.waitForTimeout(1500);
  await page.waitForLoadState('networkidle');
  await Promise.all(pending);
  return { outer: summarize(outer), frame: hasFrame ? summarize(frame) : null };
}
