/**
 * 만든 파일을 내려받게 한다. Blob URL + <a download>만 쓴다 (네트워크 요청 없음).
 * 격리 frame의 sandbox에 allow-downloads가 있어 frame 안에서 바로 받을 수 있다.
 */
export function downloadFile(bytes: Uint8Array, fileName: string, type = 'application/pdf') {
  const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  // 브라우저가 내려받기를 시작할 시간을 준 뒤 메모리를 돌려준다
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
