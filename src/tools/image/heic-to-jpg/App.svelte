<!--
  HEIC 변환 도구 화면 (격리 frame 안에서 실행). 아이폰 사진(HEIC·HEIF)을 JPG·PNG·WebP로 바꾼다.
  화면은 형식 변환과 같다 (ConvertTool). 브라우저가 HEIC를 못 읽으면 libheif로 연다 (src/lib/image/heif.ts).
-->
<script lang="ts">
  import { pick } from '../../../frame/locale';
  import ConvertTool from '../../../lib/image/ConvertTool.svelte';
  import { MESSAGES } from './messages';

  /** 파일 고르기 창에는 HEIC만 보이게 한다 (끌어다 놓은 다른 이미지도 바꿀 수는 있다) */
  const ACCEPT = '.heic,.heif,image/heic,image/heif';
</script>

<ConvertTool tool="image/heic-to-jpg" t={pick(MESSAGES)} accept={ACCEPT} />
