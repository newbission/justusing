"""
'예시 파일로 해 보기'에 쓰는 견본 파일을 만든다. 결과는 public/samples/<언어>/에 쓰고 커밋한다.

  python3 scripts/samples/make_samples.py   (PyMuPDF·Pillow 필요, 먼저 npm install)

- 내용은 모두 지어낸 것이다. 이름은 홍길동, 번호는 0으로 채우고, 회사는 '예시상사'처럼 없는 이름을 쓴다
- 문서 안 글자가 있는 파일은 언어마다 따로 만든다. 사진은 두 언어가 같은 것을 쓴다(언어 폴더에 같이 둔다)
- 글꼴은 Pretendard(node_modules, OFL)를 PDF에 넣는다. PyMuPDF 기본 한글 글꼴은 숫자·영문 사이가 벌어진다.
  PDF에는 가변 TTF에서 굵기를 뽑아 넣는다. 고정 굵기 OTF를 넣으면 괄호·하이픈 같은 문장부호가 다른 글자로 찍힌다
- 같은 입력이면 같은 파일이 나오게 난수 씨앗을 고정한다 (다시 만들어도 쓸데없는 바뀜이 없게)
- 증명사진 견본(face.jpg)은 그릴 수 없어 이미지 생성 AI(ChatGPT)로 만든 실존하지 않는 사람의 사진을 둔다
  (2026-10-20, 사용자가 만들어 줌). 그대로 다시 저장해 메타데이터를 남기지 않는다

파일 목록과 도구 연결은 src/frame/samples.ts에 있다. 파일을 더하거나 이름을 바꾸면 거기도 고친다.
"""
import io
import math
import os
import random

import fitz
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, 'public', 'samples')
FONT_DIR = os.path.join(ROOT, 'node_modules', 'pretendard', 'dist', 'public', 'static')
REGULAR = os.path.join(FONT_DIR, 'Pretendard-Regular.otf')
BOLD = os.path.join(FONT_DIR, 'Pretendard-Bold.otf')
VARIABLE = os.path.join(ROOT, 'node_modules', 'pretendard', 'dist', 'public', 'variable', 'PretendardVariable.ttf')


def pdf_font(weight: int) -> bytes:
    font = instancer.instantiateVariableFont(TTFont(VARIABLE), {'wght': weight})
    buffer = io.BytesIO()
    font.save(buffer)
    return buffer.getvalue()


PDF_REGULAR = pdf_font(400)
PDF_BOLD = pdf_font(700)

A4 = fitz.paper_rect('a4')
INK = (0.12, 0.12, 0.12)
MUTED = (0.43, 0.43, 0.42)
LINE = (0.85, 0.85, 0.83)
ACCENT = (0.18, 0.44, 0.33)

