/**
 * 격리 frame에서 바깥 페이지(ToolFrame.astro)로 보내는 신호.
 * 신호에는 내용(파일 이름·내용)을 절대 담지 않는다. frame은 출처가 없어 대상 출처를 '*'로 보낸다.
 */

/** 도구 칸이 화면을 꽉 채우도록 바깥 페이지를 스크롤해 달라고 요청한다 (파일을 열었을 때) */
export function requestShowTool() {
  if (parent !== window) parent.postMessage({ type: 'show-tool' }, '*');
}

/** 도구를 쓰는 순간임을 알린다 (src/frame/activity.ts). 내용은 아무것도 담지 않는다 */
export function notifyActivity() {
  if (parent !== window) parent.postMessage({ type: 'activity' }, '*');
}
