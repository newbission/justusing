/**
 * 화면에 보이는 쪽과 PDF 좌표를 잇는 계산 (PDF를 고치는 워커들이 같이 쓴다).
 * 화면 좌표는 쪽 회전·보이는 영역(CropBox)을 적용한 모습 기준, 왼쪽 위가 (0, 0)이고 단위는 pt.
 */
import { PDFName, PDFNumber, type PDFPage } from '@cantoo/pdf-lib';
import type { PageRect } from './modify';

/**
 * 화면에 보이는 쪽(회전·CropBox 적용) 위의 점을 PDF 좌표로 바꾼다.
 * 화면 좌표는 왼쪽 위가 (0, 0)이고 단위는 pt. PDF 좌표는 왼쪽 아래가 원점이다.
 */
export function toPdfPoint(page: PDFPage, dx: number, dy: number): { x: number; y: number } {
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

/** 쪽 좌표 한 단위의 크기 (pt). 보통 1이고, 아주 큰 도면은 /UserUnit으로 키운다 */
export function userUnit(page: PDFPage): number {
  const value = page.node.lookup(PDFName.of('UserUnit'));
  const unit = value instanceof PDFNumber ? value.asNumber() : 1;
  return unit > 0 ? unit : 1;
}

export function normalizedRotation(page: PDFPage): number {
  return (((page.getRotation().angle % 360) + 360) % 360) as number;
}

/** 화면에 보이는 쪽의 가로·세로 (pt) */
export function viewSize(page: PDFPage): { width: number; height: number } {
  const box = page.getCropBox();
  return normalizedRotation(page) % 180 === 0
    ? { width: box.width, height: box.height }
    : { width: box.height, height: box.width };
}

/** 비율 사각형을 화면 pt로 */
export function scaleRect(page: PDFPage, rect: PageRect) {
  const view = viewSize(page);
  return {
    x: rect.x * view.width,
    y: rect.y * view.height,
    width: rect.width * view.width,
    height: rect.height * view.height,
  };
}
