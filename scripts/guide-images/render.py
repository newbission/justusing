"""
가이드 그림 그리기. run-tools.mjs가 우리 도구로 만든 결과(.cache/guide-images/)와 견본(public/samples/)으로
src/assets/guides/<언어>/<글>/에 PNG를 쓴다 (커밋한다. 배포용 WebP는 빌드가 만든다).

  python3 scripts/guide-images/render.py   (PyMuPDF·Pillow 필요)

- 그림은 흰 종이 카드 하나로 그린다. 두 테마에서 같은 모습이고, 가이드 글의 테두리·둥근 모서리는 CSS가 맡는다
- 그림 안 글자는 꼬리표(단계 이름·용량)만 둔다. 설명은 가이드 글과 그림 설명(alt)이 맡는다
"""
import io
import os

import fitz
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CACHE = os.path.join(ROOT, '.cache', 'guide-images')
SAMPLES = os.path.join(ROOT, 'public', 'samples')
OUT = os.path.join(ROOT, 'src', 'assets', 'guides')
FONT_DIR = os.path.join(ROOT, 'node_modules', 'pretendard', 'dist', 'public', 'static')
BOLD = os.path.join(FONT_DIR, 'Pretendard-Bold.otf')
REGULAR = os.path.join(FONT_DIR, 'Pretendard-Regular.otf')

INK = (30, 30, 30)
MUTED = (110, 110, 106)
GREEN = (47, 111, 85)
LINE = (226, 226, 222)
BG = (255, 255, 255)
PAD = 24

TEXT = {
    'ko': {
        'report': '예시-보고서.pdf',
        'photos': '예시-사진모음.pdf',
        'levels': {'original': '원본', 'light': '조금', 'balanced': '보통', 'strong': '많이'},
        'perSheet': lambda n: f'한 장에 {n}쪽',
        'before': '원본',
        'after': '가린 결과',
    },
    'en': {
        'report': 'sample-report.pdf',
        'photos': 'sample-photos.pdf',
        'levels': {'original': 'Original', 'light': 'Less', 'balanced': 'Balanced', 'strong': 'More'},
        'perSheet': lambda n: f'{n} pages per sheet',
        'before': 'Original',
        'after': 'Redacted',
    },
}


def render(path: str, index: int, dpi: int, clip: fitz.Rect | None = None) -> Image.Image:
    with fitz.open(path) as doc:
        pixmap = doc[index].get_pixmap(dpi=dpi, clip=clip)
    return Image.open(io.BytesIO(pixmap.tobytes('png'))).convert('RGB')


def size_label(path: str) -> str:
    kb = os.path.getsize(path) / 1024
    return f'{kb / 1024:.1f}MB' if kb >= 1024 else f'{kb:.0f}KB'


def tiles(items, label_font, sub_font, gap=16, cols=None):
    """그림 여러 장을 cols칸 격자로 늘어놓고 아래에 꼬리표(굵게)와 작은 설명을 단다.
    휴대폰에서는 그림이 화면 폭으로 줄어드므로, 꼬리표가 읽히게 칸 수를 적게 잡는다"""
    cols = cols or len(items)
    rows = (len(items) + cols - 1) // cols
    cell_w = max(image.width for image, _, _ in items)
    cell_h = max(image.height for image, _, _ in items) + 52
    # 한 줄이면 그림마다 제 폭만 쓴다 (가로·세로 종이를 나란히 둘 때)
    widths = [image.width for image, _, _ in items] if rows == 1 else [cell_w] * cols
    width = PAD * 2 + sum(widths) + gap * (cols - 1)
    height = PAD * 2 + cell_h * rows + gap * (rows - 1)
    card = Image.new('RGB', (width, height), BG)
    draw = ImageDraw.Draw(card)
    for index, (image, label, sub) in enumerate(items):
        x = PAD + sum(widths[: index % cols]) + (index % cols) * gap
        y = PAD + (index // cols) * (cell_h + gap)
        card.paste(image, (x, y))
        draw.rectangle([x, y, x + image.width - 1, y + image.height - 1], outline=LINE)
        draw.text((x, y + image.height + 12), label, font=label_font, fill=INK)
        if sub:
            draw.text((x, y + image.height + 34), sub, font=sub_font, fill=MUTED)
    return card


def save(image: Image.Image, locale: str, slug: str, name: str):
    folder = os.path.join(OUT, locale, slug)
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, name)
    image.save(path, 'PNG', optimize=True)
    print(f'{locale}/{slug}/{name}  {image.width}×{image.height}  {os.path.getsize(path) // 1024}KB')


def main():
    label_font = ImageFont.truetype(BOLD, 18)
    sub_font = ImageFont.truetype(REGULAR, 15)
    for locale, t in TEXT.items():
        cache = os.path.join(CACHE, locale)
        samples = os.path.join(SAMPLES, locale)

        # 압축: 사진 한 곳을 크게 잘라 단계별로 비교한다 (용량은 PDF 전체)
        photos = os.path.join(samples, t['photos'])
        # 문서를 변수에 붙잡아 둔다 (쪽은 문서가 해제되면 쓸 수 없다)
        photos_doc = fitz.open(photos)
        page = photos_doc[0]
        image_rect = page.get_image_rects(page.get_images()[0][0])[0]
        clip = fitz.Rect(
            image_rect.x0 + image_rect.width * 0.36,
            image_rect.y0 + image_rect.height * 0.40,
            image_rect.x0 + image_rect.width * 0.48,
            image_rect.y0 + image_rect.height * 0.52,
        )
        items = [(render(photos, 0, 600, clip), t['levels']['original'], size_label(photos))]
        for level in ('light', 'balanced', 'strong'):
            path = os.path.join(cache, f'compress-{level}.pdf')
            items.append((render(path, 0, 600, clip), t['levels'][level], size_label(path)))
        items = [(image.resize((260, round(260 * image.height / image.width))), a, b) for image, a, b in items]
        save(tiles(items, label_font, sub_font, cols=2), locale, 'compress-pdf', 'levels.png')

        # 모아찍기: 2쪽·4쪽 결과의 첫 장
        items = []
        for count in (2, 4):
            path = os.path.join(cache, f'n-up-{count}.pdf')
            # 종이 방향이 달라도 높이를 맞춰 나란히 둔다
            with fitz.open(path) as sheet:
                height = sheet[0].rect.height
            image = render(path, 0, round(72 * 460 / height))
            items.append((image, t['perSheet'](count), ''))
        save(tiles(items, label_font, sub_font, gap=32), locale, 'n-up-pdf', 'sheets.png')

        # 가리기: 4쪽 위쪽의 담당자 정보 전후
        report = os.path.join(samples, t['report'])
        top = fitz.Rect(40, 40, 400, 260)
        before = render(report, 3, 110, top)
        after = render(os.path.join(cache, 'redact.pdf'), 3, 110, top)
        save(
            tiles([(before, t['before'], ''), (after, t['after'], '')], label_font, sub_font, cols=1),
            locale,
            'redact-pdf',
            'before-after.png',
        )


if __name__ == '__main__':
    main()
