/**
 * PDF 고치기 워커 (modify.ts가 부른다). 무거운 처리라 화면이 멈추지 않도록 워커에서 돈다.
 * 파일은 메모리에서만 다룬다.
 */
import { PDFDocument, StandardFonts, degrees, rgb, type PDFPage } from '@cantoo/pdf-lib';
import type { ModifyJob, ModifyRequest, ModifyResponse, PageRect } from './modify';

/**
 * 화면에 보이는 쪽(회전·CropBox 적용) 위의 점을 PDF 좌표로 바꾼다.
 * 화면 좌표는 왼쪽 위가 (0, 0)이고 단위는 pt. PDF 좌표는 왼쪽 아래가 원점이다.
 */
function toPdfPoint(page: PDFPage, dx: number, dy: number): { x: number; y: number } {
  const box = page.getCropBox();
  switch (normalizedRotation(page)) {
    case 90:
      return { x: box.x + dy, y: box.y + dx };
    case 180:
      return { x: box.x + box.width - dx, y: box.y + dy };
    case 270:
      return { x: box.x + box.width - dy, y: box.y + box.height - dx };
    default:
      return { x: box.x + dx, y: box.y + box.height - dy };
  }
}

function normalizedRotation(page: PDFPage): number {
  return (((page.getRotation().angle % 360) + 360) % 360) as number;
}

/** 화면에 보이는 쪽의 가로·세로 (pt) */
function viewSize(page: PDFPage): { width: number; height: number } {
  const box = page.getCropBox();
  return normalizedRotation(page) % 180 === 0
    ? { width: box.width, height: box.height }
    : { width: box.height, height: box.width };
}

/** 비율 사각형을 화면 pt로 */
function scaleRect(page: PDFPage, rect: PageRect) {
  const view = viewSize(page);
  return {
    x: rect.x * view.width,
    y: rect.y * view.height,
    width: rect.width * view.width,
    height: rect.height * view.height,
  };
}

const NUMBER_SIZE = 11;
/** 쪽 번호와 쪽 가장자리 사이 (pt, 약 10mm) */
const NUMBER_MARGIN = 28;

function numberLabel(format: string, n: number, total: number): string {
  if (format === 'of-total') return `${n} / ${total}`;
  if (format === 'dashes') return `- ${n} -`;
  return String(n);
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
    await apply(doc, job);
    const out = await doc.save();
    send({ id, kind: 'done', bytes: out }, [out.buffer]);
  } catch (error) {
    send({ id, kind: 'error', message: error instanceof Error ? error.message : String(error) });
  }
});
