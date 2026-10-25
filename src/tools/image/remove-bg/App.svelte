<!--
  배경 지우기 도구의 첫 화면 (격리 frame 안에서 실행). 사진을 고르기 전에는 파일 고르기만 그리고,
  사진을 고르거나 놓으면 그때 도구 화면(Workspace.svelte: 목록·고치기·저장)을 불러온다. 첫 화면을 가볍게 두려고 나눴다.
  파일은 어디로도 보내지 않는다.
-->
<script lang="ts">
  import '../../../frame/controls.css';
  import { onMount, type Component } from 'svelte';
  import FileDrop from '../../../frame/FileDrop.svelte';
  import { onFrameFiles } from '../../../frame/drop';
  import { pick } from '../../../frame/locale';
  import { MESSAGES } from './messages';

  const t = pick(MESSAGES);
  /** 브라우저가 읽는 사진과 HEIC (도구 화면의 ImageBatch와 같다) */
  const ACCEPT = 'image/*,.heic,.heif,.avif';

  let Workspace = $state.raw<Component<{ initial: File[] }>>();
  /** 도구 화면을 불러오는 동안 들어온 파일까지 모아 넘긴다 */
  const initial: File[] = [];
  let loading = $state(false);
  let failed = $state(false);

  async function start(files: File[]) {
    if (files.length === 0) return;
    initial.push(...files);
    if (loading) return;
    loading = true;
    failed = false;
    try {
      Workspace = (await import('./Workspace.svelte')).default;
    } catch {
      initial.length = 0;
      failed = true;
    } finally {
      loading = false;
    }
  }

  // 도구 화면이 뜨면 놓은 파일은 도구 화면이 받는다
  onMount(() =>
    onFrameFiles((files) => {
      if (!Workspace) start(files);
    }),
  );
</script>

{#if Workspace}
  <Workspace {initial} />
{:else if loading}
  <p class="status" role="status">{t.opening}</p>
{:else}
  <div class="tool">
    {#if failed}
      <p class="banner" role="alert">{t.loadFailed}</p>
    {/if}
    <div class="drop">
      <FileDrop accept={ACCEPT} label={t.choose} hint={t.hint} multiple onfiles={start} />
    </div>
  </div>
{/if}

<style>
  .tool {
    height: 100%;
    background: var(--color-surface);
  }
  .status,
  .banner {
    margin: 0;
    padding: 16px;
    font-size: 14px;
  }
  .banner {
    border-bottom: 1px solid var(--color-line);
    font-weight: 600;
  }
  .drop {
    padding: 16px;
  }
</style>
