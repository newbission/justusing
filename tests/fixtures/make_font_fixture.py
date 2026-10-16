"""
테스트용 작은 글꼴: Pretendard에서 A·B·C와 빈칸만 남긴 OTF (내 글꼴 올리기, 없는 글자 안내 E2E).

    pip3 install fonttools
    python3 tests/fixtures/make_font_fixture.py   (npm install 뒤에 돌린다)
"""
import os

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
source = os.path.join(ROOT, 'node_modules', 'pretendard', 'dist', 'public', 'static', 'Pretendard-Regular.otf')
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'abc.otf')

font = TTFont(source)
options = subset.Options()
options.name_IDs = ['*']
subsetter = subset.Subsetter(options)
subsetter.populate(text='ABC ')
subsetter.subset(font)
font.save(out)
print('abc.otf', os.path.getsize(out), 'bytes')