TEXT = {
    'ko': {
        'report': '예시-보고서.pdf',
        'appendix': '예시-부록.pdf',
        'locked': '예시-암호0000.pdf',
        'photos': '예시-사진모음.pdf',
        'scan': '예시-스캔본.pdf',
        'form': '예시-신청서.pdf',
        'docPhotos': ['예시-서류사진1.jpg', '예시-서류사진2.jpg'],
        'photo': '예시-사진.jpg',
        'face': '예시-증명사진.jpg',
        'screen': '예시-화면캡처.png',
        'sample': '예시 파일 · 내용은 모두 지어낸 것입니다',
        'company': '예시상사',
        'title': '2026년 3분기 업무 보고서',
        'subtitle': '예시 문서',
        'author': '작성: 홍길동 (예시상사 기획팀)',
        'date': '2026년 10월 1일',
        'summaryHead': '요약',
        'summary': (
            '이번 분기에는 고객 문의 응답 시간을 줄이고 새 서비스 준비를 마쳤습니다. '
            '아래 표는 분기별 주요 지표이고, 다음 쪽부터 항목별 내용을 정리했습니다.'
        ),
        'table': [
            ('항목', '2분기', '3분기', '변화'),
            ('고객 문의', '1,240건', '1,180건', '-5%'),
            ('평균 응답 시간', '6.2시간', '3.9시간', '-37%'),
            ('만족도', '4.1점', '4.4점', '+0.3'),
        ],
        'sections': [
            (
                '1. 응답 시간 줄이기',
                '자주 묻는 질문 30개에 답을 미리 써 두고, 담당자를 요일별로 나눴습니다. '
                '그 결과 평균 응답 시간이 6.2시간에서 3.9시간으로 줄었습니다. '
                '주말 문의는 여전히 월요일 오전에 몰리므로 다음 분기에 당번을 정할 계획입니다.',
            ),
            (
                '2. 새 서비스 준비',
                '시범 운영을 두 번 거쳐 화면과 안내문을 고쳤습니다. 시범 참여자 40명 중 34명이 '
                '"다시 쓰겠다"고 답했습니다. 정식 공개는 11월 둘째 주로 정했습니다.',
            ),
        ],
        'chartHead': '월별 문의 건수',
        'months': ['7월', '8월', '9월'],
        'photoHead': '3. 행사 사진',
        'photoCaption': '9월 고객 초청 행사 (예시 사진)',
        'privacyHead': '4. 담당자 정보',
        'privacy': [
            ('이름', '홍길동'),
            ('연락처', '010-0000-0000'),
            ('주민등록번호', '000000-0000000'),
            ('계좌', '예시은행 000-00-000000'),
            ('이메일', 'hong@example.com'),
        ],
        'privacyNote': '이 쪽의 정보는 가리기 도구로 가려 볼 수 있게 넣은 가짜 정보입니다.',
        'appendixTitle': '부록',
        'appendixItems': [
            ('부록 1. 용어 정리', '응답 시간: 문의가 들어온 때부터 첫 답을 보낸 때까지 걸린 시간.'),
            ('부록 2. 다음 분기 일정', '10월 고객 설문, 11월 새 서비스 공개, 12월 연말 점검.'),
        ],
        'photosTitle': '사진 모음',
        'photosCaption': '예시 사진',
        'scanTitle': '안내문',
        'scanBody': [
            '예시상사 고객 여러분께',
            '10월 20일(월) 오전 2시부터 4시까지',
            '시스템 점검으로 서비스를 잠시 쓸 수 없습니다.',
            '이용에 불편을 드려 죄송합니다.',
            '문의: 000-0000-0000',
        ],
        'formTitle': '행사 참가 신청서',
        'formFields': [('name', '이름'), ('phone', '연락처'), ('date', '신청 날짜'), ('memo', '남길 말')],
        'formAgree': '개인정보 수집에 동의합니다',
        'formNote': '칸을 눌러 적은 뒤 저장해 보세요. 실제로 제출되지 않습니다.',
        'docPhotoTitles': ['영수증 (예시)', '재직 증명서 (예시)'],
        'receipt': [('품목', '금액'), ('복사 용지 A4', '24,000원'), ('볼펜 10자루', '8,000원'), ('합계', '32,000원')],
        'certificate': [
            ('성명', '홍길동'),
            ('소속', '예시상사 기획팀'),
            ('입사일', '2020년 3월 2일'),
            ('용도', '제출용 (예시)'),
        ],
        'screenTitle': '설정',
        'screenRows': ['알림 받기', '어두운 화면', '자동 저장', '위치 정보 사용'],
    },
    'en': {
        'report': 'sample-report.pdf',
        'appendix': 'sample-appendix.pdf',
        'locked': 'sample-password-0000.pdf',
        'photos': 'sample-photos.pdf',
        'scan': 'sample-scan.pdf',
        'form': 'sample-form.pdf',
        'docPhotos': ['sample-document-photo-1.jpg', 'sample-document-photo-2.jpg'],
        'photo': 'sample-photo.jpg',
        'face': 'sample-id-photo.jpg',
        'screen': 'sample-screenshot.png',
        'sample': 'Sample file · Everything in it is made up',
        'company': 'Example Co.',
        'title': 'Q3 2026 Team Report',
        'subtitle': 'Sample document',
        'author': 'By Alex Doe (Example Co. Planning)',
        'date': 'October 1, 2026',
        'summaryHead': 'Summary',
        'summary': (
            'This quarter we cut the time it takes to answer customers and finished preparing '
            'a new service. The table shows the key numbers; the next pages cover each item.'
        ),
        'table': [
            ('Item', 'Q2', 'Q3', 'Change'),
            ('Customer questions', '1,240', '1,180', '-5%'),
            ('Average reply time', '6.2 h', '3.9 h', '-37%'),
            ('Satisfaction', '4.1', '4.4', '+0.3'),
        ],
        'sections': [
            (
                '1. Faster replies',
                'We wrote answers to the 30 most common questions in advance and split the work '
                'by weekday. The average reply time fell from 6.2 to 3.9 hours. Weekend questions '
                'still pile up on Monday morning, so next quarter we will add a weekend shift.',
            ),
            (
                '2. New service',
                'Two pilot runs helped us fix the screens and the guide. 34 of the 40 pilot users '
                'said they would use it again. The public launch is set for the second week of November.',
            ),
        ],
        'chartHead': 'Questions per month',
        'months': ['Jul', 'Aug', 'Sep'],
        'photoHead': '3. Event photo',
        'photoCaption': 'Customer event in September (sample photo)',
        'privacyHead': '4. Contact details',
        'privacy': [
            ('Name', 'Alex Doe'),
            ('Phone', '000-000-0000'),
            ('ID number', '000-00-0000'),
            ('Bank account', 'Example Bank 0000-0000-0000'),
            ('Email', 'alex@example.com'),
        ],
        'privacyNote': 'These details are fake, added so you can try hiding them with the redact tool.',
        'appendixTitle': 'Appendix',
        'appendixItems': [
            ('Appendix 1. Terms', 'Reply time: the time from receiving a question to sending the first answer.'),
            ('Appendix 2. Next quarter', 'Customer survey in October, launch in November, year-end review in December.'),
        ],
        'photosTitle': 'Photos',
        'photosCaption': 'Sample photo',
        'scanTitle': 'Notice',
        'scanBody': [
            'Dear Example Co. customers,',
            'On Monday, October 20, from 2 to 4 a.m.,',
            'the service will be down for maintenance.',
            'We are sorry for the inconvenience.',
            'Questions: 000-000-0000',
        ],
        'formTitle': 'Event sign-up form',
        'formFields': [('name', 'Name'), ('phone', 'Phone'), ('date', 'Date'), ('memo', 'Message')],
        'formAgree': 'I agree to the collection of my details',
        'formNote': 'Click a box, type, then save. Nothing is actually submitted.',
        'docPhotoTitles': ['Receipt (sample)', 'Employment letter (sample)'],
        'receipt': [('Item', 'Price'), ('A4 copy paper', '$24.00'), ('Pens, 10 pack', '$8.00'), ('Total', '$32.00')],
        'certificate': [
            ('Name', 'Alex Doe'),
            ('Team', 'Example Co. Planning'),
            ('Start date', 'March 2, 2020'),
            ('Purpose', 'For submission (sample)'),
        ],
        'screenTitle': 'Settings',
        'screenRows': ['Notifications', 'Dark mode', 'Auto save', 'Use location'],
    },
}


