/**
 * PDF 고치기 워커 (modify.ts가 부른다). 무거운 처리라 화면이 멈추지 않도록 워커에서 돈다.
 * 파일은 메모리에서만 다룬다.
 */
import {
  PDFArray,
  PDFDict,
  PDFHexString,
  PDFDocument,
  PDFName,
  PDFStream,
  StandardFonts,
  degrees,
  rgb,
  type PDFPage,
} from '@cantoo/pdf-lib';
import type {
  DocumentInfo,
  ModifyJob,
  ModifyRequest,
  ModifyResponse,
  NUpCount,
  PaperSize,
} from './modify';
import { flattenAnnotations, renderMissingFormAppearances } from './flatten-annotations';
import { normalizedRotation, scaleRect, toPdfPoint, viewSize } from './page-geometry';
import { removeUnused } from './remove-unused';
import { addTextLayers } from './text-layer';

const NUMBER_SIZE = 11;
/** 쪽 번호와 쪽 가장자리 사이 (pt, 약 10mm) */
const NUMBER_MARGIN = 28;

function numberLabel(format: string, n: number, total: number): string {
  if (format === 'of-total') return `${n} / ${total}`;
  if (format === 'dashes') return `- ${n} -`;
  return String(n);
}

/** 종이 크기 (pt, 세로) */
const PAPER: Record<PaperSize, [number, number]> = { a4: [595.28, 841.89], letter: [612, 792] };
/** 쪽 수 → [가로 칸, 세로 칸, 종이를 눕히는지] */
const GRID: Record<NUpCount, [number, number, boolean]> = {
  2: [2, 1, true],
  4: [2, 2, false],
  6: [3, 2, true],
  9: [3, 3, false],
};
/** 종이 가장자리와 칸 사이 간격 (pt) */
const SHEET_MARGIN = 18;
const CELL_GAP = 8;

/**
 * 여러 쪽을 한 장에 모은 새 PDF를 만든다. 쪽은 왼쪽 위부터 가로로 채운다.
 * 원래 쪽의 보이는 영역(CropBox)을 칸에 비율대로 맞추고, 회전한 쪽은 화면에 보이는 대로 바로 세운다.
 */
async function nUp(
  source: PDFDocument,
  job: Extract<ModifyJob, { kind: 'n-up' }>,
): Promise<PDFDocument> {
  const out = await PDFDocument.create();
  const [cols, rows, landscape] = GRID[job.perSheet];
  const [paperWidth, paperHeight] = PAPER[job.paper];
  const width = landscape ? paperHeight : paperWidth;
  const height = landscape ? paperWidth : paperHeight;
  const cellWidth = (width - SHEET_MARGIN * 2 - CELL_GAP * (cols - 1)) / cols;
  const cellHeight = (height - SHEET_MARGIN * 2 - CELL_GAP * (rows - 1)) / rows;
  const pages = source.getPages();
  // 양식 입력값·서명·주석은 쪽 내용이 아니라서 옮겨지지 않는다. 보이는 모양을 쪽 내용에 먼저 그려 넣는다
  renderMissingFormAppearances(source);
  pages.forEach(flattenAnnotations);
  // 내용이 없는 빈 쪽은 pdf-lib가 넣지 못한다. 칸만 비워 둔다
  const drawable = pages.filter((page) => page.node.Contents() !== undefined);
  const embeddedList = await out.embedPages(
    drawable,
    drawable.map((page) => {
      const box = page.getCropBox();
      return { left: box.x, bottom: box.y, right: box.x + box.width, top: box.y + box.height };
    }),
  );
  const embedded = new Map(drawable.map((page, i) => [page, embeddedList[i]!]));

  let sheet: PDFPage | undefined;
  pages.forEach((page, index) => {
    const slot = index % job.perSheet;
    if (slot === 0) sheet = out.addPage([width, height]);
    const col = slot % cols;
    const row = Math.floor(slot / cols);
    // 칸 (PDF 좌표, 왼쪽 아래가 원점)
    const cellX = SHEET_MARGIN + col * (cellWidth + CELL_GAP);
    const cellY = height - SHEET_MARGIN - (row + 1) * cellHeight - row * CELL_GAP;
    const view = viewSize(page);
    const scale = Math.min(cellWidth / view.width, cellHeight / view.height);
    const drawnWidth = view.width * scale;
    const drawnHeight = view.height * scale;
    const left = cellX + (cellWidth - drawnWidth) / 2;
    const bottom = cellY + (cellHeight - drawnHeight) / 2;
    const content = embedded.get(page);
    // 쪽이 시계 방향으로 돌아가 보이면, 내용을 그만큼 시계 방향으로 돌려 그린다 (기준점은 돌린 뒤의 왼쪽 아래)
    const rotation = normalizedRotation(page);
    const anchor =
      rotation === 90
        ? { x: left, y: bottom + drawnHeight }
        : rotation === 180
          ? { x: left + drawnWidth, y: bottom + drawnHeight }
          : rotation === 270
            ? { x: left + drawnWidth, y: bottom }
            : { x: left, y: bottom };
    if (content) {
      sheet!.drawPage(content, {
        ...anchor,
        width: content.width * scale,
        height: content.height * scale,
        rotate: degrees(-rotation),
      });
    }
    if (job.border) {
      sheet!.drawRectangle({
        x: left,
        y: bottom,
        width: drawnWidth,
        height: drawnHeight,
        borderColor: rgb(0.6, 0.6, 0.6),
        borderWidth: 0.5,
      });
    }
  });
  return out;
}

