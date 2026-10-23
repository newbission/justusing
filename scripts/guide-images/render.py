"""
가이드 그림 그리기. run-tools.mjs가 우리 도구로 만든 결과(.cache/guide-images/)와 견본(public/samples/)으로
src/assets/guides/<언어>/<글>/에 PNG를 쓴다 (커밋한다. 배포용 WebP는 빌드가 만든다).
움직이는 그림이 있는 글(MOTIONS)은 PNG 대신 public/guide-motion/<언어>/<글>/에 움직이는 WebP와 멈춘 WebP를 쓴다
(Astro 이미지 처리가 애니메이션을 지킨다고 믿지 않고, 글이 <picture>로 직접 부른다. docs/foundations/seo-and-guides).

  python3 scripts/guide-images/render.py   (PyMuPDF·Pillow 필요)

- 그림은 흰 종이 카드 하나로 그린다. 두 테마에서 같은 모습이고, 가이드 글의 테두리·둥근 모서리는 CSS가 맡는다
- 그림 안 글자는 꼬리표(단계 이름·용량)만 둔다. 설명은 가이드 글과 그림 설명(alt)이 맡는다
"""
import csv
import io
import json
import math
import os
import sys
import zipfile

import fitz
from fontTools.ttLib import TTFont
from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageStat

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
        'appendix': '예시-부록.pdf',
        'photos': '예시-사진모음.pdf',
        'scan': '예시-스캔본.pdf',
        'photo': '예시-사진.jpg',
        'screen': '예시-화면캡처.png',
        'levels': {'original': '원본', 'light': '조금', 'balanced': '보통', 'strong': '많이'},
        'perSheet': lambda n: f'한 장에 {n}쪽',
        'before': '원본',
        'after': '가린 결과',
        'page': lambda n: f'{n}쪽',
        'layouts': {'center': '가운데 하나', 'tile': '쪽 전체에 반복'},
        'pageTop': lambda n: f'{n}쪽 위',
        'pageBottom': lambda n: f'{n}쪽 아래',
        'seen': '보이는 모습',
        'inside': '같은 곳에서 꺼낸 글자',
        'cropped': '자른 결과',
        'dpi': {'150': '보통 (150 DPI)', '300': '고화질 (300 DPI)'},
        'recognized': '글자 인식 뒤 (찾은 글자 자리)',
        'fromImage': {'a4': 'A4 · 여백 있음', 'fit': '이미지에 맞춤 · 여백 없음'},
        'metaHead': ('항목', '원본', '모두 지운 뒤'),
        'located': '예시-위치사진.jpg',
        'exifHead': ('항목', '원본', '모든 정보 지우기', '위치만 지우기'),
        'exifFields': {'gps': '위치 (위도, 경도)', 'date': '찍은 날짜', 'device': '기기'},
        'metaFields': [
            ('title', '제목'),
            ('author', '작성자'),
            ('subject', '주제'),
            ('keywords', '키워드'),
            ('creator', '만든 프로그램'),
            ('producer', 'PDF로 만든 프로그램'),
            ('creationDate', '만든 날짜'),
        ],
        'extracted': '꺼낸 사진 (원본)',
        'pageImage': 'PDF를 이미지로 (150 DPI)',
        'formats': {'png': 'PNG (원본)', 'jpg': 'JPG', 'webp': 'WebP'},
        'scrolls': ['예시-대화캡처1.png', '예시-대화캡처2.png', '예시-대화캡처3.png'],
        'capture': lambda n: f'캡처 {n}',
        'stitched': '이은 결과',
        'tilted': '예시-기운사진.jpg',
        'tiltedLabel': '원본: 수평선이 기울었음',
        'straightened': '4° 바로잡고 4:5로 자름',
        'removed': '지워지는 곳',
        'angle': '기울기 바로잡기',
        'car': '예시-번호판사진.jpg',
        'hidden': {'original': '원본', 'blur': '흐리게', 'mosaic': '모자이크', 'fill': '검게 칠하기'},
        'utf8Csv': '예시-주문목록-UTF8.csv',
        # 엑셀이 BOM 없는 CSV를 읽는 인코딩 (한국어 윈도우)과 그림에 보일 칸 (받는 분·상품·금액)
        'excelCodec': 'cp949',
        'csvColumns': (2, 4, 6),
        'csvBefore': '엑셀에서 연 원본 (UTF-8, BOM 없음)',
        'csvAfter': '엑셀용 UTF-8로 바꾼 뒤',
        'heic': '예시-아이폰사진2.heic',
        'heicStored': 'HEIC 안의 화소 (누운 채)',
        'heicResult': 'JPG로 바꾼 결과',
        'chat1': '예시-대화캡처1.png',
        'ocrTilted': '12° 기울여 찍은 서류',
        'ocrChat': '대화 캡처',
        'ocrLines': lambda n: f'읽은 줄 {n}개',
        'fitted': {'original': '원본', 'resize': '크기도 줄이기', 'keep': '화질만'},
    },
    'en': {
        'report': 'sample-report.pdf',
        'appendix': 'sample-appendix.pdf',
        'photos': 'sample-photos.pdf',
        'scan': 'sample-scan.pdf',
        'photo': 'sample-photo.jpg',
        'screen': 'sample-screenshot.png',
        'levels': {'original': 'Original', 'light': 'Less', 'balanced': 'Balanced', 'strong': 'More'},
        'perSheet': lambda n: f'{n} pages per sheet',
        'before': 'Original',
        'after': 'Redacted',
        'page': lambda n: f'Page {n}',
        'layouts': {'center': 'Once in the center', 'tile': 'Repeated across the page'},
        'pageTop': lambda n: f'Top of page {n}',
        'pageBottom': lambda n: f'Bottom of page {n}',
        'seen': 'What you see',
        'inside': 'Text pulled from the same spot',
        'cropped': 'Cropped',
        'dpi': {'150': 'Standard (150 DPI)', '300': 'High (300 DPI)'},
        'recognized': 'After OCR (where text was found)',
        'fromImage': {'a4': 'A4 · Small margin', 'fit': 'Fit to image · No margin'},
        'metaHead': ('Field', 'Original', 'After removing all'),
        'located': 'sample-photo-with-location.jpg',
        'exifHead': ('Field', 'Original', 'Remove all info', 'Location only'),
        'exifFields': {'gps': 'Location (lat, long)', 'date': 'Date taken', 'device': 'Device'},
        'metaFields': [
            ('title', 'Title'),
            ('author', 'Author'),
            ('subject', 'Subject'),
            ('keywords', 'Keywords'),
            ('creator', 'Creator'),
            ('producer', 'PDF producer'),
            ('creationDate', 'Created'),
        ],
        'extracted': 'Extracted photo (original)',
        'pageImage': 'PDF to image (150 DPI)',
        'formats': {'png': 'PNG (original)', 'jpg': 'JPG', 'webp': 'WebP'},
        'scrolls': ['sample-chat-1.png', 'sample-chat-2.png', 'sample-chat-3.png'],
        'capture': lambda n: f'Screenshot {n}',
        'stitched': 'Stitched',
        'tilted': 'sample-tilted-photo.jpg',
        'tiltedLabel': 'Original: tilted horizon',
        'straightened': 'Straightened 4°, cropped to 4:5',
        'removed': 'Removed',
        'angle': 'Straighten',
        'car': 'sample-license-plate.jpg',
        'hidden': {'original': 'Original', 'blur': 'Blur', 'mosaic': 'Mosaic', 'fill': 'Black out'},
        'utf8Csv': 'sample-orders-utf8.csv',
        # 서유럽 윈도우의 엑셀 기본 인코딩. 칸: Customer·City·Product
        'excelCodec': 'cp1252',
        'csvColumns': (2, 3, 4),
        'csvBefore': 'Original opened in Excel (UTF-8, no BOM)',
        'csvAfter': 'After converting to UTF-8 with BOM',
        'heic': 'sample-iphone-photo-2.heic',
        'heicStored': 'Pixels inside the HEIC (lying)',
        'heicResult': 'Converted to JPG',
        'chat1': 'sample-chat-1.png',
        'ocrTilted': 'Paper shot at 12°',
        'ocrChat': 'Chat screenshot',
        'ocrLines': lambda n: f'{n} lines read',
        'fitted': {'original': 'Original', 'resize': 'Also resize', 'keep': 'Quality only'},
    },
}


