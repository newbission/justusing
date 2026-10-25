"""
E2E 테스트용 이미지를 만든다 (이미지를 PDF로 도구). Pillow와 pillow-heif(HEIC)가 필요하다.

  python3 tests/fixtures/make_image_fixtures.py

- wide.png     가로 400×300
- tall.jpg     세로 300×400
- rotated.jpg  화소는 가로 400×300이고 EXIF 방향 6(시계 방향 90° 돌려 보기)
               → 바로 세우면 세로 300×400. 휴대폰 사진이 이렇게 저장된다
- broken.png   이름만 PNG이고 내용은 이미지가 아님
- photos.pdf   사진이 든 2쪽 PDF (PDF 압축 도구). 1쪽 고화질 JPG, 2쪽 PNG 예측을 건 Flate RGB 사진,
               그리고 어디에서도 쓰지 않는 큰 객체 하나. 쪽마다 글자 "Photo page N"
- located.jpg  촬영 정보가 든 사진 (위치정보 지우기). 화소 400×300, 방향 6, GPS(서울시청 앞), 찍은 날짜, 기기,
               EXIF 자유 글(설명 'Secret', 메모 'Near my house'),
               GPS가 든 XMP, 설명 글, 그림 끝 뒤에 덧붙은 영상(움직이는 사진처럼 ftyp로 시작)
- located.png  GPS·날짜·기기가 든 eXIf와 설명 글(tEXt)이 있는 PNG
- located.webp GPS가 든 EXIF와 XMP가 있는 WebP (방향 6)
- short-exif.jpg EXIF 조각이 머리 4바이트에서 끝난 JPEG (그림은 멀쩡함)
- scroll-1~3.png 화면을 내려 가며 찍은 캡처 3장 (이어 붙이기). 360×640, 위 상태 표시줄(시계가 장마다 다름)
               24줄과 제목 막대 48줄, 아래 탭 막대 56줄은 고정이고 가운데 512줄이 360줄씩 내려간다(152줄 겹침)
- quadrants.png 40×30을 네 칸으로 나눈 색 (자르기·회전). 왼쪽 위 빨강, 오른쪽 위 초록, 왼쪽 아래 파랑, 오른쪽 아래 흰색
- noise.png    80×60 화소마다 다른 색 (모자이크). 가린 곳 안이 바뀌고 밖은 그대로인지 화소로 견준다
- scroll-page.png 위 캡처를 제대로 이었을 때 나와야 하는 긴 화면 (360×1360)
- scroll-2.jpg  scroll-2.png를 JPG로 (JPG 잡음이 있어도 겹침을 찾는지)
- scan.png     글자를 찍은 그림 (글자 인식 도구). 한글 한 줄, 영어 한 줄. Pretendard로 그린다
- iphone.heic  아이폰 사진처럼 회전 표시(irot)가 든 HEIC (HEIC 변환). 화소는 가로 400×300 네 칸(왼쪽 위 빨강,
               오른쪽 위 초록, 왼쪽 아래 파랑, 오른쪽 아래 흰색)이고 시계 방향 90°로 돌려 보라고 적혀 있다
               → 바로 세우면 세로 300×400, 왼쪽 위 파랑·오른쪽 위 빨강·왼쪽 아래 흰색·오른쪽 아래 초록. 작은 미리보기 그림도 든다
- burst.heic   그림 두 장이 든 HEIC (연사처럼). 첫 장은 파랑 200×100, 대표 그림(primary)은 둘째 장 빨강 120×160
- deep.heic    10비트 HEIC 400×300 (HDR 사진처럼 8비트보다 깊다). 색은 (200, 40, 40)쯤
- p3.heic      색 공간이 Display P3(nclx 12번)인 HEIC 200×150, 색 (200, 60, 60). 일반 화면 색으로 바꾸면 빨강이 더 짙다
- broken.heic  머리만 HEIC이고 내용은 깨진 파일
- located.heic 촬영 정보가 든 HEIC (위치정보 지우기). located.jpg와 같은 EXIF(GPS·날짜·기기·자유 글)와 GPS가 든 XMP,
               회전 표시(irot). 화소 400×300 → 바로 세우면 300×400
- located-uuid.heic located.heic에 위치 글이 든 확장 그림 속성(uuid)을 더한 것 (허용 목록 밖이라 지우지 않아야 한다)
- located-jpeg-item.heic located.heic에 located.jpg를 JPEG 그림 항목으로 더한 것 (그 안의 정보 조각까지 비워야 한다)

이 스크립트가 만들지 않는 것:
- face.jpg     흰 배경 앞 얼굴 사진 (증명사진 도구). 얼굴 인식은 실제 사진이라야 해서 NASA 공개 사진
               (퍼블릭 도메인, commons.wikimedia.org/wiki/File:Jessica_Wittner_white_background.jpg)을
               800×1200으로 줄였다. 테스트에만 쓰고 사이트 견본으로는 쓰지 않는다
"""
import io
import math
import os
import random
import struct
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
    exif[0x010E] = 'Home: 123 Secret St'
    exif.get_ifd(0x8769)[0x9003] = '2024:05:01 14:23:11'
    exif.get_ifd(0x8769)[0x9286] = b'ASCII\0\0\0Near my house'
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
# EXIF 머리(바이트 순서)만 있고 끝난 사진: 그림은 멀쩡하다
buffer = io.BytesIO()
Image.new('RGB', (200, 150), (90, 90, 160)).save(buffer, 'JPEG', quality=90)
plain = buffer.getvalue()
with open(path('short-exif.jpg'), 'wb') as file:
    file.write(plain[:2] + bytes([0xFF, 0xE1, 0, 12]) + b'Exif\0\0MM\0*' + plain[2:])



