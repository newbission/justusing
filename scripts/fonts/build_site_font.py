"""
사이트 화면 글꼴(바깥 페이지·도구 화면의 글자)을 만든다. 결과는 저장소에 커밋한다.

    npm run build                          # 사이트 글자를 dist/에서 센다
    python3 scripts/fonts/build_site_font.py
    npm run build                          # 새 글꼴로 다시 빌드

왜: Pretendard 패키지의 글자 범위별 조각(92개, 조각마다 한글 100여 자)을 그대로 쓰면 한 페이지가 한글
수백 자를 그리려고 조각 15개 안팎(350~460KB)을 받았다. 받은 글자 대부분은 그 페이지에 없는 글자였고,
조각 목록(unicode-range) CSS만 48KB(gzip 14KB)였다. 사이트에 실제로 쓰는 글자만 담아 조각 네 개로 나눈다.

하는 일:
  1. 사이트 글자를 모은다: src/의 글(코드·문구·가이드)과 빌드한 HTML의 글자 중 Pretendard에 있는 것.
     한글은 HTML 페이지 몇 개에 나오는지(많이 쓰는 순서)로 줄 세운다
  2. 조각으로 나눈다
     - base: 영문·숫자·문장부호와 한글 아닌 글자, 영어 페이지에 나오는 한글('한국어' 버튼). 모든 페이지가 받는다
     - core: 홈에 나오는 한글 + 많이 쓰는 한글 CORE_EXTRA자. 한국어 페이지와 도구 화면 첫 화면이 대개 이것으로 끝난다
     - rest-N: 나머지 한글을 많이 쓰는 순서로 REST_CHUNKS개로 (가이드 글·도구 화면 안쪽 문구)
  3. 굵기 축을 사이트가 쓰는 400~700으로 줄인다 (가변 글꼴 그대로라 400·500·600·700이 지금과 같은 모양).
     800 이상을 쓰면 700으로 그려지므로 이 범위를 같이 넓힌다
  4. Pretendard 허가서(OFL)에 예약 글꼴 이름이 있어(Pretendard) 글자를 덜어 낸 고친 판에는 그 이름을 쓰지 않는다.
     글꼴 안 이름과 CSS 이름은 'JUS Modern Gothic' (도구용 Pretendard 글꼴과 같은 이름, scripts/fonts/build_fonts.py)
  5. src/styles/fonts/site-*.woff2, src/styles/site-font.css(@font-face), src/styles/fonts/site-font.json(조각별 글자,
     E2E가 사이트 글자가 모두 들어 있는지 확인할 때 쓴다)을 쓴다

새 글(가이드·도구 문구)에 없던 글자가 생기면 E2E(site-font.spec.ts)가 알려 준다. 그때 이 스크립트를 다시 돌린다.
도구 화면은 파일 이름 같은 사용자 글자를 보여 주므로 Pretendard 원래 조각을 뒤 글꼴로 함께 둔다 (FrameLayout).
"""

import glob
import html
import io
import json
import os
import re
import subprocess
import sys
from collections import Counter

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SOURCE = os.path.join(ROOT, 'node_modules', 'pretendard', 'dist', 'public', 'variable', 'PretendardVariable.ttf')
PACKAGE = os.path.join(ROOT, 'node_modules', 'pretendard', 'package.json')
DIST = os.path.join(ROOT, 'dist')
OUT_DIR = os.path.join(ROOT, 'src', 'styles', 'fonts')
CSS = os.path.join(ROOT, 'src', 'styles', 'site-font.css')
LIST = os.path.join(OUT_DIR, 'site-font.json')

FAMILY = 'JUS Modern Gothic'
POSTSCRIPT = 'JUSModernGothic'
# 사이트가 쓰는 굵기 (tokens·컴포넌트 CSS의 font-weight, 제목·strong의 bold)
WEIGHTS = (400, 700)
# 홈 글자 다음으로 core에 넣는 많이 쓰는 한글 수, 나머지를 나누는 조각 수
CORE_EXTRA = 100
REST_CHUNKS = 2
TEXT_FILES = ('.ts', '.svelte', '.astro', '.md', '.mdx', '.json', '.css', '.mjs')