def render(path: str, index: int, dpi: int, clip: fitz.Rect | None = None) -> Image.Image:
    with fitz.open(path) as doc:
        pixmap = doc[index].get_pixmap(dpi=dpi, clip=clip)
    return Image.open(io.BytesIO(pixmap.tobytes('png'))).convert('RGB')


def size_label(path: str) -> str:
    kb = os.path.getsize(path) / 1024
    return f'{kb / 1024:.1f}MB' if kb >= 1024 else f'{kb:.0f}KB'


def tile_layout(items, label_font, sub_font, gap=16, cols=None):
    """tiles()의 자리 계산: (카드 가로, 카드 세로, 칸마다 그림 왼쪽 위 (x, y), 칸마다 꼬리표 y).
    움직이는 그림도 같은 자리를 쓴다"""
    cols = cols or len(items)
    rows = (len(items) + cols - 1) // cols
    # 꼬리표가 하나도 없으면 아래 칸을 두지 않는다
    label_h = 52 if any(label for _, label, _ in items) else 0

    def need(image, label, sub):
        """그림과 꼬리표가 잘리지 않는 폭"""
        return max(image.width, label_font.getlength(label), sub_font.getlength(sub or ''))

    # 한 줄이면 그림마다 제 폭만 쓴다 (가로·세로 종이를 나란히 둘 때). 여러 줄이면 칸마다 가장 넓은 것
    if rows == 1:
        widths = [round(need(*item)) for item in items]
    else:
        widths = [round(max(need(*item) for item in items[col::cols])) for col in range(cols)]
    # 줄마다 가장 높은 그림에 맞춰 꼬리표를 같은 높이에 단다
    heights = [max(image.height for image, _, _ in items[row * cols : (row + 1) * cols]) for row in range(rows)]
    width = PAD * 2 + sum(widths) + gap * (cols - 1)
    height = PAD * 2 + sum(heights) + label_h * rows + gap * (rows - 1)
    origins = []
    label_ys = []
    for index in range(len(items)):
        row, col = divmod(index, cols)
        x = PAD + sum(widths[:col]) + col * gap
        y = PAD + sum(heights[:row]) + row * (label_h + gap)
        origins.append((x, y))
        label_ys.append(y + heights[row] + 12)
    return width, height, origins, label_ys


def tiles(items, label_font, sub_font, gap=16, cols=None):
    """그림 여러 장을 cols칸 격자로 늘어놓고 아래에 꼬리표(굵게)와 작은 설명을 단다.
    휴대폰에서는 그림이 화면 폭으로 줄어드므로, 꼬리표가 읽히게 칸 수를 적게 잡는다"""
    width, height, origins, label_ys = tile_layout(items, label_font, sub_font, gap, cols)
    card = Image.new('RGB', (width, height), BG)
    draw = ImageDraw.Draw(card)
    for (image, label, sub), (x, y), label_y in zip(items, origins, label_ys):
        card.paste(image, (x, y))
        draw.rectangle([x, y, x + image.width - 1, y + image.height - 1], outline=LINE)
        draw.text((x, label_y), label, font=label_font, fill=INK)
        if sub:
            draw.text((x, label_y + 22), sub, font=sub_font, fill=MUTED)
    return card


def save(image: Image.Image, locale: str, slug: str, name: str):
    folder = os.path.join(OUT, locale, slug)
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, name)
    image.save(path, 'PNG', optimize=True)
    print(f'{locale}/{slug}/{name}  {image.width}×{image.height}  {os.path.getsize(path) // 1024}KB')


def from_zip(path: str, index: int) -> tuple[Image.Image, int]:
    """ZIP 안의 index번째 이미지와 그 파일 크기 (이름 순)"""
    with zipfile.ZipFile(path) as archive:
        info = sorted(archive.infolist(), key=lambda item: item.filename)[index]
        data = archive.read(info)
    return Image.open(io.BytesIO(data)).convert('RGB'), len(data)


def kb(size: int) -> str:
    return f'{size / 1024 / 1024:.1f}MB' if size >= 1024 * 1024 else f'{size / 1024:.0f}KB'


def fit_width(image: Image.Image, width: int, resample=Image.BICUBIC) -> Image.Image:
    return image.resize((width, round(width * image.height / image.width)), resample)


def fit_height(image: Image.Image, height: int) -> Image.Image:
    return image.resize((round(height * image.width / image.height), height), Image.LANCZOS)


def rel(page: fitz.Page, x0, y0, x1, y1) -> fitz.Rect:
    """쪽 크기에 대한 비율로 자리를 잡는다"""
    r = page.rect
    return fitz.Rect(r.width * x0, r.height * y0, r.width * x1, r.height * y1)


def page_rect(path: str, index: int, *box) -> fitz.Rect:
    with fitz.open(path) as doc:
        return rel(doc[index], *box)


def compress_pdf(t, cache, samples, fonts):
    # 사진 한 곳을 크게 잘라 단계별로 비교한다 (용량은 PDF 전체)
    photos = os.path.join(samples, t['photos'])
    with fitz.open(photos) as doc:
        page = doc[0]
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
    items = [(fit_width(image, 260), a, b) for image, a, b in items]
    return 'compress-pdf', 'levels.png', tiles(items, *fonts, cols=2)


def n_up_pdf(t, cache, samples, fonts):
    # 2쪽·4쪽 결과의 첫 장. 종이 방향이 달라도 높이를 맞춰 나란히 둔다
    items = []
    for count in (2, 4):
        path = os.path.join(cache, f'n-up-{count}.pdf')
        with fitz.open(path) as sheet:
            height = sheet[0].rect.height
        items.append((render(path, 0, round(72 * 460 / height)), t['perSheet'](count), ''))
    return 'n-up-pdf', 'sheets.png', tiles(items, *fonts, gap=32)