/**
 * 문서 정보를 적는다. 보기 프로그램에 따라 XMP 메타데이터를 먼저 보므로, 예전 값이 남지 않게 XMP는 지운다.
 * clear면 Info의 모든 항목(만든 프로그램·날짜, 워드 등이 더한 회사 이름 같은 항목 포함)을 지운다
 */
function setDocumentInfo(doc: PDFDocument, info: DocumentInfo, clear: boolean) {
  const { context } = doc;
  const metadata = PDFName.of('Metadata');
  doc.catalog.delete(metadata);
  const dict = context.lookup(context.trailerInfo.Info);
  if (clear) {
    if (dict instanceof PDFDict) for (const key of dict.keys()) dict.delete(key);
    // 쪽·그림·글꼴 등에 붙은 XMP와 앱 데이터에도 작성자·회사 이름이 들어 있을 수 있다.
    // 객체 안에 바로 들어 있는 사전·배열(쪽의 자원 목록 등)까지 들어가 지운다
    // 쪽·묶음 그림 등에 바로 적힌 고친 시각(/LastModified)도 숨은 정보다
    const hidden = [metadata, PDFName.of('PieceInfo'), PDFName.of('LastModified')];
    const strip = (object: unknown) => {
      if (object instanceof PDFStream) strip(object.dict);
      else if (object instanceof PDFDict) {
        // 앱 데이터(/PieceInfo)에도 고친 날짜·회사 이름 같은 앱별 정보가 들어 있다
        for (const key of hidden) object.delete(key);
        // 첨부 파일의 만든·고친 날짜 (첨부 파일 스트림의 /Params, /Type은 생략되기도 한다)
        const params = context.lookup(object.get(PDFName.of('Params')));
        if (params instanceof PDFDict) {
          params.delete(PDFName.of('CreationDate'));
          params.delete(PDFName.of('ModDate'));
        }
        // 주석(메모·도장 등)의 작성자(/T)와 만든·고친 시각. 입력 칸(Widget)의 /T는 칸 이름이라 둔다
        const subtype = object.get(PDFName.of('Subtype'));
        if (subtype instanceof PDFName && object.has(PDFName.of('Rect'))) {
          object.delete(PDFName.of('M'));
          object.delete(PDFName.of('CreationDate'));
          if (subtype !== PDFName.of('Widget')) object.delete(PDFName.of('T'));
        }
        for (const value of object.values()) strip(value);
      } else if (object instanceof PDFArray) {
        for (const value of object.asArray()) strip(value);
      }
    };
    for (const [, object] of context.enumerateIndirectObjects()) strip(object);
    // 파일 식별자(/ID)는 원본과 결과를 이어 줄 수 있어 새로 만든다 (보기 프로그램이 쓰므로 지우지 않는다)
    const id = PDFHexString.of(
      [...crypto.getRandomValues(new Uint8Array(16))]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join(''),
    );
    context.trailerInfo.ID = context.obj([id, id]);
  } else {
    const set = (key: string, value: string, apply: (text: string) => void) => {
      if (value.trim()) apply(value.trim());
      else if (dict instanceof PDFDict) dict.delete(PDFName.of(key));
    };
    set('Title', info.title, (text) => doc.setTitle(text));
    set('Author', info.author, (text) => doc.setAuthor(text));
    set('Subject', info.subject, (text) => doc.setSubject(text));
    set('Keywords', info.keywords, (text) => doc.setKeywords([text]));
    doc.setModificationDate(new Date());
  }
  // pdf-lib는 아무도 가리키지 않는 객체도 저장하므로, 참조를 끊은 XMP·정보 값과 고친 기록에 남은
  // 옛 XMP까지 닿지 않는 객체를 모두 지운다 (다른 곳이 같이 쓰는 객체는 닿으므로 남는다)
  removeUnused(doc);
}

