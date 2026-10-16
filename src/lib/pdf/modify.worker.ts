/**
 * PDF 고치기 워커 (modify.ts가 부른다). 무거운 처리라 화면이 멈추지 않도록 워커에서 돈다.
 * 파일은 메모리에서만 다룬다.
 */
import { PDFDocument, StandardFonts, degrees, rgb, type PDFPage } from '@cantoo/pdf-lib';
import type { ModifyJob, ModifyRequest, ModifyResponse, NUpCount, PaperSize } from './modify';
import { normalizedRotation, scaleRect, toPdfPoint, viewSize } from './page-geometry';

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
  }
}

addEventListener('message', async (event: MessageEvent<ModifyRequest>) => {
  const { id, bytes, password, job } = event.data;
  const send = (response: ModifyResponse, transfer: Transferable[] = []) =>
    postMessage(response, { transfer });
  try {
    // 암호 PDF는 받은 암호로 풀어서 연다. 암호 걸기 말고는 결과에 암호가 없다.
    // 열기 암호 없이 인쇄·복사 제한만 걸린 PDF는 빈 암호로 풀린다 (암호를 안 주면 열지 않는다)
    const doc = await PDFDocument.load(bytes, { password: password ?? '' });
    // 모아찍기는 새 PDF를 만들고, 나머지는 연 PDF를 고친다
    const result = job.kind === 'n-up' ? await nUp(doc, job) : (await apply(doc, job), doc);
    const out = await result.save();
    send({ id, kind: 'done', bytes: out }, [out.buffer]);
  } catch (error) {
    send({ id, kind: 'error', message: error instanceof Error ? error.message : String(error) });
  }
});
