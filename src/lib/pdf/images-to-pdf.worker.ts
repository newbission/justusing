/**
 * 이미지로 PDF 만들기 워커. 이미지 한 장을 한 쪽에 넣는다 (images-to-pdf.ts가 부른다).
 * 무거운 처리라 화면이 멈추지 않도록 워커에서 돈다. 파일은 메모리에서만 다룬다.
 */
import { PDFDocument, PageSizes } from '@cantoo/pdf-lib';
import { toEmbeddable } from '../image/prepare';
import type { ImagesToPdfRequest, ImagesToPdfResponse, PageSize } from './images-to-pdf';

/** 이미지 화소를 pt로 (96 DPI 화면 크기 기준) */
const PX_TO_PT = 72 / 96;

const PAPER: Record<Exclude<PageSize, 'fit'>, [number, number]> = {
  a4: PageSizes.A4,
  letter: PageSizes.Letter,
};

addEventListener('message', async (event: MessageEvent<ImagesToPdfRequest>) => {
  const { id, job } = event.data;
  const send = (response: ImagesToPdfResponse, transfer: Transferable[] = []) =>
    postMessage(response, { transfer });
  try {
    const out = await PDFDocument.create();
    for (const [i, file] of job.images.entries()) {
      const image = await toEmbeddable(file);
      const embedded =
        image.kind === 'jpg' ? await out.embedJpg(image.bytes) : await out.embedPng(image.bytes);
      const landscape = image.width > image.height;

      let pageWidth: number;
      let pageHeight: number;
      if (job.size === 'fit') {
        pageWidth = image.width * PX_TO_PT + job.margin * 2;
        pageHeight = image.height * PX_TO_PT + job.margin * 2;
      } else {
        // 가로로 긴 이미지는 종이도 가로로 놓는다
        const [short, long] = PAPER[job.size];
        [pageWidth, pageHeight] = landscape ? [long, short] : [short, long];
      }

      // 여백 안쪽에 비율을 지켜 가장 크게, 가운데에 놓는다 (작은 이미지를 키우지는 않는다)
      const boxWidth = pageWidth - job.margin * 2;
      const boxHeight = pageHeight - job.margin * 2;
      const natural = { width: image.width * PX_TO_PT, height: image.height * PX_TO_PT };
      const scale = Math.min(1, boxWidth / natural.width, boxHeight / natural.height);
      const width = natural.width * (job.size === 'fit' ? 1 : scale);
      const height = natural.height * (job.size === 'fit' ? 1 : scale);

      const page = out.addPage([pageWidth, pageHeight]);
      page.drawImage(embedded, {
        x: (pageWidth - width) / 2,
        y: (pageHeight - height) / 2,
        width,
        height,
      });
      send({ id, kind: 'progress', done: i + 1, total: job.images.length });
    }
    const bytes = await out.save();
    send({ id, kind: 'done', bytes }, [bytes.buffer]);
  } catch (error) {
    send({ id, kind: 'error', message: error instanceof Error ? error.message : String(error) });
  }
});
