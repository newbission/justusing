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

  const notifyParent = (type: 'drag-request' | 'drag-ready' | 'drag-end') => {
    if (parent !== window) parent.postMessage({ type }, '*');
  };

  // 끄는 동안 dragover가 계속 온다. 잠시 끊기면(창 밖으로 나감, 취소) 끝난 것으로 본다.
  // dragleave 계산보다 단순하고, 바깥에서 시작된 끌기에도 똑같이 동작한다.
  let lastDragOver = 0;
  let active = false;
  let watch: ReturnType<typeof setInterval> | undefined;

  // 넓어지는 동안 도구 화면 크기를 고정해 다시 그려지거나 늘어나 보이지 않게 한다
  const root = document.getElementById('frame-root');
  const freeze = (size?: { width: number; height: number }) => {
    if (!root) return;
    const { width, height } = size ?? root.getBoundingClientRect();
    root.style.width = `${width}px`;
    root.style.height = `${height}px`;
  };
  const unfreeze = () => {
    root?.style.removeProperty('width');
    root?.style.removeProperty('height');
  };

  const end = () => {
    if (!active) return;
    active = false;
    clearInterval(watch);
    notifyParent('drag-end');
    // 바깥이 frame을 원래 크기로 줄인 다음에 덮개를 걷는다 (넓어진 화면이 비치지 않게)
    const finish = () => {
      clearTimeout(fallback);
      if (active) return; // 그사이 새 끌기가 시작됐으면 덮개를 그대로 둔다
      overlay.hidden = true;
      unfreeze();
    };
    const fallback = setTimeout(finish, 150);
    addEventListener('resize', finish, { once: true });
  };
  const show = (size?: { width: number; height: number }) => {
    lastDragOver = Date.now();
    if (active) return;
    active = true;
    freeze(size);
    overlay.hidden = false;
    watch = setInterval(() => {
      if (Date.now() - lastDragOver > 400) end();
    }, 200);
  };

  addEventListener('message', (event) => {
    if (event.source !== parent || event.data?.type !== 'drag-start') return;
    const { width, height } = event.data;
    show(typeof width === 'number' && typeof height === 'number' ? { width, height } : undefined);
    notifyParent('drag-ready');
  });
  addEventListener('dragover', (event) => {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    // 커서가 바깥 페이지를 거치지 않고 도구 칸으로 바로 들어온 경우: 바깥에 넓혀 달라고 요청한다
    const startedHere = !active;
    show();
    if (startedHere) notifyParent('drag-request');
  });
  addEventListener('drop', (event) => {
    event.preventDefault();
    const files = [...(event.dataTransfer?.files ?? [])];
    end();
    if (files.length > 0) dispatchEvent(new CustomEvent(FILES_EVENT, { detail: files }));
  });
}
