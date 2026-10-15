<!--
  PDF 이미지 넣기 도구 화면 (격리 frame 안에서 실행).
  PDF를 열고 이미지를 골라 쪽 위 원하는 자리에 넣는다. 파일은 어디로도 전송되지 않는다.
-->
<script lang="ts">
  import { pick } from '../../../frame/locale';
  import { MESSAGES } from './messages';
  import { embedImage } from '../../../lib/image/embed';
  import SinglePdfTool, { type LoadedPdf } from '../../../lib/pdf/SinglePdfTool.svelte';
  import StampTool, { type StampImage } from '../../../lib/pdf/StampTool.svelte';

  const t = pick(MESSAGES);

  let pdf: LoadedPdf | undefined = $state.raw();
  let image: StampImage | undefined = $state.raw();
  let cannotOpen = $state(false);

  function onload(loaded: LoadedPdf) {
    pdf = loaded;
  }

  async function choose(file: File | undefined) {
    if (!file) return;
    cannotOpen = false;
    try {
      // 휴대폰 사진은 바로 세우고, JPG·PNG가 아니면 PNG로 바꾼다 (이미지를 PDF로와 같은 준비, 워커에서)
      const embed = await embedImage(file);
      if (image) URL.revokeObjectURL(image.url);
      image = { url: URL.createObjectURL(file), embed };
    } catch {
      cannotOpen = true;
    }
  }
</script>

{#snippet imageInput(label: string, className: string)}
  <label class={className}>
    {label}
    <input
      type="file"
      class="visually-hidden"
      accept="image/*"
      onchange={(event) => {
        choose(event.currentTarget.files?.[0]);
        event.currentTarget.value = '';
      }}
    />
  </label>
{/snippet}

<SinglePdfTool {onload}>
  {#snippet children()}
    {#if pdf}
      <StampTool
        {pdf}
        {image}
        {t}
        toolId="pdf/add-image"
        initialPlace={{ x: 0.35, y: 0.35, width: 0.3 }}
      >
        {#snippet picker()}
          <div class="picker">
            {@render imageInput(t.choose, 'btn primary')}
            <p class="help">{t.chooseHint}</p>
            {#if cannotOpen}<p class="problem" role="alert">{t.cannotOpen}</p>{/if}
          </div>
        {/snippet}
        {#snippet actions()}
          {@render imageInput(t.otherImage, 'btn')}
          {#if cannotOpen}<p class="problem" role="alert">{t.cannotOpen}</p>{/if}
        {/snippet}
      </StampTool>
    {/if}
  {/snippet}
</SinglePdfTool>

<style>
  .picker {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding-top: 32px;
    text-align: center;
  }
</style>