def redact_pdf(t, cache, samples, fonts):
    # 4쪽 위쪽의 담당자 정보 전후
    report = os.path.join(samples, t['report'])
    top = fitz.Rect(40, 40, 400, 260)
    before = render(report, 3, 110, top)
    after = render(os.path.join(cache, 'redact.pdf'), 3, 110, top)
    items = [(before, t['before'], ''), (after, t['after'], '')]
    return 'redact-pdf', 'before-after.png', tiles(items, *fonts, cols=1)


def merge_pdf(t, cache, samples, fonts):
    # 합친 PDF의 쪽을 차례대로. 쪽 아래에 어느 파일에서 왔는지 적는다
    path = os.path.join(cache, 'merge.pdf')
    with fitz.open(path) as doc:
        count = len(doc)
    items = []
    for index in range(count):
        source = t['report'] if index < 4 else t['appendix']
        items.append((render(path, index, 22), t['page'](index + 1), source))
    return 'merge-pdf', 'merged.png', tiles(items, *fonts, cols=3)


def watermark_pdf(t, cache, samples, fonts):
    items = []
    for layout in ('center', 'tile'):
        path = os.path.join(cache, f'watermark-{layout}.pdf')
        items.append((render(path, 0, 34), t['layouts'][layout], ''))
    return 'watermark-pdf', 'layouts.png', tiles(items, *fonts, gap=32)


def header_footer_pdf(t, cache, samples, fonts):
    # 1쪽 위의 머리말과, 쪽마다 바뀌는 꼬리말
    path = os.path.join(cache, 'header-footer.pdf')
    items = [(render(path, 0, 96, page_rect(path, 0, 0.04, 0.02, 0.6, 0.082)), t['pageTop'](1), '')]
    for index in (0, 1):
        clip = page_rect(path, index, 0.04, 0.925, 0.6, 0.985)
        items.append((render(path, index, 96, clip), t['pageBottom'](index + 1), ''))
    return 'header-footer-pdf', 'header-footer.png', tiles(items, *fonts, cols=1)


def sign_pdf(t, cache, samples, fonts):
    path = os.path.join(cache, 'sign.pdf')
    image = render(path, 0, 110, page_rect(path, 0, 0.08, 0.06, 0.92, 0.235))
    return 'sign-pdf', 'signed.png', tiles([(image, '', '')], *fonts)


def edit_pdf(t, cache, samples, fonts):
    # 흰색으로 가린 표. 같은 곳의 글자를 파일에서 꺼내 그 자리에 다시 적어 보인다
    path = os.path.join(cache, 'edit.pdf')
    dpi = 110
    with fitz.open(path) as doc:
        page = doc[0]
        clip = rel(page, 0.1, 0.34, 0.9, 0.475)
        hidden = rel(page, 0.125, 0.411, 0.8, 0.438)
        words = [w for w in page.get_text('words') if fitz.Rect(w[:4]).intersects(hidden)]
    seen = render(path, 0, dpi, clip)
    inside = seen.copy()
    draw = ImageDraw.Draw(inside)
    scale = dpi / 72
    word_font = ImageFont.truetype(REGULAR, round(9 * scale))
    for x0, y0, x1, y1, text, *_ in words:
        box = [(x0 - clip.x0) * scale, (y0 - clip.y0) * scale, (x1 - clip.x0) * scale, (y1 - clip.y0) * scale]
        draw.rectangle([box[0] - 2, box[1] - 2, box[2] + 2, box[3] + 2], outline=GREEN, width=2)
        draw.text((box[0], box[1]), text, font=word_font, fill=GREEN)
    items = [(seen, t['seen'], ''), (inside, t['inside'], '')]
    return 'edit-pdf', 'white-out.png', tiles(items, *fonts, cols=1)


def crop_pdf(t, cache, samples, fonts):
    # 원본과 자른 결과를 같은 폭으로: 여백이 빠진 만큼 글자가 커진다
    report = os.path.join(samples, t['report'])
    cropped = os.path.join(cache, 'crop.pdf')
    items = [
        (fit_width(render(report, 0, 110), 270), t['before'], ''),
        (fit_width(render(cropped, 0, 130), 270), t['cropped'], ''),
    ]
    return 'crop-pdf-margins', 'before-after.png', tiles(items, *fonts, gap=24)


def pdf_to_jpg(t, cache, samples, fonts):
    # 1쪽 표의 같은 곳을 같은 크기로 키워 비교한다 (용량은 1쪽 이미지 하나)
    items = []
    for dpi in ('150', '300'):
        image, size = from_zip(os.path.join(cache, f'to-image-{dpi}.zip'), 0)
        w, h = image.size
        crop = image.crop((round(w * 0.13), round(h * 0.38), round(w * 0.27), round(h * 0.44)))
        items.append((fit_width(crop, 260, Image.NEAREST), t['dpi'][dpi], f'{w}×{h} · {kb(size)}'))
    return 'pdf-to-jpg', 'dpi.png', tiles(items, *fonts)


def ocr_pdf(t, cache, samples, fonts):
    # 인식한 PDF에서 글자가 들어간 자리를 초록 상자로 표시한다
    path = os.path.join(cache, 'ocr.pdf')
    dpi = 66
    with fitz.open(path) as doc:
        page = doc[0]
        clip = rel(page, 0.06, 0.05, 0.94, 0.5)
        words = page.get_text('words')
    scan = render(os.path.join(samples, t['scan']), 0, dpi, clip)
    found = render(path, 0, dpi, clip)
    # 글자를 고른 것처럼 칠한다
    marks = Image.new('RGBA', found.size)
    draw = ImageDraw.Draw(marks)
    scale = dpi / 72
    for x0, y0, x1, y1, *_ in words:
        draw.rectangle(
            [(x0 - clip.x0) * scale, (y0 - clip.y0) * scale, (x1 - clip.x0) * scale, (y1 - clip.y0) * scale],
            fill=GREEN + (80,),
        )
    found = Image.alpha_composite(found.convert('RGBA'), marks).convert('RGB')
    items = [(scan, t['before'], ''), (found, t['recognized'], '')]
    return 'ocr-pdf', 'text-layer.png', tiles(items, *fonts, cols=1)


def photos_to_pdf(t, cache, samples, fonts):
    items = []
    for name in ('a4', 'fit'):
        path = os.path.join(cache, f'from-image-{name}.pdf')
        with fitz.open(path) as doc:
            height = doc[0].rect.height
        items.append((render(path, 0, round(72 * 380 / height)), t['fromImage'][name], ''))
    return 'photos-to-pdf', 'page-sizes.png', tiles(items, *fonts, gap=32)


