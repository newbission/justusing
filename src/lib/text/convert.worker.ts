/**
 * 글자 파일 인코딩 워커 (convert.ts가 부른다). 파일을 통째로 메모리에 올리지 않고 조각씩 읽어
 * 바꾼 조각을 Blob 하나로 모은다. 파일은 메모리에서만 다룬다.
 */
import {
  Cp949Encoder,
  NewlineConverter,
  UTF8_BOM,
  detectEncoding,
  type Unmappable,
} from './encoding';
import type { ConvertRequest, ConvertResponse } from './convert';

/** 미리보기에 넘기는 앞부분 크기 */
const HEAD = 64 * 1024;
/** 인코딩을 알아낼 때 읽는 한 번의 크기와 최대 크기 */
const STEP = 1024 * 1024;
const LIMIT = 32 * 1024 * 1024;
/** ASCII가 아닌 바이트가 이만큼 보이면 더 읽지 않고 판단한다 */
const ENOUGH = 4096;

const send = (response: ConvertResponse, transfer: Transferable[] = []) =>
  postMessage(response, { transfer });

async function detect(id: number, file: Blob) {
  // 앞부분이 영문·숫자뿐인 파일도 있어 한글 같은 글자가 충분히 보일 때까지(또는 끝까지) 더 읽는다
  const pieces: Uint8Array[] = [];
  let end = 0;
  let seen = 0;
  do {
    const next = Math.min(file.size, end + STEP);
    const piece = new Uint8Array(await file.slice(end, next).arrayBuffer());
    pieces.push(piece);
    for (const byte of piece) if (byte >= 0x80) seen++;
    end = next;
  } while (end < file.size && end < LIMIT && seen < ENOUGH);
  const sample = new Uint8Array(end);
  let offset = 0;
  for (const piece of pieces) {
    sample.set(piece, offset);
    offset += piece.length;
  }
  const complete = end >= file.size;
  const detection = detectEncoding(sample, complete);
  const head = sample.slice(0, HEAD);
  send({ id, kind: 'detected', detection, head, complete: file.size <= HEAD }, [head.buffer]);
}

async function convert(request: Extract<ConvertRequest, { kind: 'convert' }>) {
  const { id, file, source, target, newline } = request;
  const decoder = new TextDecoder(source);
  const lines = new NewlineConverter(newline);
  const cp949 = target === 'cp949' ? new Cp949Encoder() : undefined;
  const utf8 = new TextEncoder();
  const parts: Uint8Array<ArrayBuffer>[] = target === 'excel' ? [UTF8_BOM.slice()] : [];
  let broken = 0;

  const write = (text: string, final: boolean) => {
    const converted = lines.push(text, final);
    if (converted === '') return;
    for (let i = converted.indexOf('\ufffd'); i !== -1; i = converted.indexOf('\ufffd', i + 1)) {
      broken++;
    }
    parts.push(
      (cp949 ? cp949.encode(converted) : utf8.encode(converted)) as Uint8Array<ArrayBuffer>,
    );
  };

  const reader = (file.stream() as ReadableStream<Uint8Array>).getReader();
  let done = 0;
  let reported = 0;
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    done += chunk.value.length;
    write(decoder.decode(chunk.value, { stream: true }), false);
    // 진행은 1%마다 알린다 (메시지가 너무 많아지지 않게)
    if (done - reported >= file.size / 100) {
      reported = done;
      send({ id, kind: 'progress', done, total: file.size });
    }
  }
  write(decoder.decode(), true);

  const unmappable: Unmappable = cp949?.unmappable ?? { count: 0, examples: [] };
  const type = target === 'cp949' ? 'text/csv;charset=euc-kr' : 'text/csv;charset=utf-8';
  send({ id, kind: 'converted', blob: new Blob(parts, { type }), unmappable, broken });
}

addEventListener('message', async (event: MessageEvent<ConvertRequest>) => {
  const request = event.data;
  try {
    if (request.kind === 'detect') await detect(request.id, request.file);
    else await convert(request);
  } catch {
    send({ id: request.id, kind: 'error' });
  }
});
