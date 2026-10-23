/** CSV 한글 깨짐 고치기 도구 화면의 문구 (공통 문구는 src/frame/messages.ts) */
import type { Locale } from '../../../i18n/locales';
import type { Newline, SourceEncoding, TargetFormat } from '../../../lib/text/encoding';

const ko = {
  bar: '인코딩 바꾸기',
  choose: 'CSV 파일 선택',
  hint: 'CSV·TSV·TXT 파일을 여러 개 한 번에 고를 수 있습니다 · 파일은 이 기기를 떠나지 않습니다',
  summary: (count: number, size: string) => `파일 ${count}개 · ${size}`,
  add: '파일 추가',
  list: '파일 목록',
  formatGroup: '저장 형식',
  formats: {
    excel: { label: '엑셀용 UTF-8 (BOM 포함)', short: '엑셀용' },
    utf8: { label: 'UTF-8 (BOM 없음)', short: 'UTF-8' },
    cp949: { label: 'CP949 (EUC-KR)', short: 'CP949' },
  } satisfies Record<TargetFormat, { label: string; short: string }>,
  formatHelp: {
    excel:
      '엑셀(윈도우·맥)에서 두 번 눌러 열어도 한글이 깨지지 않습니다. 구글 시트·Numbers에서도 그대로 열립니다. 잘 모르겠으면 이것을 고르세요.',
    utf8: '프로그램이나 웹 서비스에 올리거나 코드로 읽을 파일에 맞습니다. 이 파일을 엑셀에서 바로 열면 한글이 깨집니다.',
    cp949:
      '예전 프로그램이나 은행·관공서 시스템이 CP949(EUC-KR) 파일만 받을 때 고르세요. 이모지처럼 CP949에 없는 글자는 ?로 바뀝니다.',
  } satisfies Record<TargetFormat, string>,
  newlineGroup: '줄바꿈',
  newlines: {
    keep: { label: '그대로', short: '그대로' },
    crlf: { label: 'CRLF (윈도우)', short: 'CRLF' },
    lf: { label: 'LF (맥·리눅스)', short: 'LF' },
  } satisfies Record<Newline, { label: string; short: string }>,
  encodings: {
    'utf-8': 'UTF-8',
    'euc-kr': 'CP949 (EUC-KR)',
    'utf-16le': 'UTF-16 LE',
    'utf-16be': 'UTF-16 BE',
    'windows-1252': 'Windows-1252 (서유럽)',
    shift_jis: 'Shift_JIS (일본어)',
    gbk: 'GBK (중국어 간체)',
    big5: 'Big5 (중국어 번체)',
  } satisfies Record<SourceEncoding, string>,
  /** 목록 줄: 알아낸 인코딩 */
  detecting: '인코딩을 살피는 중…',
  ascii: '영문·숫자만 (어디서나 같게 보임)',
  withBom: (name: string) => `${name} (BOM 포함)`,
  withoutBom: (name: string) => `${name} (BOM 없음)`,
  chosen: (name: string) => `직접 고름: ${name}`,
  empty: '빈 파일입니다. 빼고 처리합니다.',
  binary: 'CSV·TXT 같은 글자 파일이 아닙니다. 빼고 처리합니다.',
  unreadable: '파일을 읽지 못했습니다. 빼고 처리합니다.',
  /** 목록 줄: 바꾼 뒤 */
  itemWorking: (percent: number) => `바꾸는 중… ${percent}%`,
  itemDone: (from: string, to: string, before: string, after: string) =>
    `${from} → ${to} · ${before} → ${after}`,
  itemKept: '이미 고른 형식이라 원본 그대로',
  itemFailed: '이 파일은 바꾸지 못했습니다',
  itemUnmappable: (count: number) => `CP949에 없는 글자 ${count.toLocaleString('ko')}개를 ?로 바꿈`,
  itemBroken: (count: number) => `읽지 못한 글자 ${count.toLocaleString('ko')}개`,
  preview: '미리보기',
  previewOf: (name: string) => `${name} 미리보기`,
  previewShort: '보기',
  download: (name: string) => `${name} 받기`,
  remove: (name: string) => `${name} 빼기`,
  /** 미리보기 */
  sourceLabel: '원본 인코딩',
  auto: (name: string) => `${name} (자동)`,
  sourceHelp: '글자가 바르게 보이지 않으면 원본 인코딩을 바꿔 보세요.',
  excelView: '지금 엑셀에서 열면',
  utf8View: 'UTF-8로 읽는 곳(구글 시트·맥 Numbers 등)에서 열면',
  afterView: '바꾼 뒤',
  sameView: '미리보기',
  asciiNote: '영문·숫자·기호만 있어 어느 프로그램에서 열어도 똑같이 보입니다.',
  bomNote: '이미 인코딩 표시(BOM)가 있어 엑셀에서 바로 열리는 파일입니다.',
  sameNote: '두 방식으로 읽은 모습이 같습니다.',
  more: '앞부분만 보여 줍니다.',
  previewEmpty: '보여 줄 내용이 없습니다.',
  brokenNote: (encoding: string) =>
    `${encoding}(으)로 읽을 수 없는 바이트가 있어 �로 보입니다. 원본 인코딩이 맞는지 확인하세요.`,
  /** 실행 막대 */
  needOne: '바꿀 CSV 파일을 넣어 주세요.',
  ready: (count: number, format: string) => `파일 ${count}개를 ${format}로 바꿉니다.`,
  working: (percent: number, index: number, count: number) =>
    count > 1 ? `바꾸는 중… ${percent}% (${index}/${count})` : `바꾸는 중… ${percent}%`,
  workingShort: '바꾸는 중…',
  run: '변환하기',
  done: (count: number) => `완료: 파일 ${count}개를 바꿨습니다.`,
  doneUnmappable: (count: number) =>
    `완료. CP949에 없는 글자 ${count.toLocaleString('ko')}개를 ?로 바꿨습니다. 그대로 두려면 엑셀용 UTF-8로 저장하세요.`,
  doneBroken: '완료. 원본 인코딩으로 읽지 못한 글자가 있습니다. 목록을 확인하세요.',
  nothing: '바꿀 것이 없었습니다. 이미 고른 형식입니다.',
  failed: '바꾸지 못한 파일이 있습니다. 목록에서 확인하세요.',
  unmappableList: (examples: string) => `CP949에 없는 글자: ${examples}`,
  unmappableExample: (char: string, line: number) => `${char} (${line}번째 줄)`,
  downloadAll: (count: number) => `모두 받기 (ZIP, ${count}개)`,
  zipName: 'CSV_인코딩변환.zip',
  /** 결과 파일 이름 뒤에 붙는 말 */
  suffix: { excel: '엑셀용', utf8: 'UTF8', cp949: 'CP949' } satisfies Record<TargetFormat, string>,
};

