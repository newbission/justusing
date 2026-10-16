<!--
  PDF 양식 채우기 도구 화면 (격리 frame 안에서 실행).
  PDF 안의 입력 칸 위에 직접 입력 칸을 겹쳐 적고 고르게 하고, 저장할 때 칸에 값을 넣는다.
  한글처럼 기본 글꼴에 없는 글자를 적으면 글꼴을 고르게 한다. 파일은 어디로도 전송되지 않는다.
-->
<script lang="ts">
  import '../../../frame/controls.css';
  import { pick } from '../../../frame/locale';
  import { FRAME_MESSAGES } from '../../../frame/messages';
  import { MESSAGES } from './messages';
  import ActionBar from '../../../frame/ActionBar.svelte';
  import { downloadFile } from '../../../frame/download';
  import { baseName, formatSize } from '../../../frame/format';
  import { canUse } from '../../../lib/entitlement';
  import FontPicker, { type SelectedFont } from '../../../lib/fonts/FontPicker.svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import { fillForm, type FieldValue, type FormValues } from '../../../lib/pdf/fill-form';
  import PageSheet from '../../../lib/pdf/PageSheet.svelte';
  import SinglePdfTool, { type LoadedPdf } from '../../../lib/pdf/SinglePdfTool.svelte';
  import { MissingGlyphsError } from '../../../lib/pdf/text-pdf';

  const common = pick(FRAME_MESSAGES);
  const t = pick(MESSAGES);

  /** 쪽 위 입력 칸 하나 (같은 이름의 칸이 여러 쪽에 있을 수 있다) */
  interface Field {
    key: string;
    name: string;
    /** 화면 읽기 프로그램에 읽어 줄 이름 (같은 이름 상자가 여럿이면 값을 붙인다) */
    label: string;
    page: number;
    /** 화면에 보이는 쪽 기준 비율 (왼쪽 위가 0) */
    x: number;
    y: number;
    width: number;
    height: number;
    kind: 'text' | 'checkbox' | 'radio' | 'select' | 'list';
    multiline: boolean;
    readOnly: boolean;
    maxLength?: number;
    /** 체크 상자·라디오 단추가 켜졌을 때의 값 */
    onValue?: string;
    /** 선택 상자·목록의 항목: 내보내는 값과 보이는 글자 */
    options: { value: string; label: string }[];
    multiple: boolean;
    /** 선택지에 없는 글자도 직접 적을 수 있는 선택 상자 */
    editable: boolean;
    /** 적은 글자를 가려 보여 주는 암호 칸 */
    password: boolean;
    /** 고른 라디오 단추를 다시 눌러 아무것도 고르지 않은 상태로 돌릴 수 있다 (/Ff NoToggleToOff가 없음) */
    toggleOff: boolean;
  }

  /** PDF 입력 칸 플래그: 선택 상자에 직접 적기 (/Ff Edit), 암호 칸 (/Ff Password) */
  const FLAG_EDIT = 0x40000;
  const FLAG_PASSWORD = 0x2000;
  const FLAG_NO_TOGGLE_TO_OFF = 0x4000;

  /** pdf.js가 알려 주는 입력 칸 정보 중 쓰는 것 */
  interface WidgetData {
    subtype: string;
    fieldName?: string;
    fieldType?: string;
    rect: number[];
    hidden?: boolean;
    readOnly?: boolean;
    checkBox?: boolean;
    radioButton?: boolean;
    pushButton?: boolean;
    buttonValue?: string;
    exportValue?: string;
    fieldValue?: string | string[];
    options?: { exportValue: string; displayValue: string }[];
    combo?: boolean;
    multiSelect?: boolean;
    multiLine?: boolean;
    maxLen?: number;
    fieldFlags?: number;
  }

  let pdf: LoadedPdf | undefined = $state.raw();
  let fields: Field[] = $state.raw([]);
  /**
   * 칸 이름 → 값. 이름이 __proto__·constructor 같은 PDF도 있어 일반 객체가 아니라 Map에 둔다
   * (일반 객체는 그런 이름을 이미 있는 것으로 보거나 값을 넣지 못한다)
   */
  const values = new SvelteMap<string, FieldValue>();
  let initial = new Map<string, FieldValue>();
  let reading = $state(false);
  let pageIndex = $state(0);
  let view = $state({ width: 0, height: 0 });
  let flatten = $state(false);
  let font: SelectedFont | undefined = $state.raw();
  /** 저장해 보니 기본 글꼴에 없는 글자가 있었다 */
  let fontRequired = $state(false);

  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const changed = $derived(
    Object.fromEntries([...values].filter(([name, value]) => !same(value, initial.get(name)))),
  );
  const changedCount = $derived(Object.keys(changed).length);
  /**
   * 저장할 때 모양으로 그릴 글자: 바뀐 글자 칸과, 바뀐 선택 칸의 보이는 글자 (목록은 선택지 전체).
   * 암호 칸은 * 로 가려 그리므로 글꼴이 필요 없다
   */
  const drawnText = $derived(
    Object.entries(changed)
      .flatMap(([name, value]) => {
        const field = fields.find((candidate) => candidate.name === name);
        if (value.kind === 'text')
          return field?.kind === 'text' && field.password ? [] : [value.text];
        if (value.kind !== 'choice') return [];
        if (!field) return [];
        return field.kind === 'list'
          ? field.options.map((option) => option.label)
          : value.values.map(
              (item) => field.options.find((option) => option.value === item)?.label ?? item,
            );
      })
      .join(''),
  );
  /** Latin-1 밖의 글자(한글 등)는 기본 글꼴에 없다 */
  const typedNonLatin = $derived([...drawnText].some((char) => char.codePointAt(0)! > 0xff));
  const needsFont = $derived(typedNonLatin || fontRequired);
  const signature = $derived(JSON.stringify([changed, flatten, needsFont ? font?.id : '']));
  const pageFields = $derived(fields.filter((field) => field.page === pageIndex));

  const textOf = (name: string) => {
    const value = values.get(name);
    return value?.kind === 'text' ? value.text : '';
  };
  const onOf = (name: string) => {
    const value = values.get(name);
    return value?.kind === 'check' ? value.on : '';
  };
  /** 선택 상자: 내보내는 값 → 보이는 글자, 적은 글자 → 내보내는 값 (선택지에 없으면 적은 그대로) */
  const labelOf = (field: Field, value: string) =>
    field.options.find((option) => option.value === value)?.label ?? value;
  const valueOf = (field: Field, label: string) =>
    field.options.find((option) => option.label === label)?.value ?? label;
  const choiceOf = (name: string) => {
    const value = values.get(name);
    return value?.kind === 'choice' ? value.values : [];
  };

  type Run =
    | { kind: 'idle' }
    | { kind: 'working' }
    | { kind: 'done'; name: string; bytes: Uint8Array; signature: string }
    | { kind: 'failed'; message: string; signature: string };
  let run = $state<Run>({ kind: 'idle' });
  const result = $derived(run.kind === 'done' && run.signature === signature ? run : undefined);
  const failure = $derived(
    run.kind === 'failed' && run.signature === signature ? run.message : undefined,
  );
  const blocker = $derived(
    changedCount === 0 && !flatten ? t.noChange : needsFont && !font ? t.needFont : undefined,
  );

  async function readFields(source: LoadedPdf) {
    reading = true;
    const found: Field[] = [];
    const start = new Map<string, FieldValue>();
    for (let number = 1; number <= source.doc.numPages; number++) {
      const page = await source.doc.getPage(number);
      const viewport = page.getViewport({ scale: 1 });
      const annotations = (await page.getAnnotations()) as WidgetData[];
      for (const [i, a] of annotations.entries()) {
        if (a.subtype !== 'Widget' || !a.fieldName || a.hidden || a.pushButton) continue;
        if (a.fieldType !== 'Tx' && a.fieldType !== 'Btn' && a.fieldType !== 'Ch') continue;
        const [x1, y1] = viewport.convertToViewportPoint(a.rect[0]!, a.rect[1]!);
        const [x2, y2] = viewport.convertToViewportPoint(a.rect[2]!, a.rect[3]!);
        const kind: Field['kind'] =
          a.fieldType === 'Tx'
            ? 'text'
            : a.checkBox
              ? 'checkbox'
              : a.radioButton
                ? 'radio'
                : a.combo
                  ? 'select'
                  : 'list';
        const options = (a.options ?? []).map((option) => ({
          value: option.exportValue,
          label: option.displayValue,
        }));
        found.push({
          key: `${number}-${i}`,
          name: a.fieldName,
          label: a.fieldName,
          page: number - 1,
          x: Math.min(x1!, x2!) / viewport.width,
          y: Math.min(y1!, y2!) / viewport.height,
          width: Math.abs(x2! - x1!) / viewport.width,
          height: Math.abs(y2! - y1!) / viewport.height,
          kind,
          multiline: !!a.multiLine,
          readOnly: !!a.readOnly,
          maxLength: a.maxLen || undefined,
          onValue:
            kind === 'checkbox' ? a.exportValue : kind === 'radio' ? a.buttonValue : undefined,
          options,
          multiple: !!a.multiSelect,
          editable: kind === 'select' && ((a.fieldFlags ?? 0) & FLAG_EDIT) !== 0,
          password: kind === 'text' && ((a.fieldFlags ?? 0) & FLAG_PASSWORD) !== 0,
          toggleOff: kind === 'radio' && ((a.fieldFlags ?? 0) & FLAG_NO_TOGGLE_TO_OFF) === 0,
        });
        if (start.has(a.fieldName)) continue;
        const raw = a.fieldValue;
        const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
        start.set(
          a.fieldName,
          kind === 'checkbox' || kind === 'radio'
            ? { kind: 'check', on: typeof raw === 'string' && raw !== 'Off' ? raw : '' }
            : kind === 'text'
              ? { kind: 'text', text: list.join('') }
              : { kind: 'choice', values: list },
        );
      }
      page.cleanup();
      if (pdf !== source) return;
    }
    // 같은 이름에 켜는 값이 다른 체크 상자·라디오는 값을 붙여 구분한다
    for (const field of found) {
      if (field.kind !== 'checkbox' && field.kind !== 'radio') continue;
      const siblings = found.filter((other) => other.name === field.name);
      if (field.kind === 'radio' || new Set(siblings.map((other) => other.onValue)).size > 1) {
        field.label = `${field.name}: ${field.onValue}`;
      }
    }
    fields = found;
    initial = structuredClone(start);
    values.clear();
    for (const [name, value] of start) values.set(name, value);
    reading = false;
    // 칸이 있는 첫 쪽부터 보여 준다
    if (found.length > 0) pageIndex = found[0]!.page;
  }

  function onload(loaded: LoadedPdf) {
    pdf = loaded;
    fields = [];
    values.clear();
    initial = new Map();
    pageIndex = 0;
    flatten = false;
    fontRequired = false;
    run = { kind: 'idle' };
    readFields(loaded);
  }

  async function save() {
    if (!pdf || blocker || run.kind === 'working') return;
    const entitlement = await canUse('pdf/fill-form');
    if (!entitlement.allowed) {
      run = { kind: 'failed', message: entitlement.reason ?? common.action.unavailable, signature };
      return;
    }
    const source = pdf;
    const startedWith = signature;
    run = { kind: 'working' };
    try {
      const bytes = await fillForm(source, {
        // 이름이 __proto__인 칸도 그대로 옮기도록 구조 복제로 넘긴다
        values: structuredClone(changed) as FormValues,
        font: needsFont && font ? (font.files[400] ?? Object.values(font.files)[0]) : undefined,
        flatten,
      });
      if (pdf !== source) return;
      run = {
        kind: 'done',
        name: `${baseName(source.name)}_${t.suffix}.pdf`,
        bytes,
        signature: startedWith,
      };
    } catch (error) {
      if (pdf !== source) return;
      if (error instanceof MissingGlyphsError && !font) {
        // 기본 글꼴에 없는 글자 (Latin-1 안이라도 기본 글꼴에 없는 것이 있다): 글꼴을 고르게 한다
        fontRequired = true;
        run = { kind: 'idle' };
        return;
      }
      const message =
        error instanceof MissingGlyphsError ? t.missing(error.chars.join(' ')) : t.failed;
      run = { kind: 'failed', message, signature: startedWith };
    }
  }

  /** 칸 높이에 맞춘 글자 크기 (px) */
  const fontSize = (field: Field) =>
    Math.max(8, Math.min(16, field.height * view.height * (field.multiline ? 0.35 : 0.6)));