def pdf_metadata(t, cache, samples, fonts):
    # 견본과 '모두 지우기'로 저장한 결과의 문서 정보를 표로
    def info(path):
        with fitz.open(path) as doc:
            meta = dict(doc.metadata)
        date = meta.get('creationDate') or ''
        if date.startswith('D:') and len(date) >= 14:
            meta['creationDate'] = f'{date[2:6]}-{date[6:8]}-{date[8:10]} {date[10:12]}:{date[12:14]}'
        return meta

    before = info(os.path.join(samples, t['report']))
    after = info(os.path.join(cache, 'metadata.pdf'))
    label_font, sub_font = fonts
    cell = ImageFont.truetype(REGULAR, 16)
    rows = [t['metaHead']] + [(name, before.get(key) or '—', after.get(key) or '—') for key, name in t['metaFields']]
    widths = [max(cell.getlength(row[col]) for row in rows) + 28 for col in range(3)]
    row_h = 36
    width = round(PAD * 2 + sum(widths))
    height = PAD * 2 + row_h * len(rows)
    card = Image.new('RGB', (width, height), BG)
    draw = ImageDraw.Draw(card)
    for r, row in enumerate(rows):
        y = PAD + r * row_h
        if r:
            draw.line([PAD, y, width - PAD, y], fill=LINE)
        x = PAD
        for c, text in enumerate(row):
            font = label_font if r == 0 else cell
            color = MUTED if r == 0 or text == '—' else INK
            draw.text((x + 4, y + row_h / 2), text, font=font, fill=color, anchor='lm')
            x += widths[c]
    return 'pdf-metadata', 'before-after.png', card


def exif_summary(path: str) -> dict:
    """사진 파일 안의 위치·찍은 날짜·기기 (Pillow로 직접 읽는다)"""
    exif = Image.open(path).getexif()
    gps = exif.get_ifd(0x8825)
    out = {}
    if 2 in gps and 4 in gps:
        lat = sum(float(v) / 60 ** i for i, v in enumerate(gps[2])) * (-1 if gps.get(1) == 'S' else 1)
        lon = sum(float(v) / 60 ** i for i, v in enumerate(gps[4])) * (-1 if gps.get(3) == 'W' else 1)
        out['gps'] = f'{lat:.4f}, {lon:.4f}'
    date = exif.get_ifd(0x8769).get(0x9003)
    if date:
        out['date'] = f'{date[:4]}-{date[5:7]}-{date[8:10]} {date[11:16]}'
    device = ' '.join(v for v in (exif.get(0x010F), exif.get(0x0110)) if v)
    if device:
        out['device'] = device
    return out


def photo_location(t, cache, samples, fonts):
    # 견본과 두 방식으로 지운 결과의 촬영 정보를 표로
    columns = [
        exif_summary(os.path.join(samples, t['located'])),
        exif_summary(os.path.join(cache, 'remove-location-all.jpg')),
        exif_summary(os.path.join(cache, 'remove-location-location.jpg')),
    ]
    label_font, _ = fonts
    cell = ImageFont.truetype(REGULAR, 16)
    rows = [t['exifHead']] + [
        (name, *(column.get(key) or '—' for column in columns)) for key, name in t['exifFields'].items()
    ]
    widths = [max(cell.getlength(row[col]) for row in rows) + 28 for col in range(4)]
    row_h = 36
    width = round(PAD * 2 + sum(widths))
    height = PAD * 2 + row_h * len(rows)
    card = Image.new('RGB', (width, height), BG)
    draw = ImageDraw.Draw(card)
    for r, row in enumerate(rows):
        y = PAD + r * row_h
        if r:
            draw.line([PAD, y, width - PAD, y], fill=LINE)
        x = PAD
        for c, text in enumerate(row):
            font = label_font if r == 0 else cell
            color = MUTED if r == 0 or text == '—' else INK
            draw.text((x + 4, y + row_h / 2), text, font=font, fill=color, anchor='lm')
            x += widths[c]
    return 'photo-location', 'before-after.png', card


# 깨진 글자(한자·�)는 Pretendard에 없어 macOS 글꼴로 그린다 (render.py는 맥에서 돌린다)
FALLBACK_FONTS = [
    (REGULAR, 0),
    ('/System/Library/Fonts/AppleSDGothicNeo.ttc', 0),
    ('/System/Library/Fonts/LucidaGrande.ttc', 0),
]


def mixed_fonts(size: int):
    """글자마다 그 글자가 있는 첫 글꼴로 그리기 위한 (글꼴, 글자 표) 목록"""
    out = []
    for path, index in FALLBACK_FONTS:
        tt = TTFont(path, fontNumber=index)
        out.append((ImageFont.truetype(path, size, index=index), set(tt.getBestCmap())))
    return out


def runs(text: str, fonts):
    """글자를 같은 글꼴끼리 묶는다"""
    out = []
    for char in text:
        font = next((f for f, cmap in fonts if ord(char) in cmap), fonts[0][0])
        if out and out[-1][0] is font:
            out[-1][1] += char
        else:
            out.append([font, char])
    return out


def mixed_length(text: str, fonts) -> float:
    return sum(font.getlength(part) for font, part in runs(text, fonts))


def draw_mixed(draw, x, y, text, fonts, fill):
    for font, part in runs(text, fonts):
        draw.text((x, y), part, font=font, fill=fill, anchor='lm')
        x += font.getlength(part)


def sheet(rows, fonts, widths) -> Image.Image:
    """엑셀처럼 칸 이름(A, B…)과 줄 번호를 단 표"""
    row_h = 40
    head_w = 40
    width = head_w + sum(widths)
    height = row_h * (len(rows) + 1)
    image = Image.new('RGB', (width, height), BG)
    draw = ImageDraw.Draw(image)
    head = (244, 244, 241)
    draw.rectangle([0, 0, width, row_h], fill=head)
    draw.rectangle([0, 0, head_w, height], fill=head)
    small = fonts[0][0].font_variant(size=15)
    for c in range(len(widths)):
        x = head_w + sum(widths[:c])
        draw.text((x + widths[c] / 2, row_h / 2), chr(65 + c), font=small, fill=MUTED, anchor='mm')
    for r, row in enumerate(rows):
        y = row_h * (r + 1)
        draw.text((head_w / 2, y + row_h / 2), str(r + 1), font=small, fill=MUTED, anchor='mm')
        for c, text in enumerate(row):
            x = head_w + sum(widths[:c])
            draw_mixed(draw, x + 12, y + row_h / 2, text, fonts, INK)
    for r in range(len(rows) + 2):
        draw.line([0, r * row_h, width, r * row_h], fill=LINE)
    for c in range(len(widths) + 1):
        x = head_w + sum(widths[:c])
        draw.line([x, 0, x, height], fill=LINE)
    draw.line([0, 0, 0, height], fill=LINE)
    return image


def csv_encoding(t, cache, samples, fonts):
    # 견본(BOM 없는 UTF-8)을 엑셀이 읽는 인코딩으로 읽은 모습과, 도구로 바꾼 파일을 읽은 모습
    original = open(os.path.join(samples, t['utf8Csv']), 'rb').read()
    converted = open(os.path.join(cache, 'csv-encoding.csv'), 'rb').read()
    assert converted.startswith(b'\xef\xbb\xbf') and not original.startswith(b'\xef\xbb\xbf')

    def table(text: str):
        rows = list(csv.reader(io.StringIO(text)))[:4]
        return [[row[c] for c in t['csvColumns']] for row in rows]

    before = table(original.decode(t['excelCodec'], errors='replace'))
    after = table(converted.decode('utf-8-sig'))
    cell_fonts = mixed_fonts(18)
    widths = [
        round(max(mixed_length(row[c], cell_fonts) for row in before + after) + 24)
        for c in range(len(t['csvColumns']))
    ]
    items = [
        (sheet(before, cell_fonts, widths), t['csvBefore'], ''),
        (sheet(after, cell_fonts, widths), t['csvAfter'], ''),
    ]
    return 'fix-csv-encoding', 'before-after.png', tiles(items, *fonts, cols=1)


