/**
 * 격리 frame 전체를 파일 놓는 곳으로 만든다. FrameLayout이 모든 도구 frame에서 실행한다.
 *
 * 바깥 페이지는 파일 끌기가 시작되면 이 frame을 화면 전체로 넓히고 'drag-start'를 보낸다
 * (ToolFrame.astro). 그동안 frame은 '여기에 파일을 놓으세요' 화면을 덮어 보여주고,
 * 놓인 파일을 'framefiles' 이벤트로 도구 화면에 넘긴다. 끝나면 'drag-end'로 알려
 * 바깥 페이지가 원래 크기로 돌린다. 파일은 frame 밖으로 나가지 않는다.
 */

const FILES_EVENT = 'framefiles';

/** 도구 화면이 놓인 파일을 받는다. 반환한 함수를 부르면 해제된다. */
export function onFrameFiles(handler: (files: File[]) => void): () => void {
  const listener = (event: Event) => handler((event as CustomEvent<File[]>).detail);
  addEventListener(FILES_EVENT, listener);
  return () => removeEventListener(FILES_EVENT, listener);
}

export function setupFrameDrop() {
  const overlay = document.createElement('div');
  overlay.className = 'frame-drop-overlay';
  overlay.hidden = true;
  overlay.innerHTML =
    '<p><strong>여기에 파일을 놓으세요</strong><span>파일은 이 기기를 떠나지 않습니다</span></p>';
  document.body.append(overlay);

  const notifyParent = (type: 'drag-ready' | 'drag-end') => {
    if (parent !== window) parent.postMessage({ type }, '*');
  };

  // 끄는 동안 dragover가 계속 온다. 잠시 끊기면(창 밖으로 나감, 취소) 끝난 것으로 본다.
  // dragleave 계산보다 단순하고, 바깥에서 시작된 끌기에도 똑같이 동작한다.
  let lastDragOver = 0;
  let watch: ReturnType<typeof setInterval> | undefined;

  const end = () => {
    if (overlay.hidden) return;
    overlay.hidden = true;
    clearInterval(watch);
    notifyParent('drag-end');
  };
  const show = () => {
    lastDragOver = Date.now();
    if (!overlay.hidden) return;
    overlay.hidden = false;
    watch = setInterval(() => {
      if (Date.now() - lastDragOver > 400) end();
    }, 200);
  };

  addEventListener('message', (event) => {
    if (event.source !== parent || event.data?.type !== 'drag-start') return;
    show();
    notifyParent('drag-ready');
  });
  addEventListener('dragover', (event) => {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    show();
  });
  addEventListener('drop', (event) => {
    event.preventDefault();
    const files = [...(event.dataTransfer?.files ?? [])];
    end();
    if (files.length > 0) dispatchEvent(new CustomEvent(FILES_EVENT, { detail: files }));
  });
}
