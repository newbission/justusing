<!--
  동영상 하나를 열어 다루는 도구의 공통 틀 (자르기·용량 줄이기·소리 뽑기).
  파일 고르기 → 여는 중(워커가 그릇·트랙·코덱을 읽음) → 파일 이름 막대 + 도구 화면.
  도구는 연 동영상을 받아 화면만 그린다. 파일은 어디로도 전송되지 않는다.
-->
<script module lang="ts">
  import type { VideoInfo } from './types';

  /** 연 동영상. 새 파일을 열 때마다 새 객체가 된다 */
  export interface LoadedVideo {
    file: File;
    name: string;
    info: VideoInfo;
    /** 미리보기용 blob URL (닫으면 해제한다) */
    url: string;
  }
</script>

<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import FileDrop from '../../frame/FileDrop.svelte';
  import { onFrameFiles } from '../../frame/drop';
  import { formatSize } from '../../frame/format';
  import { pick } from '../../frame/locale';
  import { requestShowTool } from '../../frame/parent';
  import { VIDEO_MESSAGES, codecName } from './messages';
  import { formatTime } from './time';
  import { VideoError, probeVideo } from './video';

  const t = pick(VIDEO_MESSAGES);

  interface Props {
    /** 이 도구에 꼭 있어야 하는 트랙 */
    needs: 'video' | 'audio';
    /** 첫 화면 버튼 아래 안내 */
    hint: string;
    onload: (video: LoadedVideo) => void;
    /** 연 동영상을 닫을 때. 도구는 진행 중인 처리를 그만둔다 */
    onclose?: () => void;
    children: Snippet<[LoadedVideo]>;
  }

  let { needs, hint, onload, onclose, children }: Props = $props();

  type Phase = 'idle' | 'opening' | 'error' | 'ready';
  let phase = $state<Phase>('idle');
  let error = $state('');
  let loaded = $state.raw<LoadedVideo>();
  /** 새 파일을 열거나 닫을 때마다 늘어난다. 늦게 끝난 예전 열기가 지금 파일을 덮어쓰지 않게 한다 */
  let generation = 0;

  onMount(() => {
    const off = onFrameFiles(([file]) => {
      if (file) void open(file);
    });
    return () => {
      off();
      if (loaded) URL.revokeObjectURL(loaded.url);
    };
  });

  async function open(file: File) {
    close();
    const ticket = generation;
    phase = 'opening';
    try {
      const info = await probeVideo(file);
      if (ticket !== generation) return;
      const track = needs === 'video' ? info.video : info.audio;
      if (!track || track.codec === null) {
        // 코덱을 모르면(MPEG-4 Part 2 같은 예전 코덱) 옮기지도 풀지도 못한다
        error = !track
          ? needs === 'video'
            ? t.noVideo
            : t.noAudio
          : needs === 'video'
            ? t.unknownCodec
            : t.unknownAudioCodec;
        phase = 'error';
        return;
      }
      loaded = { file, name: file.name, info, url: URL.createObjectURL(file) };
      phase = 'ready';
      onload(loaded);
      requestShowTool();
    } catch (reason) {
      if (ticket !== generation) return;
      error =
        reason instanceof VideoError && reason.reason === 'noTrack'
          ? needs === 'video'
            ? t.noVideo
            : t.noAudio
          : t.cannotOpen;
      phase = 'error';
    }
  }

  function close() {
    generation++;
    if (loaded) {
      onclose?.();
      URL.revokeObjectURL(loaded.url);
    }
    loaded = undefined;
    phase = 'idle';
  }

  /** 파일 이름 막대의 정보: 길이 · 크기, 그리고 화면 크기·코덱, 소리 코덱 */
  const details = $derived.by(() => {
    if (!loaded) return '';
    const { info } = loaded;
    const parts = [formatTime(info.duration), formatSize(info.size)];
    if (info.video) {
      parts.push(`${info.video.width}×${info.video.height}`, codecName(info.video.codec));
    }
    parts.push(info.audio ? codecName(info.audio.codec) : t.noSound);
    return parts.join(' · ');
  });
</script>

<div class="tool">
  {#if phase === 'ready' && loaded}
    <div class="filebar">
      <span class="name" title={loaded.name}>{loaded.name}</span>
      <span class="meta">{details}</span>
      <button type="button" class="btn" onclick={close}>{t.otherFile}</button>
    </div>
    {@render children(loaded)}
  {:else if phase === 'opening'}
    <p class="status" role="status">{t.opening}</p>
  {:else}
    {#if phase === 'error'}
      <p class="banner" role="alert">{error}</p>
    {/if}
    <div class="drop">
      <FileDrop
        accept="video/*,.mp4,.m4v,.mov,.webm,.mkv"
        label={t.choose}
        {hint}
        onfiles={([file]) => file && open(file)}
      />
    </div>
  {/if}
</div>

<style>
  .tool {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--color-surface);
  }
  .filebar {
    display: flex;
    flex: none;
    align-items: center;
    gap: 12px;
    height: 48px;
    padding: 0 16px;
    border-bottom: 1px solid var(--color-line);
    font-size: 14px;
  }
  .filebar .name {
    overflow: hidden;
    font-weight: 600;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .filebar .meta {
    flex: 1;
    overflow: hidden;
    color: var(--color-muted);
    white-space: nowrap;
    text-overflow: ellipsis;
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
    flex: 1;
    padding: 16px;
  }
</style>