def fill_pdf_form(t, cache, samples, fonts):
    path = os.path.join(cache, 'fill-form.pdf')
    image = render(path, 0, 96, page_rect(path, 0, 0.08, 0.06, 0.92, 0.428))
    return 'fill-pdf-form', 'filled.png', tiles([(image, '', '')], *fonts)


def extract_images_pdf(t, cache, samples, fonts):
    # 1쪽 사진의 같은 곳을 같은 크기로 키운다: 꺼낸 원본과, 쪽을 150 DPI 이미지로 만든 것
    photos = os.path.join(samples, t['photos'])
    with fitz.open(photos) as doc:
        page = doc[0]
        rect = page.get_image_rects(page.get_images()[0][0])[0]
        page_w, page_h = page.rect.width, page.rect.height
    box = (0.34, 0.12, 0.46, 0.28)
    original, size = from_zip(os.path.join(cache, 'extract-images.zip'), 0)
    w, h = original.size
    a = original.crop((round(w * box[0]), round(h * box[1]), round(w * box[2]), round(h * box[3])))
    shot, shot_size = from_zip(os.path.join(cache, 'extract-images-page.zip'), 0)
    sx, sy = shot.width / page_w, shot.height / page_h
    b = shot.crop(
        (
            round((rect.x0 + rect.width * box[0]) * sx),
            round((rect.y0 + rect.height * box[1]) * sy),
            round((rect.x0 + rect.width * box[2]) * sx),
            round((rect.y0 + rect.height * box[3]) * sy),
        )
    )
    items = [
        (fit_width(a, 260, Image.NEAREST), t['extracted'], f'{w}×{h}'),
        (fit_width(b, 260, Image.NEAREST), t['pageImage'], f'{shot.width}×{shot.height}'),
    ]
    return 'extract-images-pdf', 'compare.png', tiles(items, *fonts)


def compress_image(t, cache, samples, fonts):
    photo = os.path.join(samples, t['photo'])
    paths = [
        (photo, t['levels']['original']),
        (os.path.join(cache, 'image-compress-balanced.jpg'), t['levels']['balanced']),
        (os.path.join(cache, 'image-compress-strong.jpg'), t['levels']['strong']),
    ]
    items = []
    for path, label in paths:
        image = Image.open(path).convert('RGB')
        w, h = image.size
        crop = image.crop((round(w * 0.47), round(h * 0.22), round(w * 0.55), round(h * 0.32)))
        items.append((fit_width(crop, 200), label, size_label(path)))
    return 'compress-image', 'levels.png', tiles(items, *fonts)


def photo_size_limit(t, cache, samples, fonts):
    # 30KB 목표: 크기도 줄인 것과 화질만 낮춘 것. 해 둘레와 하늘을 같은 크기로 잘라 놓는다
    # (화질만 낮추면 하늘에 네모 얼룩이 생기고, 크기를 줄이면 조금 흐려질 뿐이다)
    photo = os.path.join(samples, t['photo'])
    paths = [
        (photo, t['fitted']['original']),
        (os.path.join(cache, 'target-size-resize.jpg'), t['fitted']['resize']),
        (os.path.join(cache, 'target-size-keep.jpg'), t['fitted']['keep']),
    ]
    items = []
    for path, label in paths:
        image = Image.open(path).convert('RGB')
        w, h = image.size
        crop = image.crop((round(w * 0.44), round(h * 0.2), round(w * 0.58), round(h * 0.38)))
        items.append((fit_width(crop, 220), label, f'{w}×{h} · {size_label(path)}'))
    return 'photo-size-limit', 'compare.png', tiles(items, *fonts)


def resize_image(t, cache, samples, fonts):
    # 원래 크기 대비 같은 비율로 줄여 그린다
    photo = os.path.join(samples, t['photo'])
    paths = [(photo, '100%')] + [(os.path.join(cache, f'image-resize-{p}.jpg'), f'{p}%') for p in (50, 25)]
    base = Image.open(photo).width
    items = []
    for path, label in paths:
        image = Image.open(path).convert('RGB')
        items.append(
            (fit_width(image, round(320 * image.width / base)), label, f'{image.width}×{image.height} · {size_label(path)}')
        )
    return 'resize-image', 'sizes.png', tiles(items, *fonts, gap=20)


def convert_image(t, cache, samples, fonts):
    # 화면 캡처의 글자 둘레를 크게: JPG는 글자 가장자리에 얼룩이 생긴다
    screen = os.path.join(samples, t['screen'])
    paths = [
        (screen, t['formats']['png']),
        (os.path.join(cache, 'image-convert.jpg'), t['formats']['jpg']),
        (os.path.join(cache, 'image-convert.webp'), t['formats']['webp']),
    ]
    items = []
    for path, label in paths:
        image = Image.open(path).convert('RGB')
        crop = image.crop(CONVERT_CROP)
        items.append((fit_width(crop, 200, Image.NEAREST), label, size_label(path)))
    return 'convert-image', 'formats.png', tiles(items, *fonts)


CONVERT_CROP = (52, 160, 116, 206)


def heic_to_jpg(t, cache, samples, fonts):
    # 세로로 들고 찍은 견본: HEIC 안의 화소는 누워 있고 회전 표시(irot)만 붙어 있다. 바꾼 JPG는 바로 서 있다.
    # 왼쪽은 결과를 회전 표시만큼 되돌려 그린 것이다 (HEIC에 담긴 화소의 모습, 그림 크기는 원본 파일 크기를 적는다)
    heic = os.path.join(samples, t['heic'])
    result = os.path.join(cache, 'heic-to-jpg.jpg')
    upright = Image.open(result).convert('RGB')
    stored = upright.transpose(Image.Transpose.ROTATE_90)
    items = [
        (fit_height(stored, 225), t['heicStored'], f'HEIC · {stored.width}×{stored.height} · {size_label(heic)}'),
        (fit_height(upright, 300), t['heicResult'], f'JPG · {upright.width}×{upright.height} · {size_label(result)}'),
    ]
    return 'heic-to-jpg', 'upright.png', tiles(items, *fonts, gap=24)


def stitch_screenshots(t, cache, samples, fonts):
    # 캡처 세 장과 이은 결과를 같은 비율로 줄여 나란히 둔다 (겹친 부분과 막대가 빠져 세 장 합보다 짧다)
    scale = 300 / 1334
    paths = [(os.path.join(samples, name), t['capture'](n + 1)) for n, name in enumerate(t['scrolls'])]
    paths.append((os.path.join(cache, 'stitch.png'), t['stitched']))
    items = []
    for path, label in paths:
        image = Image.open(path).convert('RGB')
        items.append((fit_width(image, round(image.width * scale), Image.LANCZOS), label, f'{image.width}×{image.height}'))
    return 'stitch-screenshots', 'stitched.png', tiles(items, *fonts, gap=20)

