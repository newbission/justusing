"""실제 도구 결과 PDF를 홈 이미지 재료로 렌더링한다. PyMuPDF 필요."""
from pathlib import Path
import pymupdf as fitz

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / '.cache/home-showcase/raw'

def render(page, name, clip=None, width=420):
    box = clip or page.rect
    page.get_pixmap(matrix=fitz.Matrix(width / box.width, width / box.width), clip=clip, alpha=False).save(RAW / name)

photos = fitz.open(RAW / 'photos.pdf')
assert len(photos) == 3
for index in range(3):
    render(photos[index], f'photo-page-{index}.png')

for lang in ['ko', 'en']:
    samples = ROOT / 'public/samples' / lang
    report = fitz.open(samples / ('예시-보고서.pdf' if lang == 'ko' else 'sample-report.pdf'))
    appendix = fitz.open(samples / ('예시-부록.pdf' if lang == 'ko' else 'sample-appendix.pdf'))
    merged = fitz.open(RAW / f'merge-{lang}.pdf')
    assert len(merged) == len(report) + len(appendix)
    render(report[0], f'report-{lang}.png')
    render(appendix[0], f'appendix-{lang}.png')
    render(merged[0], f'merged-{lang}.png')
    redacted = fitz.open(RAW / f'redact-{lang}.pdf')
    words = ['010-0000-0000', '000000-0000000', '000-00-000000'] if lang == 'ko' else ['000-000-0000', '000-00-0000', '0000-0000-0000']
    boxes = [box for word in words for box in report[-1].search_for(word)]
    assert boxes, '원본에서 가릴 글자를 찾지 못했습니다.'
    assert all(word not in ''.join(p.get_text() for p in redacted) for word in words), '가린 글자가 결과에 남았습니다.'
    # 가상의 개인정보가 있는 연락처 영역을 확대한다. 전후에 정확히 같은 영역을 사용한다.
    area = fitz.Rect(boxes[0])
    for box in boxes[1:]:
        area |= box
    area = fitz.Rect(36, max(0, area.y0 - 7), min(report[-1].rect.width, area.x1 + 28), min(report[-1].rect.height, area.y1 + 7))
    render(report[-1], f'redact-before-{lang}.png', area, 600)
    render(redacted[-1], f'redact-after-{lang}.png', area, 600)
print('PDF 쪽 수·가린 글자 삭제 확인 및 실제 결과 렌더링 완료.')
