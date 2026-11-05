/**
 * 요청 ID로 결과를 나누는 워커. 실패한 시작은 보관하지 않고, 워커 오류는 대기 중인
 * 요청을 모두 끝낸다. 다음 실행은 새 워커로 한다 (작업 자체를 자동 재실행하지 않는다).
 */
import { createWorker } from './worker';

type WithoutId<T> = T extends unknown ? Omit<T, 'id'> : never;
type Reply = { id: number; kind: string };

export function createWorkerClient<Request extends { id: number }, Response extends Reply>(
  scriptUrl: string,
) {
  type Pending = {
    resolve: (response: Response) => void;
    reject: (error: unknown) => void;
    onProgress?: (response: Extract<Response, { kind: 'progress' }>) => void;
  };
  const pending = new Map<number, Pending>();
  let starting: Promise<Worker> | undefined;
  let current: Worker | undefined;
  let nextId = 0;

  function fail(worker: Worker) {
    if (current !== worker) return;
    current = undefined;
    starting = undefined;
    worker.terminate();
    for (const request of pending.values()) request.reject(new Error('worker unavailable'));
    pending.clear();
  }

  function getWorker(): Promise<Worker> {
    if (starting) return starting;
    const creation = createWorker(scriptUrl)
      .then((worker) => {
        current = worker;
        worker.addEventListener('error', () => fail(worker));
        worker.addEventListener('messageerror', () => fail(worker));
        worker.addEventListener('message', (event: MessageEvent<Response>) => {
          const response = event.data;
          const request = pending.get(response.id);
          if (!request) return;
          if (response.kind === 'progress') {
            try {
              request.onProgress?.(response as Extract<Response, { kind: 'progress' }>);
            } catch (error) {
              pending.delete(response.id);
              request.reject(error);
            }
            return;
          }
          pending.delete(response.id);
          request.resolve(response);
        });
        return worker;
      })
      .catch((error: unknown) => {
        if (starting === creation) starting = undefined;
        throw error;
      });
    starting = creation;
    return creation;
  }

  return async (
    request: WithoutId<Request>,
    options: { transfer?: Transferable[]; onProgress?: Pending['onProgress'] } = {},
  ): Promise<Response> => {
    const worker = await getWorker();
    if (current !== worker) throw new Error('worker unavailable');
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject, onProgress: options.onProgress });
      try {
        worker.postMessage({ ...request, id }, options.transfer ?? []);
      } catch (error) {
        pending.delete(id);
        reject(error);
      }
    });
  };
}