# ---------- 사진 (지어낸 풍경) ----------


def landscape(width: int, height: int, seed: int) -> Image.Image:
    """하늘·해·산·풀밭과 잔 무늬가 있는 사진 같은 그림. 잔 무늬가 있어야 압축하면 차이가 보인다"""
    rng = random.Random(seed)
    image = Image.new('RGB', (width, height))
    draw = ImageDraw.Draw(image)
    top = (rng.randint(60, 110), rng.randint(130, 170), rng.randint(200, 240))
    bottom = (rng.randint(220, 250), rng.randint(200, 230), rng.randint(170, 210))
    for y in range(height):
        t = y / height
        draw.line([(0, y), (width, y)], fill=tuple(int(a + (b - a) * t) for a, b in zip(top, bottom)))
    sun = (rng.randint(width // 5, width * 4 // 5), rng.randint(height // 8, height // 3))
    radius = width // 14
    draw.ellipse([sun[0] - radius, sun[1] - radius, sun[0] + radius, sun[1] + radius], fill=(255, 236, 190))
    for layer in range(3):
        base = height * (0.45 + layer * 0.12)
        color = (40 + layer * 25, 70 + layer * 35, 60 + layer * 20)
        points = [(0, height)]
        phase = rng.random() * 6
        for x in range(0, width + 20, 20):
            y = base - math.sin(x / width * (3 + layer) + phase) * height * 0.08 - rng.random() * 6
            points.append((x, y))
        points.append((width, height))
        draw.polygon(points, fill=color)
    for _ in range(width * 2):
        x = rng.randrange(width)
        y = rng.randrange(int(height * 0.7), height)
        length = rng.randint(4, 14)
        shade = rng.randint(70, 150)
        draw.line([(x, y), (x + rng.randint(-3, 3), y - length)], fill=(shade // 3, shade, shade // 3))
    image = image.filter(ImageFilter.GaussianBlur(0.6))
    noise = Image.effect_noise((width, height), 18).convert('RGB')
    return Image.blend(image, noise, 0.06)


def jpeg(image: Image.Image, quality: int = 92) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, 'JPEG', quality=quality, optimize=True)
    return buffer.getvalue()


# ---------- PDF ----------


class Writer:
    """쪽 하나에 글자를 위에서부터 차례로 쓴다"""

    def __init__(self, page: fitz.Page, margin: float = 72):
        self.page = page
        self.margin = margin
        self.y = margin
        self.width = page.rect.width - margin * 2
        page.insert_font(fontname='R', fontbuffer=PDF_REGULAR)
        page.insert_font(fontname='B', fontbuffer=PDF_BOLD)

    def text(self, text: str, size: float = 10.5, bold: bool = False, color=INK, gap: float = 6):
        box = fitz.Rect(self.margin, self.y, self.margin + self.width, self.page.rect.height - self.margin)
        left = self.page.insert_textbox(
            box, text, fontname='B' if bold else 'R', fontsize=size, color=color, lineheight=1.6
        )
        used = box.height - left if left >= 0 else box.height
        self.y += used + gap

    def rule(self, gap: float = 12):
        self.page.draw_line((self.margin, self.y), (self.margin + self.width, self.y), color=LINE, width=0.8)
        self.y += gap


def footer(page: fitz.Page, text: str):
    page.insert_font(fontname='R', fontbuffer=PDF_REGULAR)
    page.insert_text((72, page.rect.height - 40), text, fontname='R', fontsize=8, color=MUTED)


def table(writer: Writer, rows, widths):
    x0 = writer.margin
    height = 24
    for index, row in enumerate(rows):
        x = x0
        if index == 0:
            writer.page.draw_rect(
                fitz.Rect(x0, writer.y, x0 + sum(widths), writer.y + height), color=None, fill=(0.95, 0.95, 0.94)
            )
        for cell, width in zip(row, widths):
            writer.page.insert_text(
                (x + 8, writer.y + 16), cell, fontname='B' if index == 0 else 'R', fontsize=9.5, color=INK
            )
            x += width
        writer.y += height
        writer.page.draw_line((x0, writer.y), (x0 + sum(widths), writer.y), color=LINE, width=0.6)
    writer.y += 16


def bar_chart(writer: Writer, title: str, labels, values):
    writer.text(title, size=11, bold=True)
    top = writer.y
    chart_height = 120
    top_value = max(values)
    for index, (label, value) in enumerate(zip(labels, values)):
        x = writer.margin + 20 + index * 110
        bar = chart_height * value / top_value
        writer.page.draw_rect(
            fitz.Rect(x, top + chart_height - bar, x + 60, top + chart_height),
            color=None,
            fill=ACCENT if index == len(values) - 1 else (0.75, 0.78, 0.76),
        )
        writer.page.insert_text((x + 18, top + chart_height + 16), label, fontname='R', fontsize=9, color=MUTED)
        writer.page.insert_text((x + 14, top + chart_height - bar - 6), f'{value:,}', fontname='R', fontsize=9)
    writer.y = top + chart_height + 36


def report(t, photo: bytes) -> fitz.Document:
    doc = fitz.open()
    # 1쪽: 제목·요약·표
    page = doc.new_page(width=A4.width, height=A4.height)
    w = Writer(page)
    w.text(t['company'], size=10, color=ACCENT, bold=True)
    w.text(t['title'], size=22, bold=True, gap=2)
    w.text(t['subtitle'], size=11, color=MUTED, gap=2)
    w.text(f"{t['author']} · {t['date']}", size=9.5, color=MUTED, gap=18)
    w.rule(18)
    w.text(t['summaryHead'], size=13, bold=True)
    w.text(t['summary'], gap=16)
    table(w, t['table'], [160, 100, 100, 90])
    footer(page, t['sample'])
    # 2쪽: 본문·그래프
    page = doc.new_page(width=A4.width, height=A4.height)
    w = Writer(page)
    for head, body in t['sections']:
        w.text(head, size=13, bold=True)
        w.text(body, gap=18)
    bar_chart(w, t['chartHead'], t['months'], [412, 395, 373])
    footer(page, t['sample'])
    # 3쪽: 사진
    page = doc.new_page(width=A4.width, height=A4.height)
    w = Writer(page)
    w.text(t['photoHead'], size=13, bold=True, gap=12)
    rect = fitz.Rect(w.margin, w.y, w.margin + w.width, w.y + w.width * 0.66)
    page.insert_image(rect, stream=photo)
    w.y = rect.y1 + 8
    w.text(t['photoCaption'], size=9, color=MUTED)
    footer(page, t['sample'])
    # 4쪽: 개인정보 (가리기 연습)
    page = doc.new_page(width=A4.width, height=A4.height)
    w = Writer(page)
    w.text(t['privacyHead'], size=13, bold=True, gap=14)
    for label, value in t['privacy']:
        page.insert_text((w.margin, w.y + 12), label, fontname='R', fontsize=10.5, color=MUTED)
        page.insert_text((w.margin + 120, w.y + 12), value, fontname='R', fontsize=10.5, color=INK)
        w.y += 28
    w.y += 10
    w.text(t['privacyNote'], size=9, color=MUTED)
    footer(page, t['sample'])
    doc.set_metadata(
        {
            'title': t['title'],
            'author': t['author'],
            'subject': t['subtitle'],
            'keywords': t['company'],
            'creator': t['company'],
            'producer': t['company'],
            'creationDate': 'D:20261001090000',
            'modDate': 'D:20261001090000',
        }
    )
    return doc


def appendix(t) -> fitz.Document:
    doc = fitz.open()
    for head, body in t['appendixItems']:
        page = doc.new_page(width=A4.width, height=A4.height)
        w = Writer(page)
        w.text(t['appendixTitle'], size=10, color=ACCENT, bold=True)
        w.text(head, size=16, bold=True, gap=12)
        w.text(body)
        footer(page, t['sample'])
    return doc


def photos_pdf(t, photos) -> fitz.Document:
    doc = fitz.open()
    for index, data in enumerate(photos):
        page = doc.new_page(width=A4.width, height=A4.height)
        w = Writer(page)
        w.text(f"{t['photosTitle']} {index + 1}", size=13, bold=True, gap=12)
        rect = fitz.Rect(w.margin, w.y, w.margin + w.width, w.y + w.width * 0.75)
        page.insert_image(rect, stream=data)
        footer(page, t['sample'])
    return doc


def scan_pdf(t) -> fitz.Document:
    """글자를 사진으로만 담은 쪽 (스캔본처럼 약간 기울고 잡티가 있다). 글자층이 없어 OCR 연습용"""
    scale = 200 / 72
    width, height = int(A4.width * scale), int(A4.height * scale)
    image = Image.new('L', (width, height), 246)
    draw = ImageDraw.Draw(image)
    title = ImageFont.truetype(BOLD, int(26 * scale))
    body = ImageFont.truetype(REGULAR, int(14 * scale))
    y = int(110 * scale)
    draw.text((int(80 * scale), y), t['scanTitle'], font=title, fill=30)
    y += int(70 * scale)
    for line in t['scanBody']:
        draw.text((int(80 * scale), y), line, font=body, fill=40)
        y += int(34 * scale)
    image = image.rotate(0.6, resample=Image.BICUBIC, fillcolor=246)
    noise = Image.effect_noise((width, height), 10)
    image = Image.blend(image, noise, 0.05).filter(ImageFilter.GaussianBlur(0.5))
    doc = fitz.open()
    page = doc.new_page(width=A4.width, height=A4.height)
    page.insert_image(page.rect, stream=jpeg(image.convert('RGB'), 80))
    return doc


def form_pdf(t) -> fitz.Document:
    doc = fitz.open()
    page = doc.new_page(width=A4.width, height=A4.height)
    w = Writer(page)
    w.text(t['company'], size=10, color=ACCENT, bold=True)
    w.text(t['formTitle'], size=20, bold=True, gap=20)
    for name, label in t['formFields']:
        page.insert_text((w.margin, w.y + 14), label, fontname='R', fontsize=10.5, color=INK)
        widget = fitz.Widget()
        widget.field_name = name
        widget.field_type = fitz.PDF_WIDGET_TYPE_TEXT
        tall = name == 'memo'
        widget.rect = fitz.Rect(w.margin + 110, w.y, w.margin + w.width, w.y + (60 if tall else 22))
        widget.field_flags = fitz.PDF_TX_FIELD_IS_MULTILINE if tall else 0
        widget.border_color = (0.7, 0.7, 0.68)
        widget.border_width = 0.8
        widget.text_fontsize = 11
        page.add_widget(widget)
        w.y += (74 if tall else 36)
    widget = fitz.Widget()
    widget.field_name = 'agree'
    widget.field_type = fitz.PDF_WIDGET_TYPE_CHECKBOX
    widget.rect = fitz.Rect(w.margin, w.y, w.margin + 14, w.y + 14)
    widget.border_color = (0.5, 0.5, 0.48)
    page.add_widget(widget)
    page.insert_text((w.margin + 22, w.y + 11), t['formAgree'], fontname='R', fontsize=10.5, color=INK)
    w.y += 40
    w.text(t['formNote'], size=9, color=MUTED)
    footer(page, t['sample'])
    return doc


def save(doc: fitz.Document, path: str, **options):
    # 쓴 글자만 남긴다 (글꼴 전체를 넣으면 파일마다 2MB가 된다)
    doc.subset_fonts()
    doc.save(path, garbage=4, deflate=True, **options)


# ---------- 서류 사진·화면 캡처 ----------


def paper(t, title: str, rows) -> Image.Image:
    width, height = 900, 1180
    image = Image.new('RGB', (width, height), (252, 251, 247))
    draw = ImageDraw.Draw(image)
    draw.text((70, 80), t['company'], font=ImageFont.truetype(BOLD, 26), fill=(47, 111, 85))
    draw.text((70, 130), title, font=ImageFont.truetype(BOLD, 48), fill=(30, 30, 30))
    y = 250
    font = ImageFont.truetype(REGULAR, 30)
    for left, right in rows:
        draw.text((70, y), left, font=font, fill=(90, 90, 88))
        draw.text((470, y), right, font=font, fill=(30, 30, 30))
        y += 70
        draw.line([(70, y - 18), (830, y - 18)], fill=(220, 220, 215), width=2)
    draw.text((70, height - 90), t['sample'], font=ImageFont.truetype(REGULAR, 20), fill=(140, 140, 136))
    return image


def photo_of(sheet: Image.Image, seed: int) -> Image.Image:
    """종이를 책상 위에서 휴대폰으로 찍은 것처럼: 나무 바탕, 기울기, 그림자, 밝기 얼룩"""
    rng = random.Random(seed)
    width, height = 1500, 2000
    desk = Image.new('RGB', (width, height), (150, 112, 78))
    draw = ImageDraw.Draw(desk)
    for y in range(0, height, 6):
        shade = rng.randint(-14, 14)
        draw.line([(0, y), (width, y + rng.randint(-8, 8))], fill=(150 + shade, 112 + shade, 78 + shade), width=4)
    sheet = sheet.resize((1160, int(1160 * sheet.height / sheet.width)))
    sheet = sheet.rotate(rng.uniform(-4, 4), resample=Image.BICUBIC, expand=True, fillcolor=(0, 0, 0))
    # 돌리며 생긴 검은 귀퉁이를 빼고 종이만 붙인다
    mask = sheet.convert('L').point(lambda value: 255 if value > 8 else 0)
    x, y = (width - sheet.width) // 2, (height - sheet.height) // 2
    shadow = Image.new('RGBA', desk.size, (0, 0, 0, 0))
    shadow.paste((0, 0, 0, 90), (x + 18, y + 22), mask)
    desk = Image.alpha_composite(desk.convert('RGBA'), shadow.filter(ImageFilter.GaussianBlur(18))).convert('RGB')
    desk.paste(sheet, (x, y), mask)
    light = Image.radial_gradient('L').resize(desk.size)
    desk = Image.composite(desk, Image.new('RGB', desk.size, (40, 32, 24)), light.point(lambda value: 255 - value // 3))
    return desk.filter(ImageFilter.GaussianBlur(0.7))


def screenshot(t) -> Image.Image:
    """휴대폰 설정 화면 같은 캡처. 색이 적어 PNG 압축 차이가 크다"""
    width, height = 750, 1334
    image = Image.new('RGB', (width, height), (246, 246, 244))
    draw = ImageDraw.Draw(image)
    draw.rectangle([0, 0, width, 88], fill=(252, 252, 250))
    draw.text((40, 26), t['screenTitle'], font=ImageFont.truetype(BOLD, 34), fill=(30, 30, 30))
    font = ImageFont.truetype(REGULAR, 30)
    y = 130
    for index, label in enumerate(t['screenRows']):
        draw.rounded_rectangle([24, y, width - 24, y + 100], radius=18, fill=(255, 255, 255))
        draw.text((56, y + 32), label, font=font, fill=(30, 30, 30))
        on = index % 2 == 0
        draw.rounded_rectangle(
            [width - 150, y + 30, width - 56, y + 70], radius=20, fill=(47, 111, 85) if on else (210, 210, 205)
        )
        knob = width - 96 if on else width - 146
        draw.ellipse([knob, y + 34, knob + 36, y + 66], fill=(255, 255, 255))
        y += 124
    draw.text((40, height - 80), t['sample'], font=ImageFont.truetype(REGULAR, 22), fill=(140, 140, 136))
    return image


def main():
    hero = jpeg(landscape(1600, 1060, 7), 90)
    gallery = [jpeg(landscape(1400, 1050, seed), 92) for seed in (11, 12, 13)]
    photo = landscape(2000, 1500, 21)
    face = Image.open(os.path.join(HERE, 'face.jpg')).convert('RGB')
    for locale, t in TEXT.items():
        folder = os.path.join(OUT, locale)
        os.makedirs(folder, exist_ok=True)
        for name in os.listdir(folder):
            os.remove(os.path.join(folder, name))
        save(report(t, hero), os.path.join(folder, t['report']))
        save(appendix(t), os.path.join(folder, t['appendix']))
        save(
            report(t, hero),
            os.path.join(folder, t['locked']),
            encryption=fitz.PDF_ENCRYPT_AES_256,
            user_pw='0000',
            owner_pw='0000',
        )
        save(photos_pdf(t, gallery), os.path.join(folder, t['photos']))
        save(scan_pdf(t), os.path.join(folder, t['scan']))
        save(form_pdf(t), os.path.join(folder, t['form']))
        sheets = [paper(t, t['docPhotoTitles'][0], t['receipt']), paper(t, t['docPhotoTitles'][1], t['certificate'])]
        for index, sheet in enumerate(sheets):
            photo_of(sheet, 30 + index).save(os.path.join(folder, t['docPhotos'][index]), 'JPEG', quality=88)
        photo.save(os.path.join(folder, t['photo']), 'JPEG', quality=95)
        face.save(os.path.join(folder, t['face']), 'JPEG', quality=90)
        screenshot(t).save(os.path.join(folder, t['screen']), 'PNG', optimize=True)
        for name in sorted(os.listdir(folder)):
            print(f'{locale}/{name}  {os.path.getsize(os.path.join(folder, name)) // 1024}KB')


if __name__ == '__main__':
    main()
