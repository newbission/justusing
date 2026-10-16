"""
도구에서 쓰는 한글 글꼴을 만든다 (글꼴을 더하거나 바꿀 때만 직접 돌린다. 결과는 저장소에 커밋한다).

    pip3 install fonttools brotli
    python3 scripts/fonts/build_fonts.py

하는 일:
  1. 원본 글꼴을 받는다 (Google Fonts 저장소의 고정 커밋, Pretendard는 node_modules). 받은 원본은 .cache/fonts/
  2. 굵기 가변 글꼴은 보통(400)·굵게(700)로 고정하고, 한글 음절·영문·숫자·문장부호만 남긴다 (한자는 뺀다)
  3. WOFF2로 압축해 public/data/fonts/에 둔다. 글리프 변환(transform)은 끈다:
     켜면 PDF에 글꼴을 넣는 fontkit이 loca 표를 찾지 못해 실패한다
  4. 글꼴마다 미리보기 SVG(언어별 줄 순서)를 그리고, 파일 크기·SHA-256 목록(catalog.json)을 만든다.
     도구 화면은 받은 파일이 이 목록의 SHA-256과 같을 때만 쓴다 (src/frame/data.ts)
"""

import hashlib
import json
import os
import shutil
import urllib.request

from fontTools import subset
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.ttLib.woff2 import compress
from fontTools.varLib import instancer

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CACHE = os.path.join(ROOT, '.cache', 'fonts')
OUT = os.path.join(ROOT, 'public', 'data', 'fonts')
CATALOG = os.path.join(ROOT, 'src', 'lib', 'fonts', 'catalog.json')

GOOGLE_FONTS = 'https://raw.githubusercontent.com/google/fonts/1d0e46c7933245c8180fe83e47917961c913bbdb/ofl/'
PRETENDARD = os.path.join(ROOT, 'node_modules', 'pretendard', 'dist', 'public', 'static')

# id: 주소·파일 이름. family: 만든 글꼴 안에 적는 이름. weights: 굵기 → (원본 파일, 가변 글꼴이면 wght 값).
# license: OFL 원문 위치.
# 글자를 덜어 낸 글꼴은 OFL의 '고친 판'이라, 허가서에 예약 글꼴 이름(Reserved Font Name)이 있으면 그 이름을
# 쓸 수 없다 (Pretendard, Nanum…). 그런 글꼴은 우리 이름(JUS …)을 붙인다. 원본 이름은 화면에 출처로만 밝힌다
FONTS = [
    {'id': 'pretendard', 'family': 'JUS Modern Gothic', 'weights': {400: ('pretendard:Pretendard-Regular.otf', None), 700: ('pretendard:Pretendard-Bold.otf', None)},
     'license': 'pretendard:LICENSE'},
    {'id': 'noto-sans-kr', 'family': 'Noto Sans KR', 'weights': {400: ('notosanskr/NotoSansKR[wght].ttf', 400), 700: ('notosanskr/NotoSansKR[wght].ttf', 700)},
     'license': 'notosanskr/OFL.txt'},
    {'id': 'noto-serif-kr', 'family': 'Noto Serif KR', 'weights': {400: ('notoserifkr/NotoSerifKR[wght].ttf', 400), 700: ('notoserifkr/NotoSerifKR[wght].ttf', 700)},
     'license': 'notoserifkr/OFL.txt'},
    {'id': 'nanum-gothic', 'family': 'JUS Basic Gothic', 'weights': {400: ('nanumgothic/NanumGothic-Regular.ttf', None), 700: ('nanumgothic/NanumGothic-Bold.ttf', None)},
     'license': 'nanumgothic/OFL.txt'},
    {'id': 'nanum-myeongjo', 'family': 'JUS Basic Myeongjo', 'weights': {400: ('nanummyeongjo/NanumMyeongjo-Regular.ttf', None), 700: ('nanummyeongjo/NanumMyeongjo-Bold.ttf', None)},
     'license': 'nanummyeongjo/OFL.txt'},
    {'id': 'nanum-pen', 'family': 'JUS Pen Script', 'weights': {400: ('nanumpenscript/NanumPenScript-Regular.ttf', None)},
     'license': 'nanumpenscript/OFL.txt'},
    {'id': 'gowun-dodum', 'family': 'Gowun Dodum', 'weights': {400: ('gowundodum/GowunDodum-Regular.ttf', None)},
     'license': 'gowundodum/OFL.txt'},
    {'id': 'black-han-sans', 'family': 'Black Han Sans', 'weights': {400: ('blackhansans/BlackHanSans-Regular.ttf', None)},
     'license': 'blackhansans/OFL.txt'},
]

