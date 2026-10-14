<!--
  파일 선택 버튼. 모든 도구가 처음 화면에서 쓰는 공통 부품.
  고른 파일은 onfiles로 넘길 뿐 어디에도 보내지 않는다.
  끌어다 놓기는 frame 전체에서 처리한다 (src/frame/drop.ts, 도구는 onFrameFiles로 받음).
-->
<script lang="ts">
  import { pick } from './locale';
  import { FRAME_MESSAGES } from './messages';

  const t = pick(FRAME_MESSAGES);
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

  function choose(list: FileList | null | undefined) {
    const files = [...(list ?? [])];
    if (files.length > 0) onfiles(multiple ? files : files.slice(0, 1));
  }
</script>

<div class="drop">
  <p class="title">{t.drop.title}</p>
  <label class="button">
    {label}
    <input
      type="file"
      class="visually-hidden"
      {accept}
      {multiple}
      onchange={(event) => {
        choose(event.currentTarget.files);
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
  /* 좁은 화면(휴대폰): 버튼을 칸 위쪽에 둔다. 가운데 두면 도구 칸이 길어
     화면 아래 하단 고정 광고와 버튼이 가까워진다. */
  @media (max-width: 767px) {
    .drop {
      justify-content: flex-start;
      padding-top: 96px;
    }
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
