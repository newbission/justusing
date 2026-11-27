<!--
  결과를 다음 도구로 넘기는 '다음 도구로' 버튼 자리 (docs/foundations/tool-chaining).
  결과를 넘길 수 있는 도구가 실행 막대(ActionBar) 안, 받기 버튼 앞에 둔다.
  메뉴(SendMenu)·넘기기 코드·넘길 도구 목록은 이 자리가 처음 그려질 때(파일을 연 뒤) 받는다.
  도구 첫 화면(파일 고르기)에는 이 작은 부품만 실린다. '예시로 따라 하기' 창 안에서는 그리지 않는다.
-->
<script lang="ts">
  import type { Component } from 'svelte';

  interface Props {
    /** 넘길 결과 수 (0이면 누를 수 없다) */
    count: number;
    /** 결과 파일을 만든다 (내려받을 때와 같은 이름·내용) */
    collect: () => Promise<File[]>;
    disabled?: boolean;
  }

  let { count, collect, disabled = false }: Props = $props();
  let Menu = $state.raw<Component<Props>>();

  const touring = new URLSearchParams(location.hash.slice(1)).get('tour') === '1';
  if (!touring) {
    import('./SendMenu.svelte').then(
      (module) => (Menu = module.default),
      // 받지 못하면(연결 끊김 등) 버튼 없이 내려받기만 남는다
      () => {},
    );
  }
</script>

{#if Menu}
  <!-- 속성을 하나씩 넘긴다 ({...props}는 모든 frame이 받는 Svelte 실행 코드를 늘린다) -->
  <Menu {count} {collect} {disabled} />
{/if}
