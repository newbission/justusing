<!--
  도구의 실행·다운로드 막대. 높이가 고정이라 처리 전후에 아래 내용이 밀리지 않는다.
  모바일 하단 고정 광고와 멀도록 도구 화면 위쪽에 둔다.
  버튼 모양은 도구가 정한다 (막대는 자리만 잡는다).
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    /** 막대 이름 (스크린리더용, 예: '합치기') */
    label: string;
    /** 진행·완료·오류 안내. 바뀌면 스크린리더가 읽는다 */
    text: Snippet;
    /** 실행·다운로드 버튼 */
    children: Snippet;
  }

  let { label, text, children }: Props = $props();
</script>

<div class="action" role="group" aria-label={label} data-action-bar>
  <p class="action-text" aria-live="polite">{@render text()}</p>
  {@render children()}
</div>

<style>
  .action {
    display: flex;
    flex: none;
    align-items: center;
    gap: 12px;
    height: 64px;
    padding: 0 16px;
    border-bottom: 1px solid var(--color-line);
  }
  /* 좁은 화면에서도 안내를 다 읽을 수 있게 두 줄까지 보여 준다 (막대 높이는 그대로) */
  .action-text {
    display: -webkit-box;
    flex: 1;
    min-width: 0;
    margin: 0;
    overflow: hidden;
    color: var(--color-muted);
    font-size: 14px;
    line-height: 1.35;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }
  .action-text :global(strong) {
    color: var(--color-text);
  }

  /* 좁은 화면: 안내를 위 줄, 버튼을 아래 줄에 나란히 둔다 (높이는 처리 전후 같음) */
  @media (max-width: 520px) {
    .action {
      flex-wrap: wrap;
      align-content: center;
      row-gap: 8px;
      height: 112px;
    }
    .action-text {
      flex-basis: 100%;
    }
    .action > :global(button) {
      flex: 1;
    }
  }
</style>