def crop_rotate_photo(t, cache, samples, fonts):
    # 기운 원본과 기울기를 바로잡아 4:5로 자른 결과를 같은 높이로 나란히 둔다
    items = []
    for path, label in [(os.path.join(samples, t['tilted']), t['tiltedLabel']), (os.path.join(cache, 'crop.jpg'), t['straightened'])]:
        image = Image.open(path).convert('RGB')
        small = image.resize((round(image.width * 300 / image.height), 300), Image.LANCZOS)
        items.append((small, label, f'{image.width}×{image.height}'))
    return 'crop-rotate-photo', 'straightened.png', tiles(items, *fonts, gap=20)

def hide_info_in_photo(t, cache, samples, fonts):
    # 견본의 번호판 둘레를 원본·흐림·모자이크·검게 칠하기 결과에서 같은 자리로 잘라 2칸씩 늘어놓는다
    box = (560, 740, 1040, 930)
    items = []
    for key in ['original', 'blur', 'mosaic', 'fill']:
        path = os.path.join(samples, t['car']) if key == 'original' else os.path.join(cache, f'mosaic-{key}.jpg')
        image = Image.open(path).convert('RGB').crop(box)
        items.append((fit_width(image, 320, Image.LANCZOS), t['hidden'][key], ''))
    return 'hide-info-in-photo', 'compare.png', tiles(items, *fonts, gap=20, cols=2)

def image_ocr(t, cache, samples, fonts):
    # 도구가 읽은 줄 자리(.cache의 ocr-lines.json)를 원래 이미지 위에 상자로 그린다 (초록 말풍선 위에서도 보이게 테두리는 검게).
    # 기운 사진은 바로 세워 읽은 줄이 이미지 위에서는 기운 상자로 돌아온다
    with open(os.path.join(cache, 'ocr-lines.json'), encoding='utf-8') as file:
        found = json.load(file)
    sources = [
        (os.path.join(cache, 'ocr-tilted.jpg'), t['ocrTilted']),
        (os.path.join(samples, t['chat1']), t['ocrChat']),
    ]
    items = []
    for (path, label), lines in zip(sources, found):
        image = Image.open(path).convert('RGB')
        height = 420
        scale = height / image.height
        image = image.resize((round(image.width * scale), height), Image.LANCZOS).convert('RGBA')
        marks = Image.new('RGBA', image.size)
        draw = ImageDraw.Draw(marks)
        for points in lines:
            polygon = [(points[i] * scale, points[i + 1] * scale) for i in range(0, len(points), 2)]
            draw.polygon(polygon, fill=GREEN + (70,), outline=INK + (255,), width=2)
        image = Image.alpha_composite(image, marks).convert('RGB')
        items.append((image, label, t['ocrLines'](len(lines))))
    return 'image-to-text', 'lines.png', tiles(items, *fonts, gap=24)


# ---- 움직이는 그림 (2026-10-23) ----
# 정지 그림과 같은 칸 자리·크기로 3~4초 움직이는 그림. 재료도 같다: 견본과 도구가 만든 실제 결과
# (끝 화면은 도구가 만든 결과 그대로). 파일은 public/guide-motion/에 쓴다. Astro 이미지 처리를 거치지 않는
# 애니메이션 WebP다. 같은 곳에 멈춘 그림(<이름>-still.webp)도 쓴다: '움직임 줄이기'를 켠 사람에게 보인다.
MOTION_OUT = os.path.join(ROOT, 'public', 'guide-motion')
MOTION_QUALITY = 70
STILL_QUALITY = 88
FRAME_MS = 50  # 20fps. 멈춘 구간은 프레임 하나에 긴 시간을 준다
WARN = (214, 96, 58)  # 지워지는 곳 표시색


def ease(x: float) -> float:
    """천천히 시작해 천천히 멈춘다 (0~1)"""
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


def span(now: float, start: float, end: float) -> float:
    """now(ms)가 start~end 사이에서 0에서 1로 가는 정도"""
    return min(max((now - start) / (end - start), 0.0), 1.0)


def mix(color, alpha: float):
    """배경(흰색)에서 color까지 alpha만큼 짙은 색"""
    return tuple(round(BG[i] + (color[i] - BG[i]) * alpha) for i in range(3))


def tint(image: Image.Image, color, alpha: float) -> Image.Image:
    return Image.blend(image, Image.new('RGB', image.size, color), alpha)


def dashed_box(draw: ImageDraw.ImageDraw, x, y, w, h, color):
    """점선 상자 (아직 비어 있는 칸)"""
    for px in range(x, x + w, 8):
        draw.line([(px, y), (min(px + 3, x + w - 1), y)], fill=color)
        draw.line([(px, y + h - 1), (min(px + 3, x + w - 1), y + h - 1)], fill=color)
    for py in range(y, y + h, 8):
        draw.line([(x, py), (x, min(py + 3, y + h - 1))], fill=color)
        draw.line([(x + w - 1, py), (x + w - 1, min(py + 3, y + h - 1))], fill=color)


def caption(draw, fonts, x, y, text, sub='', alpha=1.0):
    bold, regular = fonts
    draw.text((x, y), text, font=bold, fill=mix(INK, alpha))
    if sub:
        draw.text((x, y + 22), sub, font=regular, fill=mix(MUTED, alpha))


def timeline(frame, steps, loop_ms):
    """steps: (시작, 끝, 움직임 여부). 멈춘 구간은 프레임 하나에 긴 시간을, 움직이는 구간은 FRAME_MS마다 한 장씩.
    마지막에 loop_ms 동안 끝 그림에서 처음 그림으로 서서히 바뀌어 반복이 끊기지 않는다"""
    frames, durations = [], []
    for start, end, moving in steps:
        if moving:
            now = start
            while now < end:
                frames.append(frame(now))
                durations.append(min(FRAME_MS, round(end - now)))
                now += FRAME_MS
        else:
            frames.append(frame(start))
            durations.append(round(end - start))
    last, first = frames[-1], frames[0]
    count = max(1, round(loop_ms / FRAME_MS))
    for i in range(1, count + 1):
        frames.append(Image.blend(last, first, ease(i / count)))
        durations.append(FRAME_MS)
    return frames, durations


def kept_rows(stitched: Image.Image, captures: list[Image.Image]):
    """이은 결과가 캡처마다 어느 줄을 가져왔는지 되짚는다 (결과의 줄과 캡처의 줄이 같은지로 찾는다).
    캡처마다 (가져온 줄 시작, 끝, 결과에서의 시작 줄). 겹친 부분은 앞 캡처가 가져가고,
    다음 캡처는 그 아래부터 가져온다 (도구가 지우는 것과 같은 결과)"""

    def rows(image):
        data = image.tobytes()
        step = image.width * 3
        return [data[i * step : (i + 1) * step] for i in range(image.height)]

    result = rows(stitched)
    index: dict[bytes, list[int]] = {}
    for y, row in enumerate(result):
        index.setdefault(row, []).append(y)
    found = []
    for capture in captures:
        lines = rows(capture)
        votes: dict[int, int] = {}
        for r, row in enumerate(lines):
            hits = index.get(row, [])
            if 0 < len(hits) <= 2:
                for y in hits:
                    votes[y - r] = votes.get(y - r, 0) + 1
        offset = max(votes, key=votes.get)
        best, start = (0, 0), None
        for r in range(len(lines) + 1):
            same = r < len(lines) and 0 <= r + offset < len(result) and result[r + offset] == lines[r]
            if same and start is None:
                start = r
            if not same and start is not None:
                if r - start > best[1] - best[0]:
                    best = (start, r)
                start = None
        found.append((offset, best[0], best[1]))
    kept = []
    done = 0  # 결과에서 지금까지 채운 줄
    for offset, first, last in found:
        top = max(first, done - offset)
        kept.append((top, last, top + offset))
        done = last + offset
    assert kept[0][2] == 0 and done == stitched.height, (kept, stitched.height)
    return kept


