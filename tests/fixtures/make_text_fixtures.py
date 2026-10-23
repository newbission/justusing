"""
E2E 테스트용 글자 파일(CSV)을 만든다. 파이썬 표준 코덱만 쓴다 (도구의 인코더와 다른 구현으로 만든 기준 파일).

  python3 tests/fixtures/make_text_fixtures.py

- korean-cp949.csv  CP949, CRLF. 확장 완성형에만 있는 '똠'이 들어 있다 (EUC-KR만 아는 도구는 못 읽는다)
- japanese-sjis.csv Shift_JIS, LF. 자동 판단이 맞히지 못해 직접 골라야 하는 파일
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))

KOREAN = (
    '이름,부서,메모\r\n'
    '홍길동,기획팀,"똠얌꿍, 점심"\r\n'
    '김예시,영업팀,내일 오전 회의\r\n'
)

JAPANESE = (
    '名前,部署,メモ\n'
    '山田太郎,企画部,ひらがなとカタカナ\n'
    '佐藤花子,営業部,明日の会議\n'
)


def write(name: str, data: bytes):
    with open(os.path.join(HERE, name), 'wb') as file:
        file.write(data)
    print(name, len(data), 'bytes')


write('korean-cp949.csv', KOREAN.encode('cp949'))
write('japanese-sjis.csv', JAPANESE.encode('shift_jis'))
