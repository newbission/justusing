<!--
  파일 선택 + 끌어다 놓기. 모든 도구가 처음 화면에서 쓰는 공통 부품.
  고른 파일은 onfiles로 넘길 뿐 어디에도 보내지 않는다.
-->
<script lang="ts">
  interface Props {
    /** input accept 값 (예: 'application/pdf,.pdf') */
    accept: string;
    /** 버튼 글자 (예: 'PDF 파일 선택') */
    label: string;
    multiple?: boolean;
    /** 버튼 아래 작은 안내 */
    hint?: string;
    onfiles: (files: File[]) => void;
  }

  let { accept, label, multiple = false, hint, onfiles }: Props = $props();
  let dragging = $state(false);

  function pick(list: FileList | null | undefined) {
    const files = [...(list ?? [])];
    if (files.length > 0) onfiles(multiple ? files : files.slice(0, 1));
  }
</script>

<div
  class="drop"
  class:dragging
  role="region"
  aria-label="파일 놓는 곳"
  ondragover={(event) => {
    event.preventDefault();
    dragging = true;
  }}
  ondragleave={() => (dragging = false)}
  ondrop={(event) => {
    event.preventDefault();
    dragging = false;
    pick(event.dataTransfer?.files);
  }}
>
  <p class="title">파일을 여기로 끌어다 놓거나</p>
  <label class="button">
    {label}
    <input
      type="file"
      class="visually-hidden"
      {accept}
      {multiple}
      onchange={(event) => {
        pick(event.currentTarget.files);
        // 같은 파일을 다시 골라도 change가 일어나도록 비운다
        event.currentTarget.value = '';
      }}
    />
  </label>
  {#if hint}
    <p class="hint">{hint}</p>
  {/if}
</div>

<style>
  .drop {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    height: 100%;
    padding: 24px;
    border: 2px dashed var(--color-line);
    border-radius: var(--radius);
    text-align: center;
  }
  .drop.dragging {
    border-color: var(--color-accent);
  }
  .title {
    margin: 0;
    color: var(--color-muted);
  }
  .button {
    display: inline-flex;
    align-items: center;
    height: 48px;
    padding: 0 24px;
    border-radius: var(--radius);
    background: var(--color-text);
    color: var(--color-bg);
    font-weight: 600;
    cursor: pointer;
  }
  /* 숨긴 input에 키보드 포커스가 오면 버튼에 테두리를 그린다 */
  .button:has(input:focus-visible) {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
  .hint {
    margin: 0;
    color: var(--color-muted);
    font-size: 13px;
  }
</style>
