"""
E2E 테스트용 PDF를 만든다. 외부 라이브러리 없이 PDF 문법을 직접 쓴다.

  python3 tests/fixtures/make_fixtures.py

- three-pages.pdf  영문 3쪽
- korean.pdf       한글 (폰트를 넣지 않은 CID 폰트 → pdf.js가 CMap 파일을 받아야 보임)
- encrypted.pdf    암호 1234 (표준 보안 처리기 R2, RC4 40비트)
- user-unit.pdf    좌표 단위가 2pt인 쪽 (/UserUnit 2, 297.5×421 단위 = A4 크기)
"""
import hashlib
import os

HERE = os.path.dirname(os.path.abspath(__file__))
PAD = bytes.fromhex('28BF4E5E4E758A4164004E56FFFA01082E2E00B6D0683E802F0CA9FE6453697A')


def rc4(key: bytes, data: bytes) -> bytes:
    s = list(range(256))
    j = 0
    for i in range(256):
        j = (j + s[i] + key[i % len(key)]) % 256
        s[i], s[j] = s[j], s[i]
    out = bytearray()
    i = j = 0
    for byte in data:
        i = (i + 1) % 256
        j = (j + s[i]) % 256
        s[i], s[j] = s[j], s[i]
        out.append(byte ^ s[(s[i] + s[j]) % 256])
    return bytes(out)


def build(objects, encrypt_password=None):
    """objects: [(dict 문자열, 스트림 바이트 또는 None)], 1번이 Catalog"""
    file_id = hashlib.md5(b'justusing-fixture').digest()
    trailer_extra = b''
    file_key = None
    if encrypt_password is not None:
        pw = (encrypt_password.encode() + PAD)[:32]
        owner = rc4(hashlib.md5(pw).digest()[:5], pw)
        p = (-4).to_bytes(4, 'little', signed=True)
        file_key = hashlib.md5(pw + owner + p + file_id).digest()[:5]
        user = rc4(file_key, PAD)
        objects = objects + [(
            '<< /Filter /Standard /V 1 /R 2 /O <%s> /U <%s> /P -4 >>' % (owner.hex(), user.hex()), None)]
        trailer_extra = b' /Encrypt %d 0 R' % len(objects)

    out = bytearray(b'%PDF-1.4\n')
    offsets = []
    for num, (head, stream) in enumerate(objects, 1):
        offsets.append(len(out))
        body = head.encode()
        if stream is not None:
            data = stream
            if file_key is not None:
                obj_key = hashlib.md5(file_key + num.to_bytes(3, 'little') + b'\0\0').digest()[:10]
                data = rc4(obj_key, data)
            body = body.replace(b'>>', b' /Length %d >>' % len(data), 1) if b'/Length' not in body else body
            body += b'\nstream\n' + data + b'\nendstream'
        out += b'%d 0 obj\n' % num + body + b'\nendobj\n'
    xref = len(out)
    out += b'xref\n0 %d\n0000000000 65535 f \n' % (len(objects) + 1)
    for off in offsets:
        out += b'%010d 00000 n \n' % off
    out += b'trailer\n<< /Size %d /Root 1 0 R /ID [<%s><%s>]%s >>\nstartxref\n%d\n%%%%EOF\n' % (
        len(objects) + 1, file_id.hex().encode(), file_id.hex().encode(), trailer_extra, xref)
    return bytes(out)


def text_pages(texts, font_dict, encode, page_extra='/MediaBox [0 0 595 842]'):
    """texts 하나당 한 쪽. 객체 번호: 1 Catalog, 2 Pages, 3 Font, 이후 (Page, Contents) 쌍"""
    n = len(texts)
    kids = ' '.join('%d 0 R' % (4 + i * 2) for i in range(n))
    objects = [
        ('<< /Type /Catalog /Pages 2 0 R >>', None),
        ('<< /Type /Pages /Kids [%s] /Count %d >>' % (kids, n), None),
        (font_dict, None),
    ]
    for i, text in enumerate(texts):
        objects.append((
            '<< /Type /Page /Parent 2 0 R %s /Contents %d 0 R '
            '/Resources << /Font << /F1 3 0 R >> >> >>' % (page_extra, 5 + i * 2), None))
        objects.append(('<< >>', b'BT /F1 36 Tf 72 700 Td ' + encode(text) + b' Tj ET'))
    return objects


def latin(text):
    return b'(' + text.encode('latin-1') + b')'


def ucs2(text):
    return b'<' + text.encode('utf-16-be').hex().encode() + b'>'


HELVETICA = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
KOREAN_FONT = (
    '<< /Type /Font /Subtype /Type0 /BaseFont /HYSMyeongJo-Medium /Encoding /UniKS-UCS2-H '
    '/DescendantFonts [<< /Type /Font /Subtype /CIDFontType0 /BaseFont /HYSMyeongJo-Medium '
    '/CIDSystemInfo << /Registry (Adobe) /Ordering (Korea1) /Supplement 2 >> '
    '/FontDescriptor << /Type /FontDescriptor /FontName /HYSMyeongJo-Medium /Flags 6 '
    '/FontBBox [0 -148 1001 880] /ItalicAngle 0 /Ascent 880 /Descent -120 /CapHeight 880 '
    '/StemV 60 >> >>] >>'
)

files = {
    'three-pages.pdf': build(text_pages(['Page 1', 'Page 2', 'Page 3'], HELVETICA, latin)),
    'korean.pdf': build(text_pages(['안녕하세요 한글 PDF'], KOREAN_FONT, ucs2)),
    'encrypted.pdf': build(text_pages(['Secret page'], HELVETICA, latin), encrypt_password='1234'),
    'user-unit.pdf': build(text_pages(['Unit'], HELVETICA, latin,
                                      '/MediaBox [0 0 297.5 421] /UserUnit 2')),
}
for name, data in files.items():
    with open(os.path.join(HERE, name), 'wb') as f:
        f.write(data)
    print(name, len(data), 'bytes')
