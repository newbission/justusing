/**
 * 도구 데이터 보관소 (바깥 페이지에서 돈다, ToolFrame.astro가 띄운다).
 *
 * 글꼴·OCR 데이터처럼 큰 공개 파일을 브라우저 저장소(Cache API)에 보관해 다음 방문에 다시 받지 않게 한다.
 * 도구 화면(격리 frame)은 출처가 없어 저장소를 쓸 수 없고 브라우저 캐시도 방문마다 비워진다 (크롬에서 확인).
 * 그래서 바깥 페이지가 받고 보관해서 frame에 넘긴다.
 *
 * - 사용자 파일은 여기에 오지 않는다. 다루는 것은 우리 사이트의 공개 파일(DATA_PREFIXES)뿐이다
 * - frame은 받은 바이트의 SHA-256을 확인한 뒤에만 쓴다 (바깥 페이지의 다른 스크립트가 끼어들어도 안전)
 * - 사용자가 한 번 받기로 한 것(동의)을 기억해, 보관본이 지워졌을 때 '다시 받아야 한다'고 알릴 수 있게 한다
 *
 * frame → 바깥: { type: 'data-status', id, paths, consent }   보관 여부 묻기
 *               { type: 'data-get', id, paths, hashes, consent }  받기 (없으면 내려받아 보관)
 * 바깥 → frame: { type: 'data-status', id, cached, consented, available }
 *               { type: 'data-progress', id, loaded, total }
 *               { type: 'data-files', id, files: { path, bytes }[] } | { type: 'data-error', id }
 */

/** 보관할 수 있는 파일 위치. 그 밖의 주소는 받지 않는다 */
const DATA_PREFIXES = ['/data/'];
const CACHE_NAME = 'justusing-data-v1';
/** 받기로 한 데이터 묶음 이름들 (localStorage) */
const CONSENT_KEY = 'data-consent';

export type DataRequest =
  | { type: 'data-status'; id: number; paths: string[]; consent: string }
  | {
      type: 'data-get';
      id: number;
      paths: string[];
      /** 파일마다 기대하는 SHA-256 (paths와 같은 순서). 맞는 것만 보관한다 */
      hashes: string[];
      consent: string;
    };

export type DataResponse =
  | {
      type: 'data-status';
      id: number;
      /** 보관된 파일 경로들 */
      cached: string[];
      /** 전에 이 묶음을 받기로 한 적이 있는지 (보관본이 지워졌는지 알리는 데 쓴다) */
      consented: boolean;
      /** 남은 저장 공간 (바이트). 알 수 없으면 없다 */
      available?: number;
    }
  | { type: 'data-progress'; id: number; loaded: number; total: number }
  | { type: 'data-files'; id: number; files: { path: string; bytes: Uint8Array }[] }
  | { type: 'data-error'; id: number };

const allowed = (path: string) =>
  typeof path === 'string' &&
  DATA_PREFIXES.some((prefix) => path.startsWith(prefix)) &&
  !path.includes('..');

function consents(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(CONSENT_KEY) ?? '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function remember(consent: string) {
  try {
    const list = consents();
    if (!list.includes(consent))
      localStorage.setItem(CONSENT_KEY, JSON.stringify([...list, consent]));
  } catch {
    // 저장소를 못 쓰면 다음에 다시 물을 뿐이다
  }
}

async function openCache(): Promise<Cache | undefined> {
  try {
    return await caches.open(CACHE_NAME);
  } catch {
    // 시크릿 창 등에서 저장소를 쓸 수 없으면 보관 없이 받기만 한다
    return undefined;
  }
}