def scroll_shots():
    """긴 화면과 그것을 내려 가며 찍은 캡처 3장"""
    rng = random.Random(7)
    width, status, bar, tabs, view, step = 360, 24, 48, 56, 512, 360
    content = Image.new('RGB', (width, view + step * 2), (250, 250, 250))
    draw = ImageDraw.Draw(content)
    y = 12
    while y < content.height - 30:
        if rng.random() < 0.25:  # 사진 칸
            draw.rectangle((16, y, width - 16, y + 90), fill=(rng.randint(60, 200), 120, 160))
            y += 104
        else:  # 글 줄
            draw.rectangle((16, y, rng.randint(120, width - 16), y + 10), fill=(40, 40, 40))
            y += 22
    def chrome(shot: Image.Image, n: int):
        d = ImageDraw.Draw(shot)
        d.rectangle((0, 0, width, status - 1), fill=(255, 255, 255))
        d.text((14, 6), f'9:4{n}', fill=(0, 0, 0))
        d.rectangle((0, status, width, status + bar - 1), fill=(30, 110, 70))
        d.text((16, status + 18), 'Scroll sample', fill=(255, 255, 255))
        d.rectangle((0, shot.height - tabs, width, shot.height), fill=(235, 235, 235))
        for i in range(4):
            d.ellipse((30 + i * 90, shot.height - 44, 54 + i * 90, shot.height - 20), fill=(90, 90, 90))
    for n in range(3):
        shot = Image.new('RGB', (width, status + bar + view + tabs))
        shot.paste(content.crop((0, n * step, width, n * step + view)), (0, status + bar))
        chrome(shot, n + 1)
        shot.save(path(f'scroll-{n + 1}.png'))
        if n == 1:
            shot.save(path('scroll-2.jpg'), quality=85)
    page = Image.new('RGB', (width, status + bar + content.height + tabs))
    page.paste(content, (0, status + bar))
    chrome(page, 1)
    page.save(path('scroll-page.png'))


scroll_shots()

scan = Image.new('L', (1240, 600), 255)
font = ImageFont.truetype(
    os.path.join(HERE, '../../node_modules/pretendard/dist/public/static/Pretendard-Regular.otf'), 56)
draw = ImageDraw.Draw(scan)
draw.text((80, 120), '다람쥐 헌 쳇바퀴에 타고파', font=font, fill=0)
draw.text((80, 300), 'The quick brown fox 2026', font=font, fill=0)
scan.save(path('scan.png'), optimize=True)

quadrants = Image.new('RGB', (40, 30), (255, 255, 255))
quadrants.paste((255, 0, 0), (0, 0, 20, 15))
quadrants.paste((0, 255, 0), (20, 0, 40, 15))
quadrants.paste((0, 0, 255), (0, 15, 20, 30))
quadrants.save(path('quadrants.png'))

