"""
가이드 그림 그리기. run-tools.mjs가 우리 도구로 만든 결과(.cache/guide-images/)와 견본(public/samples/)으로
src/assets/guides/<언어>/<글>/에 PNG를 쓴다 (커밋한다. 배포용 WebP는 빌드가 만든다).

  python3 scripts/guide-images/render.py   (PyMuPDF·Pillow 필요)

- 그림은 흰 종이 카드 하나로 그린다. 두 테마에서 같은 모습이고, 가이드 글의 테두리·둥근 모서리는 CSS가 맡는다
- 그림 안 글자는 꼬리표(단계 이름·용량)만 둔다. 설명은 가이드 글과 그림 설명(alt)이 맡는다
"""
import io
import os
import sys
import zipfile

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
    card = Image.new('RGB', (width, height), BG)
    draw = ImageDraw.Draw(card)
    for index, (image, label, sub) in enumerate(items):
        row, col = divmod(index, cols)
        x = PAD + sum(widths[:col]) + col * gap
        y = PAD + sum(heights[:row]) + row * (label_h + gap)
        card.paste(image, (x, y))
        draw.rectangle([x, y, x + image.width - 1, y + image.height - 1], outline=LINE)
        draw.text((x, y + heights[row] + 12), label, font=label_font, fill=INK)
        if sub:
            draw.text((x, y + heights[row] + 34), sub, font=sub_font, fill=MUTED)
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
    'convert-image': convert_image,
    'photo-location': photo_location,
    'stitch-screenshots': stitch_screenshots,
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
            save(image, locale, slug, name)


if __name__ == '__main__':
    main()
