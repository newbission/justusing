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
"""
import io
import math
import os
import random
import zlib

from PIL import Image

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

for name in ['wide.png', 'tall.jpg', 'rotated.jpg', 'broken.png', 'photos.pdf']:
    print(name, os.path.getsize(path(name)), 'bytes')