async function apply(doc: PDFDocument, job: ModifyJob): Promise<void> {
  const pages = doc.getPages();
  switch (job.kind) {
    case 'unlock':
      // 암호로 열었으니 그대로 저장하면 암호 없는 PDF가 된다
      return;
    case 'protect':
      doc.encrypt({ userPassword: job.password, ownerPassword: job.password });
      return;
    case 'page-numbers': {
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const total = job.start + pages.length - 1;
      pages.forEach((page, i) => {
        const text = numberLabel(job.format, job.start + i, total);
        const width = font.widthOfTextAtSize(text, NUMBER_SIZE);
        const view = viewSize(page);
        // 화면에 보이는 쪽 기준 글자 왼쪽 아래 자리
        const dx =
          job.position === 'bottom-center'
            ? (view.width - width) / 2
            : view.width - NUMBER_MARGIN - width;
        const dy =
          job.position === 'top-right' ? NUMBER_MARGIN + NUMBER_SIZE : view.height - NUMBER_MARGIN;
        const at = toPdfPoint(page, dx, dy);
        page.drawText(text, {
          ...at,
          size: NUMBER_SIZE,
          font,
          color: rgb(0.2, 0.2, 0.2),
          // 회전한 쪽에서도 화면에 바로 보이게 같은 만큼 돌린다
          rotate: degrees(normalizedRotation(page)),
        });
      });
      return;
    }
    case 'stamp-image': {
      const image =
        job.image.kind === 'jpg'
          ? await doc.embedJpg(job.image.bytes)
          : await doc.embedPng(job.image.bytes);
      for (const index of job.pages) {
        const page = pages[index];
        if (!page) continue;
        const view = viewSize(page);
        // 비율이 다른 쪽(모든 쪽에 넣을 때)에서도 쪽 밖으로 나가지 않게 쪽마다 줄이고 안으로 민다
        const fit = Math.min(
          1,
          view.height / ((job.place.width * view.width * image.height) / image.width),
        );
        const width = job.place.width * view.width * fit;
        const height = (width * image.height) / image.width;
        const x = Math.min(job.place.x * view.width, view.width - width);
        const y = Math.min(job.place.y * view.height, view.height - height);
        // 이미지의 왼쪽 아래(화면 기준)를 기준점으로, 쪽 회전만큼 돌려 화면에서 바로 보이게 한다
        const at = toPdfPoint(page, x, y + height);
        page.drawImage(image, {
          ...at,
          width,
          height,
          rotate: degrees(normalizedRotation(page)),
        });
      }
      return;
    }
    case 'n-up':
      // 새 PDF를 만드는 작업이라 nUp()이 한다
      return;
    case 'crop': {
      for (const index of job.pages) {
        const page = pages[index];
        if (!page) continue;
        const rect = scaleRect(page, job.rect);
        const a = toPdfPoint(page, rect.x, rect.y);
        const b = toPdfPoint(page, rect.x + rect.width, rect.y + rect.height);
        const x = Math.min(a.x, b.x);
        const y = Math.min(a.y, b.y);
        const width = Math.abs(a.x - b.x);
        const height = Math.abs(a.y - b.y);
        // 보이는 영역만 줄인다. 잘린 부분의 내용은 파일에 남아 있다 (FAQ에 밝힌다)
        page.setCropBox(x, y, width, height);
        page.setTrimBox(x, y, width, height);
      }
      return;
    }
    case 'text-layer':
      await addTextLayers(doc, job.layers);
      return;
    case 'metadata':
      setDocumentInfo(doc, job.info, job.clear);
      return;
  }
}

addEventListener('message', async (event: MessageEvent<ModifyRequest>) => {
  const { id, bytes, password, job } = event.data;
  const send = (response: ModifyResponse, transfer: Transferable[] = []) =>
    postMessage(response, { transfer });
  try {
    // 암호 PDF는 받은 암호로 풀어서 연다. 암호 걸기 말고는 결과에 암호가 없다.
    // 열기 암호 없이 인쇄·복사 제한만 걸린 PDF는 빈 암호로 풀린다 (암호를 안 주면 열지 않는다)
    const doc = await PDFDocument.load(bytes, {
      password: password ?? '',
      // pdf-lib는 열 때 만든 프로그램·고친 날짜를 자기 것으로 바꾼다. 문서 정보 도구는 적은 대로만 남긴다
      updateMetadata: job.kind !== 'metadata',
    });
    // 모아찍기는 새 PDF를 만들고, 나머지는 연 PDF를 고친다
    const result = job.kind === 'n-up' ? await nUp(doc, job) : (await apply(doc, job), doc);
    const out = await result.save();
    send({ id, kind: 'done', bytes: out }, [out.buffer]);
  } catch (error) {
    send({ id, kind: 'error', message: error instanceof Error ? error.message : String(error) });
  }
});
