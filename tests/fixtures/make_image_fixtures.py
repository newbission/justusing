"""
E2E 테스트용 이미지를 만든다 (이미지를 PDF로 도구). Pillow가 필요하다.

  python3 tests/fixtures/make_image_fixtures.py

- wide.png     가로 400×300
- tall.jpg     세로 300×400
- rotated.jpg  화소는 가로 400×300이고 EXIF 방향 6(시계 방향 90° 돌려 보기)
               → 바로 세우면 세로 300×400. 휴대폰 사진이 이렇게 저장된다
- broken.png   이름만 PNG이고 내용은 이미지가 아님
- photos.pdf   사진이 든 2쪽 PDF (PDF 압축 도구). 1쪽 고화질 JPG, 2쪽 PNG 예측을 건 Flate RGB 사진,
               그리고 어디에서도 쓰지 않는 큰 객체 하나. 쪽마다 글자 "Photo page N"
- located.jpg  촬영 정보가 든 사진 (위치정보 지우기). 화소 400×300, 방향 6, GPS(서울시청 앞), 찍은 날짜, 기기,
               GPS가 든 XMP, 설명 글, 그림 끝 뒤에 덧붙은 영상(움직이는 사진처럼 ftyp로 시작)
- located.png  GPS·날짜·기기가 든 eXIf와 설명 글(tEXt)이 있는 PNG
- located.webp GPS가 든 EXIF와 XMP가 있는 WebP (방향 6)
- scan.png     글자를 찍은 그림 (글자 인식 도구). 한글 한 줄, 영어 한 줄. Pretendard로 그린다

이 스크립트가 만들지 않는 것:
- face.jpg     흰 배경 앞 얼굴 사진 (증명사진 도구). 얼굴 인식은 실제 사진이라야 해서 NASA 공개 사진
               (퍼블릭 도메인, commons.wikimedia.org/wiki/File:Jessica_Wittner_white_background.jpg)을
               800×1200으로 줄였다. 테스트에만 쓰고 사이트 견본으로는 쓰지 않는다
"""
import io
import math
import os
import random
import zlib

from PIL import Image, ImageDraw, ImageFont, PngImagePlugin

HERE = os.path.dirname(os.path.abspath(__file__))


def path(name: str) -> str:
    return os.path.join(HERE, name)


Image.new('RGB', (400, 300), (200, 60, 60)).save(path('wide.png'))
Image.new('RGB', (300, 400), (60, 60, 200)).save(path('tall.jpg'), quality=90)

rotated = Image.new('RGB', (400, 300), (60, 160, 60))
exif = Image.Exif()
exif[0x0112] = 6
rotated.save(path('rotated.jpg'), quality=90, exif=exif.tobytes())

with open(path('broken.png'), 'wb') as f:
    f.write(b'not an image')


def photo(width: int, height: int, seed: int) -> Image.Image:
    """줄일 여지가 있는 사진 비슷한 그림 (부드러운 색 변화 + 약한 잡음)"""
    rng = random.Random(seed)
    image = Image.new('RGB', (width, height))
    pixels = image.load()
    for y in range(height):
        for x in range(width):
            n = rng.randint(-12, 12)
            pixels[x, y] = (
                int(128 + 100 * math.sin(x / 37 + seed)) + n,
                int(128 + 100 * math.sin(y / 23)) + n,
                int(128 + 100 * math.sin((x + y) / 51)) + n,
            )
    return image


def sub_predicted(image: Image.Image) -> bytes:
    """PNG 예측 Sub(1)를 건 화소 줄들"""
    width, height = image.size
    raw = image.tobytes()
    out = bytearray()
    for y in range(height):
        row = raw[y * width * 3:(y + 1) * width * 3]
        out.append(1)
        out += bytes((row[i] - (row[i - 3] if i >= 3 else 0)) & 0xFF for i in range(len(row)))
    return bytes(out)


def pdf(objects) -> bytes:
    """objects: [(dict 문자열, 스트림 바이트 또는 None)], 1번이 Catalog"""
    out = bytearray(b'%PDF-1.4\n')
    offsets = []
    for num, (head, stream) in enumerate(objects, 1):
        offsets.append(len(out))
        body = head.encode()
        if stream is not None:
            body = body.replace(b'>>', b' /Length %d >>' % len(stream), 1)
            body += b'\nstream\n' + stream + b'\nendstream'
        out += b'%d 0 obj\n' % num + body + b'\nendobj\n'
    xref = len(out)
    out += b'xref\n0 %d\n0000000000 65535 f \n' % (len(objects) + 1)
    for offset in offsets:
        out += b'%010d 00000 n \n' % offset
    out += b'trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n' % (len(objects) + 1, xref)
    return bytes(out)


jpeg = io.BytesIO()
photo(1200, 900, 1).save(jpeg, 'JPEG', quality=95)
flat = photo(600, 450, 2)


def page_content(n: int, image: str) -> bytes:
    return (b'q 500 0 0 375 56 380 cm /%s Do Q BT /F1 24 Tf 56 300 Td (Photo page %d) Tj ET'
            % (image.encode(), n))


