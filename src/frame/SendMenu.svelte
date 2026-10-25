<!--
  실행 막대의 '다음 도구로' 버튼과 넘길 도구 목록 (docs/foundations/tool-chaining).
  SendTo.svelte가 결과 화면이 뜰 때 받는다 (도구 첫 화면 무게에 들지 않게).
  모양은 send-menu.css를 <link>로 받는다: 이 부품에 <style>을 두면 Astro가 그 CSS를
  이 부품을 부르는 모든 도구의 첫 화면에 넣는다.
  목록은 popover(맨 위 층)로 띄워 실행 막대·결과 영역의 높이와 자리를 바꾸지 않는다.
-->
<script lang="ts">
  import { tick } from 'svelte';
  import chains from 'virtual:tool-chain';
  import styleUrl from './send-menu.css?url';
  import { CHAIN_MESSAGES } from './chain-messages';
  import { loadStyle, prepareStatus, sendFiles } from './chain';
  import { frameLocale, pick } from './locale';
  import { currentTool } from './tool';

  interface Props {
    /** 넘길 결과 수. 0이면 누를 수 없다. 한 장만 받는 도구는 1일 때만 고를 수 있다 */
    count: number;
    /** 결과 파일을 만든다 (내려받을 때와 같은 이름·내용). 만들지 못하면 던진다 */
    collect: () => Promise<File[]>;
    /** 도구가 처리 중이라 넘길 수 없을 때 */
    disabled?: boolean;
  }

  let { count, collect, disabled = false }: Props = $props();
  const t = pick(CHAIN_MESSAGES);
  const targets = chains[currentTool()] ?? [];
  const panelId = $props.id();

  /** 모양 파일을 받았다 (받기 전에는 버튼을 그리지 않아 모양 없는 버튼이 비치지 않는다) */
  let styled = $state(false);
  let open = $state(false);
  let sending = $state(false);
  let failed = $state(false);
  let trigger: HTMLButtonElement | undefined = $state();
  let panel: HTMLElement | undefined = $state();
  let place = $state({ left: 8, top: 8 });

  type Target = (typeof targets)[number];
  const usable = (target: Target) => count > 0 && (target.multiple || count === 1);
  const blocked = $derived(disabled || count === 0 || !targets.some(usable));

  // 넘긴 뒤 읽어 줄 알림 칸을 미리 만든다 (바꾸는 순간 생기면 화면 읽기가 놓친다)
  prepareStatus();
  loadStyle(styleUrl).then(
    () => (styled = true),
    () => (styled = true),
  );

  function items(): HTMLButtonElement[] {
    return [...(panel?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
  }

  /** 버튼 아래(모자라면 위)에 오른쪽을 맞춰 놓는다 */
  function position() {
    if (!trigger || !panel) return;
    const box = trigger.getBoundingClientRect();
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    const left = Math.max(8, Math.min(box.right - width, innerWidth - width - 8));
    let top = box.bottom + 4;
    if (top + height > innerHeight - 8) top = Math.max(8, box.top - height - 4);
    place = { left, top };
  }

  async function show() {
    if (blocked) return;
    open = true;
    failed = false;
    await tick();
    if (!panel) return;
    // popover를 모르는 브라우저에서는 고정 위치 칸으로 그대로 보인다
    if (typeof panel.showPopover === 'function' && !panel.matches(':popover-open')) {
      panel.showPopover();
    }
    position();
    items()[0]?.focus();
  }

  function hide(returnFocus: boolean) {
    if (!open || sending) return;
    open = false;
    if (returnFocus) trigger?.focus();
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      hide(true);
      return;
    }
    const list = items();
    if (list.length === 0) return;
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    const next = {
      ArrowDown: (at + 1) % list.length,
      ArrowUp: (at - 1 + list.length) % list.length,
      Home: 0,
      End: list.length - 1,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    list[next]?.focus();
  }

  // 목록 밖을 누르거나 포커스가 나가면 닫는다. 창 크기가 바뀌면 자리가 어긋나 닫는다
  $effect(() => {
    if (!open) return;
    const outside = (target: EventTarget | null) =>
      !(target instanceof Node) || !(panel?.contains(target) || trigger?.contains(target));
    const onPointer = (event: PointerEvent) => {
      if (outside(event.target)) hide(false);
    };
    const onFocus = (event: FocusEvent) => {
      if (outside(event.target)) hide(false);
    };
    const onResize = () => hide(false);
    const box = panel;
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('focusin', onFocus);
    addEventListener('resize', onResize);
    box?.addEventListener('keydown', onKeydown);
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('focusin', onFocus);
      removeEventListener('resize', onResize);
      box?.removeEventListener('keydown', onKeydown);
    };
  });

  async function choose(target: Target) {
    if (sending || !usable(target)) return;
    sending = true;
    failed = false;
    try {
      const files = await collect();
      if (files.length === 0) throw new Error('결과가 없습니다');
      const chosen = target.multiple ? files : files.slice(0, 1);
      await sendFiles(target.id, chosen, t.moved(target.name[frameLocale], chosen.length));
      // 여기까지 오면 이 부품은 앞 도구 화면과 함께 내려졌다
    } catch {
      sending = false;
      failed = true;
      await tick();
      items()[0]?.focus();
    }
  }
</script>

{#if styled && targets.length > 0}
  <button
    type="button"
    class="send-menu-trigger"
    bind:this={trigger}
    aria-expanded={open}
    aria-controls={panelId}
    disabled={blocked || sending}
    onclick={() => (open ? hide(false) : show())}
    >{sending ? t.sending : t.button}<svg
      viewBox="0 0 10 10"
      width="10"
      height="10"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5" /></svg
    ></button
  >
  {#if open}
    <div
      id={panelId}
      class="send-menu-panel"
      bind:this={panel}
      popover="manual"
      role="group"
      aria-label={t.title}
      style:left="{place.left}px"
      style:top="{place.top}px"
    >
      <p>{t.title}</p>
      {#each targets as target (target.id)}
        {@const ok = usable(target)}
        <button
          type="button"
          class="send-menu-item"
          disabled={!ok || sending}
          onclick={() => choose(target)}
          ><span>{target.name[frameLocale]}</span>{#if !ok && count > 1}<span>{t.singleOnly}</span
            >{/if}</button
        >
      {/each}
      {#if failed}
        <p class="send-menu-failed" role="alert">{t.failed}</p>
      {/if}
      <p class="send-menu-note">{t.note}</p>
    </div>
  {/if}
{/if}