noise_rng = random.Random(80)
noise = Image.new('RGB', (80, 60))
noise.putdata([tuple(noise_rng.randrange(256) for _ in range(3)) for _ in range(80 * 60)])
noise.save(path('noise.png'))


def heic_fixtures():
    """HEIC 사진들 (HEIC 변환). 크롬은 HEIC를 스스로 읽지 못해 libheif 경로를 시험한다"""
    import pillow_heif

    turned = Image.new('RGB', (400, 300), (255, 255, 255))
    turned.paste((255, 0, 0), (0, 0, 200, 150))
    turned.paste((0, 255, 0), (200, 0, 400, 150))
    turned.paste((0, 0, 255), (0, 150, 200, 300))
    exif = Image.Exif()
    exif[0x0112] = 6
    # pillow-heif는 EXIF 방향을 회전 표시(irot)로 옮겨 적고 EXIF 방향은 1로 둔다 (아이폰과 같다)
    pillow_heif.from_pillow(turned).save(
        path('iphone.heic'), quality=90, exif=exif.tobytes(), thumbnails=[64], color_primaries=1)

    burst = pillow_heif.HeifFile()
    burst.add_frombytes('RGB', (200, 100), Image.new('RGB', (200, 100), (0, 0, 255)).tobytes())
    burst.add_frombytes('RGB', (120, 160), Image.new('RGB', (120, 160), (255, 0, 0)).tobytes())
    burst.save(path('burst.heic'), quality=90, primary_index=1)

    # 16비트 화소로 넘기면 10비트로 저장한다
    deep = struct.pack('<3H', 200 * 257, 40 * 257, 40 * 257) * (400 * 300)
    pillow_heif.from_bytes(mode='RGB;16', size=(400, 300), data=deep).save(path('deep.heic'), quality=90)

    pillow_heif.from_pillow(Image.new('RGB', (200, 150), (200, 60, 60))).save(
        path('p3.heic'), quality=90, color_primaries=12, transfer_characteristic=13, matrix_coefficients=6)

    pillow_heif.from_pillow(located).save(
        path('located.heic'), quality=90, exif=located_exif(6), xmp=LOCATED_XMP)

    with open(path('iphone.heic'), 'rb') as f:
        head = f.read(64)
    with open(path('broken.heic'), 'wb') as f:
        f.write(head + b'not really a photo' * 20)


heic_fixtures()


def heif_box(kind: str, body: bytes) -> bytes:
    return struct.pack('>I', 8 + len(body)) + kind.encode('latin1') + body


def heif_full_box(kind: str, body: bytes, version: int = 0) -> bytes:
    return heif_box(kind, bytes([version, 0, 0, 0]) + body)


def heif_children(data: bytes, start: int, end: int):
    while start + 8 <= end:
        size, kind = struct.unpack('>I4s', data[start:start + 8])
        yield kind.decode('latin1'), data[start:start + size], data[start + 8:start + size]
        start += size


