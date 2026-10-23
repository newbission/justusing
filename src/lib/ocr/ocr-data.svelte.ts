/**
 * 글자 인식에 쓸 언어와, 그 언어의 데이터(인식 엔진·언어 데이터)가 준비됐는지 (PDF·이미지 글자 인식).
 *
 * 고른 언어가 바뀔 때마다 바깥 보관소에 보관돼 있는지 묻는다. 없으면 스스로 받지 않고(와이파이인지 알 수 없다)
 * 받을 크기를 알려 사용자가 "데이터 받기"를 누를 때만 받는다. 도구 화면을 만들 때(컴포넌트 초기화 중) 만든다.
 */
import { untrack } from 'svelte';
import { dataStatus, loadData, missingData } from '../../frame/data';
import { frameLocale } from '../../frame/locale';
import { OCR_CONSENT, OCR_LANGS, ocrFiles, type OcrLang } from './ocr';

export type OcrDataState =
  | { kind: 'checking' }
  | { kind: 'missing'; removed: boolean; lowSpace: boolean }
  | { kind: 'downloading'; percent: number }
  | { kind: 'failed' }
  | { kind: 'ready' };

export class OcrData {
  /** 한국어 화면은 한국어+영어, 영어 화면은 영어부터 */
  langs: OcrLang[] = $state(frameLocale === 'ko' ? ['kor', 'eng'] : ['eng']);
  /** 고른 언어 (정해진 순서) */
  readonly chosen = $derived(OCR_LANGS.filter((lang) => this.langs.includes(lang)));
  readonly files = $derived(ocrFiles(this.chosen));
  /** 받아야 할 크기 (고른 언어 중 보관돼 있지 않은 것만) */
  needBytes = $state(0);
  state: OcrDataState = $state({ kind: 'checking' });
  /** 언어를 고르고 데이터도 준비됐는지 */
  readonly ready = $derived(this.state.kind === 'ready' && this.chosen.length > 0);
  /**
   * "데이터 받기"로 받은 바이트. 보관소를 쓸 수 없는 창(시크릿 모드 등)에서는 인식할 때 다시 받게 되므로
   * 받은 것을 그대로 쓴다
   */
  #downloaded: Map<string, Uint8Array> | undefined;

  constructor() {
    $effect(() => {
      const wanted = this.files;
      if (wanted.length < 2) return;
      let current = true;
      untrack(() => (this.state = { kind: 'checking' }));
      dataStatus(wanted, OCR_CONSENT).then((status) => {
        if (!current) return;
        const missing = missingData(wanted, status);
        const lowSpace = status.available !== undefined && status.available < missing.bytes * 2;
        this.needBytes = missing.bytes;
        this.state =
          missing.bytes === 0
            ? { kind: 'ready' }
            : { kind: 'missing', removed: missing.removed, lowSpace };
      });
      return () => {
        current = false;
      };
    });
  }

  /** 고른 언어의 데이터를 받아 보관한다 */
  async download() {
    const wanted = this.files;
    this.state = { kind: 'downloading', percent: 0 };
    try {
      const bytes = await loadData(wanted, OCR_CONSENT, (received) => {
        if (this.files !== wanted) return;
        this.state = {
          kind: 'downloading',
          percent: Math.min(99, Math.floor((received / this.needBytes) * 100)),
        };
      });
      this.#downloaded = new Map([...(this.#downloaded ?? []), ...bytes]);
      if (this.files === wanted) this.state = { kind: 'ready' };
    } catch {
      if (this.files === wanted) this.state = { kind: 'failed' };
    }
  }

  /** 엔진에 넘길 확인된 바이트 (경로 → 바이트). 방금 받은 것이 있으면 그것을, 없으면 보관소에서 */
  async bytes(langs: OcrLang[]): Promise<Map<string, Uint8Array>> {
    const needed = ocrFiles(langs);
    const downloaded = this.#downloaded;
    return downloaded && needed.every((file) => downloaded.has(file.path))
      ? downloaded
      : loadData(needed, OCR_CONSENT);
  }
}