def stitch_motion(t, cache, samples, fonts):
    """캡처 세 장에서 지워질 곳(고정 막대·겹친 부분)에 색이 입혀졌다 사라지고, 남은 조각이 한 장으로 모인다"""
    bold, _ = fonts
    scale = 300 / 1334
    captures = [Image.open(os.path.join(samples, name)).convert('RGB') for name in t['scrolls']]
    stitched = Image.open(os.path.join(cache, 'stitch.png')).convert('RGB')
    kept = kept_rows(stitched, captures)
    thumbs = [fit_width(image, round(image.width * scale), Image.LANCZOS) for image in captures]
    final = fit_width(stitched, thumbs[0].width, Image.LANCZOS)
    items = [(thumb, t['capture'](n + 1), f'{c.width}×{c.height}') for n, (thumb, c) in enumerate(zip(thumbs, captures))]
    items.append((final, t['stitched'], f'{stitched.width}×{stitched.height}'))
    width, height, origins, label_ys = tile_layout(items, *fonts, gap=20)
    fx, fy = origins[3]

    pieces = []
    for n, (capture, thumb) in enumerate(zip(captures, thumbs)):
        top, bottom, at = kept[n]
        y0 = round(top * scale)
        end_top = round(at * scale)
        end_bottom = round((at + bottom - top) * scale)
        # 결과 칸에서 조각끼리 빈틈이 없게, 도착했을 때의 높이로 만든다
        keep = capture.crop((0, top, capture.width, bottom)).resize((thumb.width, end_bottom - end_top), Image.LANCZOS)
        ox, oy = origins[n]
        pieces.append({
            'keep': keep,
            'start': (ox, oy + y0),
            'end': (fx, fy + end_top),
            # 지워지는 줄 범위 (캡처 칸 안 y): 위쪽, 아래쪽
            'cuts': [(0, y0), (y0 + keep.height, thumb.height)],
        })

    HOLD, TINT_END, MOVE_START, SLIDE, STAGGER = 500, 1000, 1250, 700, 100
    MOVE_END = MOVE_START + SLIDE + 2 * STAGGER
    FINAL_END = MOVE_END + 1000

    def frame(now: float) -> Image.Image:
        card = Image.new('RGB', (width, height), BG)
        draw = ImageDraw.Draw(card)
        warn = ease(span(now, HOLD, TINT_END))  # 지워질 곳에 색이 입혀진 정도
        gone = ease(span(now, MOVE_START, MOVE_START + 500))  # 지워질 곳이 사라진 정도
        arrived = now >= MOVE_END
        if arrived:
            card.paste(final, (fx, fy))  # 도착한 뒤에는 도구가 만든 실제 결과 그대로
            draw.rectangle([fx, fy, fx + final.width - 1, fy + final.height - 1], outline=LINE)
        else:
            dashed_box(draw, fx, fy, final.width, final.height, LINE)
        for n, piece in enumerate(pieces):
            ox, oy = origins[n]
            if gone < 1:
                for a, b in piece['cuts']:
                    region = tint(thumbs[n].crop((0, a, thumbs[n].width, b)), WARN, 0.55 * warn)
                    card.paste(Image.blend(region, Image.new('RGB', region.size, BG), gone), (ox, oy + a))
        if not arrived:
            # 남는 조각은 캡처 3부터 차례로 결과 칸에 쌓인다 (늦게 떠나는 조각이 위에 그려진다)
            for n in (2, 1, 0):
                begin = MOVE_START + STAGGER * (2 - n)
                slide = ease(span(now, begin, begin + SLIDE))
                (sx, sy), (ex, ey) = pieces[n]['start'], pieces[n]['end']
                card.paste(pieces[n]['keep'], (round(sx + (ex - sx) * slide), round(sy + (ey - sy) * slide)))
        if gone < 1:
            for n in range(3):
                ox, oy = origins[n]
                draw.rectangle([ox, oy, ox + thumbs[n].width - 1, oy + thumbs[n].height - 1], outline=mix(LINE, 1 - gone))
        for n in range(3):
            caption(draw, fonts, origins[n][0], label_ys[n], items[n][1], items[n][2])
        legend = ease(span(now, HOLD, TINT_END)) * (1 - span(now, MOVE_START, MOVE_START + 300))
        if legend > 0:
            draw.rectangle([fx, label_ys[3] + 3, fx + 13, label_ys[3] + 16], fill=mix(WARN, legend * 0.8))
            draw.text((fx + 22, label_ys[3]), t['removed'], font=bold, fill=mix(INK, legend))
        shown = ease(span(now, MOVE_END - 350, MOVE_END))
        if shown > 0:
            caption(draw, fonts, fx, label_ys[3], items[3][1], items[3][2], shown)
        return card

    steps = [(0, HOLD, False), (HOLD, TINT_END, True), (TINT_END, MOVE_START, False), (MOVE_START, MOVE_END, True), (MOVE_END, FINAL_END, False)]
    return 'stitch-screenshots', 'stitched', *timeline(frame, steps, 300)