def rebuild_heif(source: str, target: str, extra_props=(), extra_items=()):
    """source HEIC의 항목·속성을 그대로 옮기고 속성·항목을 더해 다시 쓴다 (위치 정보 지우기의 허용 목록 시험).

    extra_props: [(속성 상자, 붙일 항목 번호)], extra_items: [(항목 번호, 종류, 자료)]
    """
    with open(source, 'rb') as file:
        data = file.read()
    top = {kind: (raw, body) for kind, raw, body in heif_children(data, 0, len(data))}
    meta = {kind: (raw, body) for kind, raw, body in heif_children(top['meta'][1], 4, len(top['meta'][1]))}
    infes = [raw for kind, raw, _ in heif_children(meta['iinf'][1], 6, len(meta['iinf'][1]))]
    iprp = {kind: body for kind, _, body in heif_children(meta['iprp'][1], 0, len(meta['iprp'][1]))}
    props = [raw for _, raw, _ in heif_children(iprp['ipco'], 0, len(iprp['ipco']))]

    # iloc (판 0, 파일 안 위치)에서 항목 자료를 읽는다
    iloc = meta['iloc'][1]
    sizes = iloc[4], iloc[5]
    offset_size, length_size, base_size = sizes[0] >> 4, sizes[0] & 15, sizes[1] >> 4
    read = lambda at, n: (int.from_bytes(iloc[at:at + n], 'big') if n else 0, at + n)
    count, at = read(6, 2)
    contents = {}
    for _ in range(count):
        item, at = read(at, 2)
        _, at = read(at, 2)
        base, at = read(at, base_size)
        extents, at = read(at, 2)
        parts = b''
        for _ in range(extents):
            offset, at = read(at, offset_size)
            length, at = read(at, length_size)
            parts += data[base + offset:base + offset + length]
        contents[item] = parts

    # ipma (판 0): 항목마다 속성 번호 목록
    ipma = iprp['ipma']
    associations = {}
    at = 8
    for _ in range(struct.unpack('>I', ipma[4:8])[0]):
        item, n = struct.unpack('>HB', ipma[at:at + 3])
        associations[item] = list(ipma[at + 3:at + 3 + n])
        at += 3 + n
    for box, item in extra_props:
        props.append(box)
        associations.setdefault(item, []).append(len(props))
    for item, kind, payload in extra_items:
        infes.append(heif_full_box('infe', struct.pack('>HH', item, 0) + kind.encode('latin1') + b'\0', 2))
        contents[item] = payload

    ipma_body = struct.pack('>I', len(associations)) + b''.join(
        struct.pack('>HB', item, len(values)) + bytes(values) for item, values in sorted(associations.items()))
    new_iprp = heif_box('iprp', heif_box('ipco', b''.join(props)) + heif_full_box('ipma', ipma_body))
    new_iinf = heif_full_box('iinf', struct.pack('>H', len(infes)) + b''.join(infes))
    order = sorted(contents)

    def build(mdat_start: int) -> bytes:
        entries = b''
        offset = mdat_start
        for item in order:
            entries += struct.pack('>HHHII', item, 0, 1, offset, len(contents[item]))
            offset += len(contents[item])
        new_iloc = heif_full_box('iloc', bytes([0x44, 0x00]) + struct.pack('>H', len(order)) + entries)
        rest = meta.get('iref', (b'', b''))[0]
        return heif_full_box('meta', meta['hdlr'][0] + meta['pitm'][0] + new_iloc + new_iinf + new_iprp + rest)

    ftyp = top['ftyp'][0]
    size = len(build(0))
    new_meta = build(len(ftyp) + size + 8)
    mdat = heif_box('mdat', b''.join(contents[item] for item in order))
    with open(target, 'wb') as file:
        file.write(ftyp + new_meta + mdat)


# 허용 목록 밖의 그림 속성(uuid)에 위치 글이 든 HEIC: 지우지 않고 '안전하게 지울 수 없음'으로 알려야 한다
rebuild_heif(path('located.heic'), path('located-uuid.heic'), extra_props=[
    (heif_box('uuid', bytes(range(16)) + b'GPS 37.5663,126.9779 Home: 123 Secret St'), 1)])
# JPEG 그림 항목 안에 촬영 정보(EXIF GPS·XMP·설명 글·덧붙은 영상)가 든 HEIC: 그 조각까지 같은 길이로 비워야 한다
with open(path('located.jpg'), 'rb') as f:
    located_jpeg = f.read()
rebuild_heif(path('located.heic'), path('located-jpeg-item.heic'),
             extra_props=[(heif_full_box('ispe', struct.pack('>II', 400, 300)), 4)],
             extra_items=[(4, 'jpeg', located_jpeg)])

for name in ['wide.png', 'tall.jpg', 'rotated.jpg', 'broken.png', 'photos.pdf', 'photo.jpg',
             'screen.png', 'small.jpg', 'moving.gif', 'green.bmp', 'scan.png',
             'located.jpg', 'located.png', 'located.webp', 'short-exif.jpg',
             'scroll-1.png', 'scroll-2.png', 'scroll-3.png', 'scroll-page.png', 'scroll-2.jpg', 'quadrants.png',
             'noise.png', 'iphone.heic', 'burst.heic', 'deep.heic', 'p3.heic', 'broken.heic', 'located.heic', 'located-uuid.heic', 'located-jpeg-item.heic']:
    print(name, os.path.getsize(path(name)), 'bytes')