</script>

<SinglePdfTool {onload}>
  {#snippet children({ doc })}
    <ActionBar label={t.bar}>
      {#snippet text()}
        {#if reading}
          {t.reading}
        {:else if run.kind === 'working'}
          {t.working}
        {:else if result}
          {common.action.done(result.name, formatSize(result.bytes.length))}
        {:else if failure}
          <strong>{failure}</strong>
        {:else if fields.length === 0}
          {t.noFields}
        {:else if blocker}
          {t.ready(fields.length)} · {blocker}
        {:else}
          {t.ready(fields.length)} · {t.changed(changedCount)}
        {/if}
      {/snippet}
      {#if result}
        <button
          type="button"
          class="btn primary"
          onclick={() => downloadFile(result.bytes, result.name)}>{common.action.download}</button
        >
      {:else}
        <button
          type="button"
          class="btn primary"
          disabled={reading || fields.length === 0 || !!blocker || run.kind === 'working'}
          onclick={save}>{t.run}</button
        >
      {/if}
    </ActionBar>

    {#if !reading && fields.length > 0}
      <div class="tool-body">
        <label class="check">
          <input type="checkbox" bind:checked={flatten} />
          {t.flatten}
        </label>

        {#if needsFont}
          <p class="help">{t.fontNote}</p>
          <FontPicker bind:selected={font} />
        {/if}
        <div class="sheet">
          <PageSheet {doc} bind:pageIndex bind:view help={t.help} hideForms>
            <div class="overlay">
              {#each pageFields as field (field.key)}
                <div
                  class="field-box"
                  class:readonly={field.readOnly}
                  style:left="{field.x * 100}%"
                  style:top="{field.y * 100}%"
                  style:width="{field.width * 100}%"
                  style:height="{field.height * 100}%"
                  style:font-size="{fontSize(field)}px"
                >
                  {#if field.kind === 'text' && field.multiline}
                    <textarea
                      aria-label={field.name}
                      maxlength={field.maxLength}
                      readonly={field.readOnly}
                      bind:value={
                        () => textOf(field.name),
                        (text) => values.set(field.name, { kind: 'text', text })
                      }></textarea>
                  {:else if field.kind === 'text'}
                    <input
                      type={field.password ? 'password' : 'text'}
                      aria-label={field.name}
                      maxlength={field.maxLength}
                      readonly={field.readOnly}
                      bind:value={
                        () => textOf(field.name),
                        (text) => values.set(field.name, { kind: 'text', text })
                      }
                    />
                  {:else if field.kind === 'checkbox'}
                    <input
                      type="checkbox"
                      aria-label={field.label}
                      disabled={field.readOnly}
                      checked={onOf(field.name) !== '' && onOf(field.name) === field.onValue}
                      onchange={(event) =>
                        values.set(field.name, {
                          kind: 'check',
                          on: event.currentTarget.checked ? (field.onValue ?? '') : '',
                        })}
                    />
                  {:else if field.kind === 'radio'}
                    <input
                      type="radio"
                      name={`radio-${field.name}`}
                      aria-label={field.label}
                      disabled={field.readOnly}
                      value={field.onValue}
                      checked={onOf(field.name) !== '' && onOf(field.name) === field.onValue}
                      onchange={() =>
                        values.set(field.name, { kind: 'check', on: field.onValue ?? '' })}
                      onclick={() => {
                        // 이미 고른 단추를 다시 누르면 고르지 않은 상태로 (PDF가 허용할 때)
                        if (field.toggleOff && onOf(field.name) === field.onValue) {
                          values.set(field.name, { kind: 'check', on: '' });
                        }
                      }}
                    />
                  {:else if field.kind === 'select' && field.editable}
                    <!-- 직접 적을 수 있는 선택 상자: 선택지를 고르거나 적는다 -->
                    <input
                      type="text"
                      list={`options-${field.key}`}
                      aria-label={field.name}
                      readonly={field.readOnly}
                      bind:value={
                        () => labelOf(field, choiceOf(field.name)[0] ?? ''),
                        (text) =>
                          values.set(field.name, {
                            kind: 'choice',
                            values: text ? [valueOf(field, text)] : [],
                          })
                      }
                    />
                    <datalist id={`options-${field.key}`}>
                      {#each field.options as option (option.value)}
                        <option value={option.label}></option>
                      {/each}
                    </datalist>
                  {:else if field.kind === 'select'}
                    <select
                      aria-label={field.name}
                      disabled={field.readOnly}
                      bind:value={
                        () => choiceOf(field.name)[0] ?? '',
                        (value) =>
                          values.set(field.name, { kind: 'choice', values: value ? [value] : [] })
                      }
                    >
                      <option value="">{t.none}</option>
                      {#each field.options as option (option.value)}
                        <option value={option.value}>{option.label}</option>
                      {/each}
                    </select>
                  {:else if field.multiple}
                    <select
                      aria-label={field.name}
                      multiple
                      disabled={field.readOnly}
                      bind:value={
                        () => choiceOf(field.name),
                        (value) => values.set(field.name, { kind: 'choice', values: value })
                      }
                    >
                      {#each field.options as option (option.value)}
                        <option value={option.value}>{option.label}</option>
                      {/each}
                    </select>
                  {:else}
                    <!-- 하나만 고르는 목록: 값은 고른 것 하나를 담은 배열 -->
                    <select
                      aria-label={field.name}
                      size={Math.max(2, Math.min(field.options.length, 6))}
                      disabled={field.readOnly}
                      bind:value={
                        () => choiceOf(field.name)[0] ?? '',
                        (value) =>
                          values.set(field.name, { kind: 'choice', values: value ? [value] : [] })
                      }
                    >
                      {#each field.options as option (option.value)}
                        <option value={option.value}>{option.label}</option>
                      {/each}
                    </select>
                  {/if}
                </div>
              {/each}
            </div>
          </PageSheet>
        </div>
      </div>
    {/if}
  {/snippet}
</SinglePdfTool>

<style>
  .sheet {
    margin-bottom: 16px;
  }
  .overlay {
    position: absolute;
    inset: 0;
  }
  /* 입력 칸 자리: 연한 강조색 바탕 (PDF 보기 프로그램의 입력 칸처럼) */
  .field-box {
    position: absolute;
    display: flex;
    align-items: stretch;
    background: var(--color-accent-soft);
  }
  .field-box.readonly {
    background: transparent;
  }
  .field-box input[type='text'],
  .field-box input[type='password'],
  .field-box textarea,
  .field-box select {
    width: 100%;
    min-width: 0;
    height: 100%;
    margin: 0;
    padding: 0 2px;
    border: 0;
    background: transparent;
    /* 종이 위라 테마와 무관하게 검은 글자 */
    color: var(--color-paper-text);
    font: inherit;
    resize: none;
  }
  .field-box input[type='checkbox'],
  .field-box input[type='radio'] {
    width: 100%;
    height: 100%;
    margin: 0;
    accent-color: var(--color-paper-text);
  }
  .field-box :focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 0;
  }
  .check {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 12px;
    font-size: 14px;
    cursor: pointer;
  }
  .check input {
    width: 18px;
    height: 18px;
    accent-color: var(--color-text);
  }
</style>