def is_hangul(char: str) -> bool:
    return 0xAC00 <= ord(char) <= 0xD7A3


def page_text(path: str) -> str:
    """HTML에서 화면에 글자로 나오는 것 (태그·스크립트·스타일을 뺀 글, 입력 칸 안내 글)"""
    source = open(path, encoding='utf-8').read()
    source = re.sub(r'<(script|style)\b[^>]*>.*?</\1>', ' ', source, flags=re.S)
    source = re.sub(r'<!--.*?-->', ' ', source, flags=re.S)
    attrs = ' '.join(re.findall(r'\s(?:placeholder|value)="([^"]*)"', source))
    return html.unescape(re.sub(r'<[^>]+>', ' ', source) + ' ' + attrs)


def ranges(codes: list[int]) -> list[tuple[int, int]]:
    out: list[tuple[int, int]] = []
    for code in sorted(codes):
        if out and code == out[-1][1] + 1:
            out[-1] = (out[-1][0], code)
        else:
            out.append((code, code))
    return out


def unicode_range(chars: set[str]) -> str:
    return ', '.join(f'U+{a:x}' if a == b else f'U+{a:x}-{b:x}' for a, b in ranges([ord(c) for c in chars]))


def rename(font: TTFont):
    """예약 글꼴 이름(Pretendard)을 우리 이름으로. 저작권(0)·상표(7) 알림은 그대로 둔다"""
    for record in font['name'].names:
        if record.nameID in (0, 7):
            continue
        text = record.toUnicode()
        if 'Pretendard' not in text:
            continue
        if record.nameID == 3:
            text = f'justusing;{POSTSCRIPT}-Site'
        else:
            text = text.replace('Pretendard Variable', FAMILY).replace('PretendardVariable', POSTSCRIPT)
            text = text.replace('Pretendard', FAMILY)
        record.string = text
    left = [r.nameID for r in font['name'].names if r.nameID not in (0, 7) and 'Pretendard' in r.toUnicode()]
    if left:
        sys.exit(f'글꼴 이름에 예약 이름이 남았습니다: {left}')


def build(instanced: str, chars: set[str], out: str) -> int:
    # 만든 날짜(head.modified)를 새로 적지 않는다: 같은 입력이면 같은 파일이 나와야 커밋에 변화가 없다
    font = TTFont(instanced, recalcTimestamp=False)
    options = subset.Options()
    options.layout_features = ['*']
    options.name_IDs = ['*']
    options.notdef_outline = True
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=[ord(c) for c in chars])
    subsetter.subset(font)
    rename(font)
    font.flavor = 'woff2'
    buffer = io.BytesIO()
    font.save(buffer)
    data = buffer.getvalue()
    with open(out, 'wb') as file:
        file.write(data)
    return len(data)


