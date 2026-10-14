/**
 * 도구를 쓰는 순간을 바깥 페이지에 알린다. FrameLayout이 모든 도구 frame에서 실행한다.
 * 바깥 페이지는 이 신호로 광고 차단 안내를 다시 띄운다 (AdblockNotice).
 *
 * 알리는 순간: 파일을 고르거나 놓았을 때, 실행·다운로드 막대(ActionBar)의 버튼을 눌렀을 때.
 * 신호에는 아무 내용도 담지 않는다 (무엇을 골랐는지, 어떤 버튼인지도 보내지 않는다).
 */
import { onFrameFiles } from './drop';
import { notifyActivity } from './parent';

export function setupFrameActivity() {
  onFrameFiles(() => notifyActivity());
  // 도구가 change·click을 처리하며 요소를 바꾸기 전에 먼저 본다 (capture)
  addEventListener(
    'change',
    (event) => {
      if (event.target instanceof HTMLInputElement && event.target.type === 'file') {
        notifyActivity();
      }
    },
    true,
  );
  addEventListener(
    'click',
    (event) => {
      if (event.target instanceof Element && event.target.closest('[data-action-bar] button')) {
        notifyActivity();
      }
    },
    true,
  );
}
