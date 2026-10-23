<!--
  이미지 형식 변환 도구 화면 (격리 frame 안에서 실행). 화면은 HEIC 변환과 같이 쓴다 (ConvertTool).
-->
<script lang="ts">
  import { pick } from '../../../frame/locale';
  import ConvertTool from '../../../lib/image/ConvertTool.svelte';
  import { MESSAGES } from './messages';
</script>

<ConvertTool tool="image/convert" t={pick(MESSAGES)} />
