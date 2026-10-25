<!--
  PDF 서명 넣기 도구 화면 (격리 frame 안에서 실행).
  서명을 그리거나(또는 서명 이미지를 올려) 쪽 위 원하는 자리에 넣는다. 파일은 어디로도 전송되지 않는다.
-->
<script lang="ts">
  import { pick } from '../../../frame/locale';
  import { MESSAGES } from './messages';
  import { embedImage } from '../../../lib/image/embed';
  import SignaturePad from '../../../lib/pdf/SignaturePad.svelte';
  import SinglePdfTool, { type LoadedPdf } from '../../../lib/pdf/SinglePdfTool.svelte';
  import StampTool, { type StampImage } from '../../../lib/pdf/StampTool.svelte';

  const t = pick(MESSAGES);

  let pdf: LoadedPdf | undefined = $state.raw();
  let signature: StampImage | undefined = $state.raw();
  let cannotOpen = $state(false);
  /** 마지막으로 고른(또는 그린) 서명 번호. 앞서 고른 이미지가 늦게 끝나도 덮어쓰지 않게 */
  let latest = 0;

  function onload(loaded: LoadedPdf) {
    pdf = loaded;
  }

  function use(next: StampImage | undefined) {
    latest += 1;
    if (signature) URL.revokeObjectURL(signature.url);
    signature = next;
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    cannotOpen = false;
    const request = ++latest;
    try {
      // 브라우저가 못 읽는 HEIC(서명을 찍은 아이폰 사진)는 JPG로 바꿔 그것을 화면에도 그린다
      const { embed, preview } = await embedImage(file);
      if (request !== latest) return;
      use({ url: URL.createObjectURL(preview), embed });
    } catch {
      if (request === latest) cannotOpen = true;
    }
  }
</script>

<SinglePdfTool {onload} saves>
  {#snippet children()}
    {#if pdf}
      <StampTool
        {pdf}
        image={signature}
        {t}
        toolId="pdf/sign"
        initialPlace={{ x: 0.6, y: 0.8, width: 0.25 }}
      >
        {#snippet picker()}
          <SignaturePad ondone={use} />
          <div class="upload">
            <label class="btn">
              {t.upload}
              <input
                type="file"
                class="visually-hidden"
                accept="image/*,.heic,.heif"
                onchange={(event) => {
                  upload(event.currentTarget.files?.[0]);
                  event.currentTarget.value = '';
                }}
              />
            </label>
            <p class="help">{t.uploadHint}</p>
            {#if cannotOpen}<p class="problem" role="alert">{t.cannotOpen}</p>{/if}
          </div>
        {/snippet}
        {#snippet actions()}
          <button type="button" class="btn" onclick={() => use(undefined)}>{t.redraw}</button>
        {/snippet}
      </StampTool>
    {/if}
  {/snippet}
</SinglePdfTool>

<style>
  .upload {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    margin-top: 24px;
    text-align: center;
  }
</style>