def main():
    if not os.path.exists(os.path.join(DIST, 'index.html')):
        sys.exit('먼저 npm run build로 사이트를 빌드하세요 (사이트 글자를 dist/에서 셉니다)')
    source = TTFont(SOURCE, recalcTimestamp=False)
    cmap = source.getBestCmap()
    has = lambda char: ord(char) in cmap

    # 1. 사이트 글자
    src_hangul: Counter[str] = Counter()
    other: set[str] = set()
    for path in glob.glob(os.path.join(ROOT, 'src', '**', '*'), recursive=True):
        if not path.endswith(TEXT_FILES) or os.path.basename(path) in ('site-font.json', 'site-font.css'):
            continue
        text = open(path, encoding='utf-8').read()
        src_hangul.update({c for c in text if is_hangul(c) and has(c)})
        other |= {c for c in text if ord(c) > 0x7E and not is_hangul(c) and has(c)}

    pages: dict[str, set[str]] = {}
    for path in glob.glob(os.path.join(DIST, '**', 'index.html'), recursive=True):
        rel = os.path.relpath(path, DIST)
        if '/frame/' in f'/{rel}':
            continue
        pages[rel] = {c for c in page_text(path) if has(c) and ord(c) >= 0x20}
    seen: Counter[str] = Counter()
    for chars in pages.values():
        seen.update(chars)
    page_chars = set(seen)
    other |= {c for c in page_chars if ord(c) > 0x7E and not is_hangul(c)}
    hangul = set(src_hangul) | {c for c in page_chars if is_hangul(c)}

    # 2. 조각
    english = {c for rel, chars in pages.items() if rel.startswith('en/') for c in chars if is_hangul(c)}
    base = {chr(c) for c in range(0x20, 0x7F)} | other | english
    order = sorted(hangul - english, key=lambda c: (-seen[c], -src_hangul[c], ord(c)))
    home = {c for c in pages['index.html'] if is_hangul(c)} - english
    rest = [c for c in order if c not in home]
    core = home | set(rest[:CORE_EXTRA])
    rest = rest[CORE_EXTRA:]
    size = -(-len(rest) // REST_CHUNKS)
    chunks = {'base': base, 'core': core}
    for i in range(REST_CHUNKS):
        chunks[f'rest-{i + 1}'] = set(rest[i * size:(i + 1) * size])

    # 3. 굵기 축 줄이기 (한 번만 하고 조각마다 덜어 낸다)
    os.makedirs(os.path.join(ROOT, '.cache', 'fonts'), exist_ok=True)
    instanced = os.path.join(ROOT, '.cache', 'fonts', 'pretendard-site-wght.ttf')
    narrowed = instancer.instantiateVariableFont(source, {'wght': WEIGHTS})
    narrowed.recalcTimestamp = False
    narrowed.save(instanced)

    # 4·5. 글꼴·CSS·목록
    os.makedirs(OUT_DIR, exist_ok=True)
    for old in glob.glob(os.path.join(OUT_DIR, 'site-*.woff2')):
        os.remove(old)
    version = json.load(open(PACKAGE))['version']
    faces = []
    for name, chars in chunks.items():
        out = os.path.join(OUT_DIR, f'site-{name}.woff2')
        size_bytes = build(instanced, chars, out)
        print(f'site-{name}.woff2: {len(chars)}자, {size_bytes / 1024:.1f}KB')
        faces.append(
            '@font-face {\n'
            f"  font-family: '{FAMILY}';\n"
            '  font-style: normal;\n'
            f'  font-weight: {WEIGHTS[0]} {WEIGHTS[1]};\n'
            '  font-display: swap;\n'
            f"  src: url('./fonts/site-{name}.woff2') format('woff2');\n"
            f'  unicode-range: {unicode_range(chars)};\n'
            '}\n'
        )
    with open(CSS, 'w', encoding='utf-8') as file:
        file.write(
            '/*\n'
            ' * 사이트 화면 글꼴. scripts/fonts/build_site_font.py가 만든다 (직접 고치지 않는다).\n'
            f' * Pretendard {version} (Copyright (c) 2021 Kil Hyung-jin, SIL Open Font License 1.1,\n'
            ' * 허가서는 /vendor/pretendard/LICENSE.txt)에서 사이트에 쓰는 글자만 덜어 낸 고친 판이라\n'
            f" * 예약 글꼴 이름을 쓰지 않고 '{FAMILY}'라고 부른다.\n"
            ' * 조각: base(영문·기호) · core(홈과 많이 쓰는 한글) · rest-N(나머지 사이트 한글)\n'
            ' */\n'
            + '\n'.join(faces)
        )
    with open(LIST, 'w', encoding='utf-8') as file:
        json.dump(
            {
                'source': f'pretendard {version} PretendardVariable.ttf',
                'weights': list(WEIGHTS),
                'chunks': {name: ''.join(sorted(chars)) for name, chars in chunks.items()},
                # 원본 글꼴에 있는 글자 범위. 원본에도 없는 글자(한자·그림 문자 등)는 확인에서 뺀다
                'sourceRanges': [[a, b] for a, b in ranges(list(cmap))],
            },
            file,
            ensure_ascii=False,
            indent=1,
        )
        file.write('\n')
    # 저장소의 포맷 검사(npm run format:check)를 통과하게 맞춘다
    subprocess.run([os.path.join(ROOT, 'node_modules', '.bin', 'prettier'), '--write', CSS, LIST], check=True)
    print(f'{CSS}, {LIST}')


if __name__ == '__main__':
    main()