async function status(paths: string[], consent: string): Promise<DataResponse> {
  const cache = await openCache();
  const cached: string[] = [];
  for (const path of paths) {
    if (cache && (await cache.match(path))) cached.push(path);
  }
  let available: number | undefined;
  try {
    const estimate = await navigator.storage.estimate();
    if (estimate.quota !== undefined && estimate.usage !== undefined) {
      available = estimate.quota - estimate.usage;
    }
  } catch {
    // 알 수 없으면 묻지 않고 받아 본다
  }
  return {
    type: 'data-status',
    id: 0,
    cached,
    consented: consents().includes(consent),
    available,
  };
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * 보관본을 쓰고, 없으면 받아서 보관한다. 받는 동안 받은 양을 알린다.
 * 기대한 SHA-256과 다른 것은 보관하지 않고, 보관본이 다르면 지우고 다시 받는다
 * (안 그러면 손상된 보관본을 계속 넘겨 사이트 데이터를 지우기 전까지 그 데이터를 쓸 수 없다).
 * 쓸지 말지는 frame이 다시 확인한다 (src/frame/data.ts).
 */
async function get(
  paths: string[],
  hashes: string[],
  consent: string,
  progress: (loaded: number, total: number) => void,
): Promise<{ path: string; bytes: Uint8Array }[]> {
  const cache = await openCache();
  remember(consent);
  // 브라우저가 공간이 모자랄 때 지우지 않게 부탁한다 (받아 주지 않아도 보관은 된다)
  navigator.storage?.persist?.().catch(() => {});

  const results: { path: string; bytes: Uint8Array }[] = [];
  const missing: string[] = [];
  const expected = new Map(paths.map((path, i) => [path, hashes[i]]));
  for (const path of paths) {
    const hit = cache && (await cache.match(path));
    const bytes = hit ? new Uint8Array(await hit.arrayBuffer()) : undefined;
    if (bytes && (await sha256(bytes)) === expected.get(path)) {
      results.push({ path, bytes });
    } else {
      if (bytes) await cache?.delete(path);
      missing.push(path);
    }
  }

  // 받을 양을 먼저 알아야 진행률을 보여 줄 수 있다
  const responses = await Promise.all(
    missing.map(async (path) => {
      const response = await fetch(path);
      if (!response.ok || !response.body) throw new Error(`${response.status} ${path}`);
      return { path, response };
    }),
  );
  const total = responses.reduce(
    (sum, { response }) => sum + Number(response.headers.get('content-length') ?? 0),
    0,
  );
  let loaded = 0;
  for (const { path, response } of responses) {
    const reader = response.body!.getReader();
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.length;
      progress(loaded, Math.max(total, loaded));
    }
    const bytes = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    if ((await sha256(bytes)) === expected.get(path)) {
      await cache?.put(path, new Response(bytes.slice())).catch(() => {});
    }
    results.push({ path, bytes });
  }
  return results;
}

/** frame이 보내는 데이터 요청에 답한다. 그 frame이 보낸 메시지만 받는다 */
export function serveData(frame: HTMLIFrameElement) {
  addEventListener('message', async (event) => {
    if (event.source !== frame.contentWindow) return;
    const request = event.data as DataRequest;
    if (request?.type !== 'data-status' && request?.type !== 'data-get') return;
    const reply = (response: DataResponse, transfer: Transferable[] = []) =>
      frame.contentWindow?.postMessage(response, '*', transfer);
    const { id, consent } = request;
    const paths = Array.isArray(request.paths) ? request.paths : [];
    if (paths.length === 0 || !paths.every(allowed) || typeof consent !== 'string') {
      reply({ type: 'data-error', id });
      return;
    }
    try {
      if (request.type === 'data-status') {
        reply({ ...(await status(paths, consent)), id } as DataResponse);
        return;
      }
      const hashes = Array.isArray(request.hashes) ? request.hashes : [];
      const files = await get(paths, hashes, consent, (loaded, total) =>
        reply({ type: 'data-progress', id, loaded, total }),
      );
      reply(
        { type: 'data-files', id, files },
        files.map((file) => file.bytes.buffer),
      );
    } catch {
      reply({ type: 'data-error', id });
    }
  });
}
