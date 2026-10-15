/** 도구 화면에서 쓰는 작은 표시 도우미 */

/** 파일 크기 (예: 12KB, 3.4MB) */
export function formatSize(size: number): string {
  return size < 1024 * 1024
    ? `${Math.max(1, Math.round(size / 1024))}KB`
    : `${(size / 1024 / 1024).toFixed(1)}MB`;
}

/** 확장자를 뺀 파일 이름 (결과 파일 이름을 만들 때) */
export function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, '');
}
