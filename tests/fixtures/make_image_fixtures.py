"""
E2E 테스트용 이미지를 만든다 (이미지를 PDF로 도구). Pillow가 필요하다.

  python3 tests/fixtures/make_image_fixtures.py

- wide.png     가로 400×300
- tall.jpg     세로 300×400
- rotated.jpg  화소는 가로 400×300이고 EXIF 방향 6(시계 방향 90° 돌려 보기)
               → 바로 세우면 세로 300×400. 휴대폰 사진이 이렇게 저장된다
- broken.png   이름만 PNG이고 내용은 이미지가 아님
"""
import os

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

for name in ['wide.png', 'tall.jpg', 'rotated.jpg', 'broken.png']:
    print(name, os.path.getsize(path(name)), 'bytes')
