/**
 * PDF 양식(입력 칸) 채우기. 칸에 값을 넣고 고른 글꼴로 보이는 모양을 다시 만든다.
 * 한글처럼 기본 글꼴에 없는 글자는 글꼴이 필요해 글자 넣기 워커(text-pdf.worker.ts)가 한다.
 */
import { runTextJob } from './text-pdf';

/** 칸 이름 → 값. 글자 칸·선택 상자는 글자, 체크 상자는 켬/끔, 라디오는 고른 값('' 이면 해제), 목록은 고른 것들 */
export type FormValues = Record<string, string | boolean | string[]>;

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