def crop_motion(t, cache, samples, fonts):
    """기운 사진이 바로 서고, 4:5 상자 밖이 사라지며 상자 안이 결과 칸으로 간다"""
    original = Image.open(os.path.join(samples, t['tilted'])).convert('RGB')
    result = Image.open(os.path.join(cache, 'crop.jpg')).convert('RGB')
    base = fit_height(original, 300)
    final = fit_height(result, 300)
    items = [
        (base, t['tiltedLabel'], f'{original.width}×{original.height}'),
        (final, t['straightened'], f'{result.width}×{result.height}'),
    ]
    width, height, origins, label_ys = tile_layout(items, *fonts, gap=20)
    (x1, y1), (x2, y2) = origins
    bw, bh = base.size
    ANGLE = 4.0  # run-tools.mjs가 도구에 넣는 값과 같다
    work = original.resize((bw * 2, bh * 2), Image.LANCZOS)  # 두 배 크기로 줄여 두고 돌릴 때 한 번만 더 줄인다

    def turned(angle):
        """도구와 같은 계산(src/lib/image/crop-geometry.ts): 시계 방향으로 angle도 돌리고 귀퉁이가 비지 않게 키운다"""
        if not angle:
            return base
        r = math.radians(angle)
        k = max((bw * math.cos(r) + bh * math.sin(r)) / bw, (bw * math.sin(r) + bh * math.cos(r)) / bh) * (1 + 2 / min(bw, bh))
        a, b = 2 * math.cos(r) / k, 2 * math.sin(r) / k
        d, e = -b, a
        data = (a, b, work.width / 2 - a * bw / 2 - b * bh / 2, d, e, work.height / 2 - d * bw / 2 - e * bh / 2)
        return work.transform((bw, bh), Image.AFFINE, data, Image.BICUBIC)

    # 자를 상자: 도구가 처음 정하는 4:5 (가운데)
    box_w = final.width
    box_x = (bw - box_w) // 2
    # 돌린 모습이 도구의 실제 결과와 같은 곳인지 확인한다 (어긋나면 그림이 거짓이다)
    check = turned(ANGLE).crop((box_x, 0, box_x + box_w, bh))
    diff = sum(ImageStat.Stat(ImageChops.difference(check, final)).mean) / 3
    assert diff < 8, f'돌린 모습이 도구 결과와 다르다 (평균 차이 {diff:.1f})'

    HOLD, ROTATE_END, BOX_START, BOX_END, MOVE_START, MOVE_END = 350, 1150, 1250, 1600, 1750, 2300
    FINAL_END = MOVE_END + 900

    def frame(now: float) -> Image.Image:
        card = Image.new('RGB', (width, height), BG)
        draw = ImageDraw.Draw(card)
        angle = ANGLE * ease(span(now, HOLD, ROTATE_END))
        dim = ease(span(now, BOX_START, BOX_END))  # 상자 밖이 어두워진 정도
        move = ease(span(now, MOVE_START, MOVE_END))
        if now >= MOVE_END:
            card.paste(final, (x2, y2))  # 도착한 뒤에는 도구가 만든 실제 결과 그대로
            draw.rectangle([x2, y2, x2 + final.width - 1, y2 + final.height - 1], outline=LINE)
        else:
            dashed_box(draw, x2, y2, final.width, final.height, LINE)
            photo = turned(angle)
            inner = photo.crop((box_x, 0, box_x + box_w, bh))
            # 상자 밖은 어두워졌다가 지워진다
            outside = Image.blend(tint(photo, (0, 0, 0), 0.5 * dim), Image.new('RGB', photo.size, BG), move)
            card.paste(outside, (x1, y1))
            if move < 1:
                draw.rectangle([x1, y1, x1 + bw - 1, y1 + bh - 1], outline=mix(LINE, 1 - move))
            # 상자 안: 처음에는 제자리, 이어서 결과 칸으로
            ix = round(x1 + box_x + (x2 - x1 - box_x) * move)
            iy = round(y1 + (y2 - y1) * move)
            card.paste(inner, (ix, iy))
            if dim and move < 1:
                draw.rectangle([ix, iy, ix + box_w - 1, iy + bh - 1], outline=mix(GREEN, 1 - move), width=2)
        if now < HOLD:
            caption(draw, fonts, x1, label_ys[0], items[0][1], items[0][2])
        else:
            caption(draw, fonts, x1, label_ys[0], f'{t["angle"]} {angle:.1f}°', '4:5' if dim else '')
        shown = ease(span(now, MOVE_END - 350, MOVE_END))
        if shown > 0:
            caption(draw, fonts, x2, label_ys[1], items[1][1], items[1][2], shown)
        return card

    steps = [
        (0, HOLD, False), (HOLD, ROTATE_END, True), (ROTATE_END, BOX_START, False), (BOX_START, BOX_END, True),
        (BOX_END, MOVE_START, False), (MOVE_START, MOVE_END, True), (MOVE_END, FINAL_END, False),
    ]
    return 'crop-rotate-photo', 'straightened', *timeline(frame, steps, 300)


# 글 주소 → 움직이는 그림 함수. 파일은 public/guide-motion/<언어>/<글>/<이름>.webp
MOTIONS = {
    'stitch-screenshots': stitch_motion,
    'crop-rotate-photo': crop_motion,
}


def save_motion(frames, durations, still: Image.Image, locale: str, slug: str, name: str):
    """움직이는 그림 <이름>.webp와 멈춘 그림 <이름>-still.webp. 둘은 크기가 같아야 글이 밀리지 않는다"""
    assert frames[0].size == still.size, (frames[0].size, still.size)
    folder = os.path.join(MOTION_OUT, locale, slug)
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, f'{name}.webp')
    frames[0].save(path, 'WEBP', save_all=True, append_images=frames[1:], duration=durations, loop=0, quality=MOTION_QUALITY, method=6)
    still_path = os.path.join(folder, f'{name}-still.webp')
    still.save(still_path, 'WEBP', quality=STILL_QUALITY, method=6)
    print(
        f'{locale}/{slug}/{name}.webp  {still.width}×{still.height}  {len(frames)}장 {sum(durations) / 1000:.2f}초  '
        f'{os.path.getsize(path) // 1024}KB (멈춘 그림 {os.path.getsize(still_path) // 1024}KB)'
    )


# 글 주소 → 그림 함수 (글을 골라 다시 그릴 때 다른 글의 재료가 없어도 되게 이름으로 고른다)
GUIDES = {
    'compress-pdf': compress_pdf,
    'n-up-pdf': n_up_pdf,
    'redact-pdf': redact_pdf,
    'merge-pdf': merge_pdf,
    'watermark-pdf': watermark_pdf,
    'header-footer-pdf': header_footer_pdf,
    'sign-pdf': sign_pdf,
    'edit-pdf': edit_pdf,
    'crop-pdf-margins': crop_pdf,
    'pdf-to-jpg': pdf_to_jpg,
    'ocr-pdf': ocr_pdf,
    'photos-to-pdf': photos_to_pdf,
    'pdf-metadata': pdf_metadata,
    'fill-pdf-form': fill_pdf_form,
    'extract-images-pdf': extract_images_pdf,
    'compress-image': compress_image,
    'resize-image': resize_image,
    'photo-size-limit': photo_size_limit,
    'convert-image': convert_image,
    'heic-to-jpg': heic_to_jpg,
    'photo-location': photo_location,
    'stitch-screenshots': stitch_screenshots,
    'crop-rotate-photo': crop_rotate_photo,
    'hide-info-in-photo': hide_info_in_photo,
    'fix-csv-encoding': csv_encoding,
    'image-to-text': image_ocr,
}


def main():
    """글 이름을 적으면 그 그림만 다시 그린다 (예: merge-pdf)"""
    fonts = (ImageFont.truetype(BOLD, 18), ImageFont.truetype(REGULAR, 15))
    only = sys.argv[1:]
    for slug in only:
        if slug not in GUIDES:
            raise SystemExit(f'없는 글: {slug}')
    for locale, t in TEXT.items():
        cache = os.path.join(CACHE, locale)
        samples = os.path.join(SAMPLES, locale)
        for slug, guide in GUIDES.items():
            if only and slug not in only:
                continue
            folder, name, image = guide(t, cache, samples, fonts)
            assert folder == slug, (folder, slug)
            if slug in MOTIONS:
                # 멈춘 그림은 움직이는 그림 옆에 둔다 (움직임 줄이기를 켠 사람과 움직임을 못 쓰는 곳에 보인다)
                folder, name, frames, durations = MOTIONS[slug](t, cache, samples, fonts)
                assert folder == slug, (folder, slug)
                save_motion(frames, durations, image, locale, slug, name)
            else:
                save(image, locale, slug, name)


if __name__ == '__main__':
    main()