const en: typeof ko = {
  bar: 'Convert encoding',
  choose: 'Choose CSV files',
  hint: 'You can pick several CSV, TSV or TXT files at once · Your files never leave this device',
  summary: (count: number, size: string) => `${count} ${count === 1 ? 'file' : 'files'} · ${size}`,
  add: 'Add files',
  list: 'Files',
  formatGroup: 'Save as',
  formats: {
    excel: { label: 'UTF-8 with BOM (for Excel)', short: 'Excel' },
    utf8: { label: 'UTF-8 (no BOM)', short: 'UTF-8' },
    cp949: { label: 'CP949 (Korean)', short: 'CP949' },
  },
  formatHelp: {
    excel:
      'Opens in Excel (Windows and Mac) with a double-click and no garbled text. Google Sheets and Numbers open it as is too. Pick this if you are not sure.',
    utf8: 'Best for files you upload to apps or web services or read with code. Opening this file directly in Excel garbles non-English text.',
    cp949:
      'For older Korean programs and systems that only accept CP949 (EUC-KR). Characters CP949 cannot hold, such as emoji, become ?.',
  },
  newlineGroup: 'Line breaks',
  newlines: {
    keep: { label: 'Keep', short: 'Keep' },
    crlf: { label: 'CRLF (Windows)', short: 'CRLF' },
    lf: { label: 'LF (Mac, Linux)', short: 'LF' },
  },
  encodings: {
    'utf-8': 'UTF-8',
    'euc-kr': 'CP949 (EUC-KR, Korean)',
    'utf-16le': 'UTF-16 LE',
    'utf-16be': 'UTF-16 BE',
    'windows-1252': 'Windows-1252 (Western)',
    shift_jis: 'Shift_JIS (Japanese)',
    gbk: 'GBK (Simplified Chinese)',
    big5: 'Big5 (Traditional Chinese)',
  },
  detecting: 'Checking the encoding…',
  ascii: 'English letters and digits only (looks the same everywhere)',
  withBom: (name: string) => `${name} (with BOM)`,
  withoutBom: (name: string) => `${name} (no BOM)`,
  chosen: (name: string) => `Chosen: ${name}`,
  empty: 'This file is empty. It will be left out.',
  binary: 'This is not a text file such as CSV or TXT. It will be left out.',
  unreadable: 'Could not read this file. It will be left out.',
  itemWorking: (percent: number) => `Converting… ${percent}%`,
  itemDone: (from: string, to: string, before: string, after: string) =>
    `${from} → ${to} · ${before} → ${after}`,
  itemKept: 'Already in this format, kept as is',
  itemFailed: 'Could not convert this file',
  itemUnmappable: (count: number) =>
    `${count.toLocaleString('en')} ${count === 1 ? 'character' : 'characters'} not in CP949 became ?`,
  itemBroken: (count: number) =>
    `${count.toLocaleString('en')} unreadable ${count === 1 ? 'character' : 'characters'}`,
  preview: 'Preview',
  previewOf: (name: string) => `Preview ${name}`,
  previewShort: 'View',
  download: (name: string) => `Download ${name}`,
  remove: (name: string) => `Remove ${name}`,
  sourceLabel: 'Original encoding',
  auto: (name: string) => `${name} (detected)`,
  sourceHelp: 'If the text does not look right, try another original encoding.',
  excelView: 'Opened in Excel now',
  utf8View: 'Opened where UTF-8 is expected (Google Sheets, Numbers…)',
  afterView: 'After converting',
  sameView: 'Preview',
  asciiNote: 'Only English letters, digits and symbols, so it looks the same in every program.',
  bomNote: 'This file already has an encoding mark (BOM), so Excel opens it correctly.',
  sameNote: 'Both ways of reading it look the same.',
  more: 'Showing the beginning only.',
  previewEmpty: 'Nothing to show.',
  brokenNote: (encoding: string) =>
    `Some bytes cannot be read as ${encoding} and show as �. Check that the original encoding is right.`,
  needOne: 'Add the CSV files you want to fix.',
  ready: (count: number, format: string) =>
    `Convert ${count} ${count === 1 ? 'file' : 'files'} to ${format}.`,
  working: (percent: number, index: number, count: number) =>
    count > 1 ? `Converting… ${percent}% (${index}/${count})` : `Converting… ${percent}%`,
  workingShort: 'Converting…',
  run: 'Convert',
  done: (count: number) => `Done: converted ${count} ${count === 1 ? 'file' : 'files'}.`,
  doneUnmappable: (count: number) =>
    `Done. ${count.toLocaleString('en')} ${count === 1 ? 'character' : 'characters'} not in CP949 became ?. Save as UTF-8 for Excel to keep them.`,
  doneBroken: 'Done. Some characters could not be read in the original encoding. Check the list.',
  nothing: 'Nothing to change. The files are already in this format.',
  failed: 'Some files could not be converted. Check the list.',
  unmappableList: (examples: string) => `Not in CP949: ${examples}`,
  unmappableExample: (char: string, line: number) => `${char} (line ${line})`,
  downloadAll: (count: number) => `Download all (ZIP, ${count})`,
  zipName: 'converted-csv.zip',
  suffix: { excel: 'excel', utf8: 'utf8', cp949: 'cp949' },
};

export const MESSAGES: Record<Locale, typeof ko> = { ko, en };
