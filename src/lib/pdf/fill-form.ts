/**
 * PDF 양식(입력 칸) 채우기. 칸에 값을 넣고 고른 글꼴로 보이는 모양을 다시 만든다.
 * 한글처럼 기본 글꼴에 없는 글자는 글꼴이 필요해 글자 넣기 워커(text-pdf.worker.ts)가 한다.
 */
import { runTextJob } from './text-pdf';

/**
 * 칸 하나의 값.
 * - text: 글자 칸
 * - check: 체크 상자·라디오. on은 켠 상자의 값('' 이면 모두 끔). 같은 이름의 상자가 여럿이면 켠 상자만 켜진다
 * - choice: 선택 상자·목록. 고른 항목의 내보내는 값들 (화면에 보이는 글자가 아니라 PDF에 저장되는 값)
 */
export type FieldValue =
  | { kind: 'text'; text: string }
  | { kind: 'check'; on: string }
  | { kind: 'choice'; values: string[] };

/** 칸 이름 → 값 */
export type FormValues = Record<string, FieldValue>;

export interface FillFormOptions {
  values: FormValues;
  /** 기본 글꼴(Helvetica)에 없는 글자를 쓸 때의 글꼴 */
  font?: Uint8Array;
  /** 칸을 글자로 굳혀 더 고칠 수 없게 한다 */
  flatten: boolean;
}

export const fillForm = (
  source: { bytes: Uint8Array; password?: string },
  options: FillFormOptions,
) => runTextJob(source, { kind: 'fill-form', ...options });