# 남길 글자: 영문·숫자·문장부호, 라틴 기호, 일반 문장부호, 원화·유로 등 기호, 한글 호환 자모, 한글 음절, 전각 문자
UNICODES = (
    list(range(0x20, 0x7F)) + list(range(0xA0, 0x100)) + list(range(0x2000, 0x2070))
    + [0x20A9, 0x20AC, 0x2122, 0x2190, 0x2191, 0x2192, 0x2193, 0x203B, 0x25A0, 0x25A1, 0x25CB, 0x25CF, 0x2605, 0x2606]
    + list(range(0x3000, 0x3040)) + list(range(0x3130, 0x3190)) + list(range(0xAC00, 0xD7A4))
    + list(range(0xFF01, 0xFF5F))
)

# 미리보기 문구 (모든 글꼴 같은 문구). 언어마다 줄 순서만 다르다
KOREAN = '다람쥐 헌 쳇바퀴에 타고파'
UPPER = 'THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG'
LOWER = 'the quick brown fox jumps over the lazy dog'
DIGITS = '0123456789'
SYMBOLS = '! ? . , : ; \' " ( ) [ ] @ # $ % & * + - = / ₩ ~'
PREVIEW_LINES = {
    'ko': [KOREAN, UPPER, LOWER, DIGITS, SYMBOLS],
    'en': [UPPER, LOWER, KOREAN, DIGITS, SYMBOLS],
}


def source(path: str) -> str:
    """원본 파일 위치. 처음이면 받아서 .cache/fonts/에 둔다"""
    if path.startswith('pretendard:'):
        name = path.split(':', 1)[1]
        if name == 'LICENSE':
            return os.path.join(ROOT, 'node_modules', 'pretendard', 'dist', 'LICENSE.txt')
        return os.path.join(PRETENDARD, name)
    local = os.path.join(CACHE, path.replace('/', '__'))
    if not os.path.exists(local):
        os.makedirs(CACHE, exist_ok=True)
        url = GOOGLE_FONTS + path.replace('[', '%5B').replace(']', '%5D')
        with urllib.request.urlopen(url) as response, open(local, 'wb') as file:
            shutil.copyfileobj(response, file)
    return local


def rename(font: TTFont, family: str, weight: int):
    """글꼴 이름을 우리가 정한 이름으로 바꾼다 (예약 글꼴 이름 빼기, 가변 글꼴을 고정한 뒤 남는 'Thin' 같은 이름 고치기)"""
    style = 'Bold' if weight == 700 else 'Regular'
    postscript = family.replace(' ', '') + '-' + style
    table = font['name']
    table.names = [record for record in table.names if record.nameID not in (1, 2, 3, 4, 6, 16, 17, 18, 21, 22, 25)]
    for name_id, value in [
        (1, family), (2, style), (3, f'justusing;{postscript}'), (4, f'{family} {style}'), (6, postscript),
    ]:
        table.setName(value, name_id, 3, 1, 0x409)
    if 'CFF ' in font:
        cff = font['CFF '].cff
        top = cff[cff.fontNames[0]]
        cff.fontNames = [postscript]
        top.FullName = f'{family} {style}'
        top.FamilyName = family


