/**
 * 도구 데이터(글꼴·OCR 데이터)를 바깥 페이지 보관소에서 받는다 (src/lib/data-store.ts).
 *
 * frame은 출처가 없어 저장소를 쓸 수 없고 브라우저 캐시도 방문마다 비워진다. 그래서 바깥 페이지가
 * 보관·내려받기를 맡고, frame은 받은 바이트가 빌드 때 적어 둔 SHA-256과 같은지 확인한 뒤에만 쓴다.
 * 바깥 페이지에는 광고 스크립트도 있으므로, 확인을 거치지 않은 데이터는 절대 쓰지 않는다.
 *
 * 요청에는 우리 사이트의 공개 파일 경로만 담긴다 (사용자 파일·파일 이름은 담지 않는다).
 */
import type { DataRequest, DataResponse } from '../lib/data-store';

export interface DataFile {
  path: string;
  bytes: number;
  sha256: string;
}

export interface DataStatus {
  /** 보관된 파일 경로 */
  cached: Set<string>;
  /** 전에 받기로 한 적이 있는지 */
  consented: boolean;
  /** 남은 저장 공간 (바이트). 알 수 없으면 없다 */
  available?: number;
}

export class DataIntegrityError extends Error {}

let nextId = 0;
/** 보관소가 있는 바깥 페이지 (도구 페이지 안에서 열렸을 때만) */
const store = parent !== window ? parent : undefined;

/** 요청 종류마다 id를 뺀 모양 (유니온에 Omit을 바로 쓰면 종류별 속성이 사라진다) */
type WithoutId<T> = T extends unknown ? Omit<T, 'id'> : never;

function ask(
  request: WithoutId<DataRequest>,
  onProgress?: (loaded: number) => void,
): Promise<DataResponse> {
  const id = nextId++;
  return new Promise((resolve) => {
    const listener = (event: MessageEvent<DataResponse>) => {
      if (event.source !== store || event.data?.id !== id) return;
      if (event.data.type === 'data-progress') {
        onProgress?.(event.data.loaded);
        return;
      }
      removeEventListener('message', listener);
      resolve(event.data);
    };
    addEventListener('message', listener);
    store!.postMessage({ ...request, id }, '*');
  });
}

/** 파일들이 보관돼 있는지 묻는다 */
export async function dataStatus(files: DataFile[], consent: string): Promise<DataStatus> {
  if (!store) return { cached: new Set(), consented: false };
  const response = await ask({ type: 'data-status', paths: files.map((f) => f.path), consent });
  if (response.type !== 'data-status') return { cached: new Set(), consented: false };
  return {
    cached: new Set(response.cached),
    consented: response.consented,
    available: response.available,
  };
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * 파일들을 받는다 (보관본이 있으면 보관본, 없으면 내려받아 보관). 확인을 통과한 바이트만 돌려준다.
 * onProgress(loaded): 이번에 새로 받은 바이트 수
 */
export async function loadData(
  files: DataFile[],
  consent: string,
  onProgress?: (loaded: number) => void,
): Promise<Map<string, Uint8Array>> {
  let received: { path: string; bytes: Uint8Array }[];
  if (store) {
    const response = await ask(
      {
        type: 'data-get',
        paths: files.map((f) => f.path),
        hashes: files.map((f) => f.sha256),
        consent,
      },
      onProgress,
    );
    if (response.type !== 'data-files') throw new Error('data unavailable');
    received = response.files;
  } else {
    // 도구 화면을 따로 열었을 때 (개발 중): 보관 없이 바로 받는다
    received = await Promise.all(
      files.map(async (file) => ({
        path: file.path,
        bytes: new Uint8Array(await (await fetch(file.path)).arrayBuffer()),
      })),
    );
  }
  const result = new Map<string, Uint8Array>();
  for (const file of files) {
    const bytes = received.find((entry) => entry.path === file.path)?.bytes;
    if (!bytes || bytes.length !== file.bytes || (await sha256(bytes)) !== file.sha256) {
      throw new DataIntegrityError(file.path);
    }
    result.set(file.path, bytes);
  }
  return result;
}
