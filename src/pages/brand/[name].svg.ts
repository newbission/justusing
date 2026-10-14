/**
 * 로고 내려받기용 SVG (/brand/mark.svg, /brand/lockup-light.svg, /brand/lockup-dark.svg).
 * 광고·검색 서비스 설정처럼 로고 파일을 올려야 할 때 쓴다. PNG는 같은 폴더의 public/brand/에 있다.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { lockupSvg, markSvg } from '../../brand/logo';

const FILES = {
  mark: markSvg,
  'lockup-light': () => lockupSvg('light'),
  'lockup-dark': () => lockupSvg('dark'),
} as const;

export const getStaticPaths = (() =>
  Object.keys(FILES).map((name) => ({ params: { name } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ params }) =>
  new Response(FILES[params.name as keyof typeof FILES](), {
    headers: { 'Content-Type': 'image/svg+xml' },
  });