def build_file(path: str, wght, out: str, family: str, weight: int) -> TTFont:
    font = TTFont(source(path))
    if wght is not None:
        font = instancer.instantiateVariableFont(font, {'wght': wght})
    options = subset.Options()
    options.layout_features = ['*']
    options.name_IDs = ['*']
    options.name_legacy = True
    options.notdef_outline = True
    options.hinting = False
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=UNICODES)
    subsetter.subset(font)
    rename(font, family, weight)
    plain = out + '.tmp'
    font.save(plain)
    compress(plain, out, transform_tables=set())
    os.remove(plain)
    return font


def preview_svg(font: TTFont, lines: list[str]) -> str:
    """줄마다 글자를 이어 그린 SVG. 같은 글자는 한 번만 그려 두고(<defs>) 다시 쓴다"""
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    upm = font['head'].unitsPerEm
    size = 32  # 글자 크기(px)
    line_height = round(size * 1.45)
    scale = size / upm
    defs: dict[str, str] = {}
    uses: list[str] = []
    width = 0
    for row, text in enumerate(lines):
        x = 0.0
        baseline = line_height * row + size
        for char in text:
            name = cmap.get(ord(char))
            if name is None:
                x += size * 0.5  # 글꼴에 없는 글자는 비워 둔다
                continue
            glyph = glyphs[name]
            if name not in defs:
                pen = SVGPathPen(glyphs, ntos=lambda value: str(round(value)))
                # 글꼴 좌표는 위가 +y라 뒤집는다
                glyph.draw(TransformPen(pen, (1, 0, 0, -1, 0, 0)))
                if pen.getCommands():
                    defs[name] = f'<path id="g{len(defs)}" d="{pen.getCommands()}"/>'
                else:
                    defs[name] = ''
            if defs[name]:
                ref = defs[name].split('"')[1]
                uses.append(f'<use href="#{ref}" transform="translate({x:.1f} {baseline}) scale({scale:.5f})"/>')
            x += glyph.width * scale
        width = max(width, x)
    height = line_height * len(lines) - (line_height - size) + round(size * 0.3)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {round(width) + 2} {height}" '
        f'width="{round(width) + 2}" height="{height}" fill="#1a1a1a">'
        f'<defs>{"".join(d for d in defs.values() if d)}</defs>{"".join(uses)}</svg>\n'
    )


def sha256(path: str) -> str:
    with open(path, 'rb') as file:
        return hashlib.sha256(file.read()).hexdigest()


def main():
    if os.path.exists(OUT):
        shutil.rmtree(OUT)
    os.makedirs(os.path.join(OUT, 'previews'))
    os.makedirs(os.path.join(OUT, 'licenses'))
    catalog = []
    for spec in FONTS:
        files = []
        regular = None
        for weight, (path, wght) in spec['weights'].items():
            name = f"{spec['id']}-{weight}.woff2"
            out = os.path.join(OUT, name)
            font = build_file(path, wght, out, spec['family'], weight)
            regular = regular or font
            cmap = font.getBestCmap()
            files.append({
                'weight': weight,
                'path': f'/data/fonts/{name}',
                'bytes': os.path.getsize(out),
                'sha256': sha256(out),
                'hangul': sum(1 for code in cmap if 0xAC00 <= code <= 0xD7A3),
            })
            print(f"{name}: {os.path.getsize(out) / 1024 / 1024:.2f}MB")
        for locale, lines in PREVIEW_LINES.items():
            with open(os.path.join(OUT, 'previews', f"{spec['id']}.{locale}.svg"), 'w') as file:
                file.write(preview_svg(regular, lines))
        shutil.copy(source(spec['license']), os.path.join(OUT, 'licenses', f"{spec['id']}.txt"))
        catalog.append({'id': spec['id'], 'files': files})
    with open(CATALOG, 'w') as file:
        json.dump(catalog, file, indent=2)
        file.write('\n')


if __name__ == '__main__':
    main()