with open(path('photos.pdf'), 'wb') as f:
    f.write(pdf([
        ('<< /Type /Catalog /Pages 2 0 R >>', None),
        ('<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>', None),
        ('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 5 0 R '
         '/Resources << /Font << /F1 9 0 R >> /XObject << /Im1 7 0 R >> >> >>', None),
        ('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 6 0 R '
         '/Resources << /Font << /F1 9 0 R >> /XObject << /Im2 8 0 R >> >> >>', None),
        ('<< >>', page_content(1, 'Im1')),
        ('<< >>', page_content(2, 'Im2')),
        ('<< /Type /XObject /Subtype /Image /Width 1200 /Height 900 /ColorSpace /DeviceRGB '
         '/BitsPerComponent 8 /Filter /DCTDecode >>', jpeg.getvalue()),
        ('<< /Type /XObject /Subtype /Image /Width 600 /Height 450 /ColorSpace /DeviceRGB '
         '/BitsPerComponent 8 /Filter /FlateDecode '
         '/DecodeParms << /Predictor 11 /Colors 3 /Columns 600 >> >>',
         zlib.compress(sub_predicted(flat))),
        ('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', None),
        # 어디에서도 가리키지 않는 객체 (고친 기록이 쌓인 PDF에 남는 옛 객체 흉내)
        ('<< >>', zlib.compress(bytes(random.Random(3).getrandbits(8) for _ in range(40_000)))),
    ]))

# 이미지 압축용: 화질 높게 저장한 사진(JPG)과 화면 캡처 같은 PNG(색 변화가 부드럽고 투명한 곳이 있음)
photo(1200, 900, 2).save(path('photo.jpg'), 'JPEG', quality=95)
# 이미 낮은 화질로 저장해 더 줄일 수 없는 사진
photo(400, 300, 3).save(path('small.jpg'), 'JPEG', quality=40)
screen = Image.new('RGBA', (800, 600), (0, 0, 0, 0))
screen_pixels = screen.load()
for y in range(600):
    for x in range(800):
        if y >= 40:
            screen_pixels[x, y] = (120 + x // 7, 100 + y // 5, 160 + (x + y) // 20, 255)
for top in range(80, 560, 60):
    for y in range(top, top + 36):
        for x in range(40, 760):
            screen_pixels[x, y] = (40 + top // 4, 120, 200 - top // 4, 255)
screen.save(path('screen.png'))

# 형식 변환용: 두 장면짜리 움직이는 GIF와 BMP
frames = [Image.new('RGB', (120, 80), color) for color in [(220, 40, 40), (40, 40, 220)]]
frames[0].save(path('moving.gif'), save_all=True, append_images=frames[1:], duration=200, loop=0)
Image.new('RGB', (160, 90), (40, 180, 90)).save(path('green.bmp'))



def located_exif(orientation: int) -> bytes:
    exif = Image.Exif()
    exif[0x010F] = 'Apple'
    exif[0x0110] = 'iPhone 15 Pro'
    exif[0x0112] = orientation
    exif.get_ifd(0x8769)[0x9003] = '2024:05:01 14:23:11'
    gps = exif.get_ifd(0x8825)
    gps[1] = 'N'
    gps[2] = (37.0, 33.0, 58.68)
    gps[3] = 'E'
    gps[4] = (126.0, 58.0, 40.44)
    return exif.tobytes()


LOCATED_XMP = (
    b'<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
    b'<rdf:Description xmlns:exif="http://ns.adobe.com/exif/1.0/" exif:GPSLatitude="37,33.978N"'
    b' exif:GPSLongitude="126,58.674E"/></rdf:RDF></x:xmpmeta>'
)
located = Image.new('RGB', (400, 300), (200, 120, 40))
buffer = io.BytesIO()
located.save(buffer, 'JPEG', quality=90, exif=located_exif(6), xmp=LOCATED_XMP, comment=b'taken at home')
with open(path('located.jpg'), 'wb') as file:
    file.write(buffer.getvalue() + b'\x00\x00\x00\x18ftypmp42MOTION-PHOTO-VIDEO')
text = PngImagePlugin.PngInfo()
text.add_text('Comment', 'taken at home')
located.save(path('located.png'), exif=located_exif(1), pnginfo=text)
located.save(path('located.webp'), quality=90, exif=located_exif(6), xmp=LOCATED_XMP)

scan = Image.new('L', (1240, 600), 255)
font = ImageFont.truetype(
    os.path.join(HERE, '../../node_modules/pretendard/dist/public/static/Pretendard-Regular.otf'), 56)
draw = ImageDraw.Draw(scan)
draw.text((80, 120), '다람쥐 헌 쳇바퀴에 타고파', font=font, fill=0)
draw.text((80, 300), 'The quick brown fox 2026', font=font, fill=0)
scan.save(path('scan.png'), optimize=True)

for name in ['wide.png', 'tall.jpg', 'rotated.jpg', 'broken.png', 'photos.pdf', 'photo.jpg',
             'screen.png', 'small.jpg', 'moving.gif', 'green.bmp', 'scan.png',
             'located.jpg', 'located.png', 'located.webp']:
    print(name, os.path.getsize(path(name)), 'bytes')
