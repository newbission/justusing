/**
 * "파일이 기기를 떠나지 않는다"는 약속을 확인하는 검사. 도구마다 같은 기준으로 본다.
 */
import { expect, type Request } from '@playwright/test';

/** 기록한 요청이 모두 우리 사이트로 가는 GET이고 본문이 없는지 확인한다 */
export function expectLocalOnly(requests: Request[], baseURL: string) {
  const origin = new URL(baseURL).origin;
  for (const request of requests) {
    const url = new URL(request.url());
    if (url.protocol === 'blob:' || url.protocol === 'data:') continue;
    expect(url.origin, request.url()).toBe(origin);
    expect(request.method(), request.url()).toBe('GET');
    expect(request.postData(), request.url()).toBeNull();
  }
}
