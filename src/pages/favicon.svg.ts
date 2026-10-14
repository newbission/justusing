/** favicon. 모양은 src/brand/logo.ts에서 가져온다. */
import type { APIRoute } from 'astro';
import { markSvg } from '../brand/logo';

export const GET: APIRoute = () =>
  new Response(markSvg(), { headers: { 'Content-Type': 'image/svg+xml' } });
